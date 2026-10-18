const db=require('../config/db');
const {sqlName}=require('../saas/provision');
const settings=require('../saas/payoutSettings');
const {encrypt,decrypt}=require('./secrets');
const {fail}=require('./studioValidation');
const {minorUnits}=require('./eventWallet');
const gateway=require('../saas/payments');
const central=name=>sqlName(db.database)+'.'+name;
const terminal=['failed','cancelled','rejected','reversed'];
function validateBank(bank){
 if(!['india','in'].includes(bank.country.toLowerCase())||!/^\d{6,20}$/.test(bank.account)||! /^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.routing))fail('Automatic payouts require an Indian bank account and a valid IFSC. Ask the organization to submit corrected bank details.');
 if(bank.holder.length<3||bank.holder.length>50||!/^[a-zA-Z0-9 ’_\-/().]+$/.test(bank.holder))fail('Account holder must be 3–50 characters using letters, numbers, spaces or standard punctuation.');
}
// Runs in the approval transaction. This durable record is the payout outbox.
async function prepare(conn,row){
 if(row.currency!=='INR')fail('Historical USD balances cannot be transferred as INR. This request needs separate settlement.',409);
 const scoped={query:(sql,args)=>conn.query(sql.replaceAll('platform_settings',central('platform_settings')),args)};
 await settings.lock(scoped);const config=await settings.get(scoped);
 if(!config.enabled||!settings.safe(config).configured)fail('Configure and enable RazorpayX bank payouts in Payment configuration first.',503);
 if(!config.key_id.startsWith('rzp_live_'))fail('Real withdrawals require live payout credentials.',409);
 validateBank(JSON.parse(decrypt(row.bank_encrypted)));
 const amount=minorUnits(row.amount);if(amount<100)fail('The minimum bank payout is ₹1.');
 await conn.query(`INSERT INTO ${central('wallet_payouts')}(withdrawal_id,config_encrypted,amount_minor,currency) VALUES (?,?,?,?)`,[row.id,encrypt(JSON.stringify(config)),amount,row.currency]);
}
async function find(id){const [[row]]=await db.platform.query('SELECT p.*,w.organization_id,w.event_id,w.amount,w.bank_encrypted FROM wallet_payouts p JOIN wallet_withdrawals w ON w.id=p.withdrawal_id WHERE p.withdrawal_id=?',[id]);return row;}
function validateEntity(row,entity,config){
 if(!entity||!/^pout_[a-zA-Z0-9]+$/.test(entity.id)||entity.reference_id!==row.withdrawal_id||Number(entity.amount)!==Number(row.amount_minor)||entity.currency!==row.currency||entity.fund_account_id!==row.fund_account_id||(row.provider_id&&row.provider_id!==entity.id)||(entity.debit_account_number&&entity.debit_account_number!==config.account_number))fail('Payout details do not match this withdrawal. Funds remain reserved for review.',409);
 if(!['queued','pending','processing','processed',...terminal].includes(entity.status))fail('Unknown bank transfer status. Funds remain reserved.',409);
}
async function apply(row,entity,config){
 validateEntity(row,entity,config);
 const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[row.organization_id]);
 return db.run(org,async()=>{const conn=await db.getConnection();try{
  await conn.beginTransaction();await conn.query('SELECT id FROM events WHERE id=? FOR UPDATE',[row.event_id]);
  const [[withdrawal]]=await conn.query(`SELECT * FROM ${central('wallet_withdrawals')} WHERE id=? FOR UPDATE`,[row.withdrawal_id]);
  const [[fresh]]=await conn.query(`SELECT * FROM ${central('wallet_payouts')} WHERE withdrawal_id=? FOR UPDATE`,[row.withdrawal_id]);
  if(terminal.includes(fresh.status)||(fresh.status==='processed'&&entity.status!=='reversed'&&entity.status!=='processed')){await conn.commit();return;}
  if(entity.status==='processed'&&fresh.status!=='processed'){
   if(withdrawal.status!=='approved')fail('Withdrawal state does not allow payment.',409);
   await conn.query("INSERT INTO event_wallet_entries(event_id,entry_type,reason,mode,currency,amount,withdrawal_id) VALUES (?,'withdrawal','withdrawal','live',?,-?,?)",[row.event_id,row.currency,row.amount,row.withdrawal_id]);
   await conn.query(`UPDATE ${central('wallet_withdrawals')} SET status='paid',paid_at=NOW(),transfer_reference=? WHERE id=?`,[entity.id,row.withdrawal_id]);
  }else if(terminal.includes(entity.status)){
   if(fresh.status==='processed')await conn.query("INSERT INTO event_wallet_entries(event_id,entry_type,reason,mode,currency,amount,withdrawal_id) VALUES (?,'payout_reversal','payout_reversal','live',?,?,?)",[row.event_id,row.currency,row.amount,row.withdrawal_id]);
   // Terminal provider confirmation releases the hold. Never release on a timeout.
   await conn.query(`UPDATE ${central('wallet_withdrawals')} SET status='rejected',review_note=? WHERE id=?`,['Bank transfer '+entity.status+'. Funds returned to the event’s available balance.',row.withdrawal_id]);
  }
  await conn.query(`UPDATE ${central('wallet_payouts')} SET provider_id=?,status=?,utr=?,last_error=NULL,checked_at=NOW() WHERE withdrawal_id=?`,[entity.id,entity.status,entity.utr||null,row.withdrawal_id]);
  if(fresh.status!==entity.status)await conn.query(`INSERT INTO ${central('platform_audit')}(organization_id,action,details_json) VALUES (?,'withdrawal.bank_status',?)`,[row.organization_id,JSON.stringify({withdrawal_id:row.withdrawal_id,payout_id:entity.id,status:entity.status})]);
  await conn.commit();
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}});
}
async function reconcile(id){
 // Cross-process serialization covers contact creation, fund account and payout POSTs.
 // Every payout POST uses the same persisted withdrawal UUID and identical payload.
 const lock=await db.platform.getConnection();let acquired=false;
 try{
  const [[r]]=await lock.query('SELECT GET_LOCK(?,0) acquired',['tf-payout-'+id]);acquired=Boolean(r.acquired);if(!acquired)return;
  let row=await find(id);if(!row||terminal.includes(row.status))return;
  const config=JSON.parse(decrypt(row.config_encrypted));
  const current=await settings.get();
  // Permit secret rotation within the same provider account without changing the transfer.
  if(current.key_id===config.key_id)config.key_secret=current.key_secret;
  if(row.provider_id){await apply(row,await gateway.razorpay('payouts/'+encodeURIComponent(row.provider_id),undefined,config),config);return;}
  const bank=JSON.parse(decrypt(row.bank_encrypted));validateBank(bank);
  if(!row.contact_id){
   const contact=await gateway.razorpay('contacts',{name:bank.holder,type:'vendor',reference_id:id},config);
   if(!/^cont_[a-zA-Z0-9]+$/.test(contact.id))fail('Invalid payout contact response.',502);
   await db.platform.query('UPDATE wallet_payouts SET contact_id=? WHERE withdrawal_id=?',[contact.id,id]);row.contact_id=contact.id;
  }
  if(!row.fund_account_id){
   const fund=await gateway.razorpay('fund_accounts',{contact_id:row.contact_id,account_type:'bank_account',bank_account:{name:bank.holder,ifsc:bank.routing,account_number:bank.account}},config);
   if(!/^fa_[a-zA-Z0-9]+$/.test(fund.id))fail('Invalid payout bank response.',502);
   await db.platform.query('UPDATE wallet_payouts SET fund_account_id=? WHERE withdrawal_id=?',[fund.id,id]);row.fund_account_id=fund.id;
  }
  await db.platform.query("UPDATE wallet_payouts SET status='submitting',checked_at=NOW() WHERE withdrawal_id=?",[id]);
  const payout=await gateway.razorpay('payouts',{account_number:config.account_number,fund_account_id:row.fund_account_id,amount:Number(row.amount_minor),currency:row.currency,mode:'NEFT',purpose:'payout',queue_if_low_balance:true,reference_id:id,narration:'Event withdrawal'},config,{'X-Payout-Idempotency':id});
  await apply(row,payout,config);
 }catch(e){
  // Error text from providers can contain bank information; store a safe description.
  await db.platform.query("UPDATE wallet_payouts SET last_error='Awaiting bank confirmation. Check RazorpayX credentials, funding balance and payout status. Funds remain reserved.',checked_at=NOW(),status=IF(provider_id IS NULL,'unknown',status) WHERE withdrawal_id=?",[id]);
 }finally{if(acquired)await lock.query('SELECT RELEASE_LOCK(?)',['tf-payout-'+id]);lock.release();}
}
async function webhook(req,res,next){try{
 const config=await settings.get();
 if(!Buffer.isBuffer(req.body)||!config.webhook_secret||!gateway.signatureValid(req.body,req.get('x-razorpay-signature'),config.webhook_secret))return res.status(401).json({success:false,message:'Invalid payout signature.'});
 const event=JSON.parse(req.body.toString());const entity=event.payload?.payout?.entity;
 if(!event.event?.startsWith('payout.')||!entity?.id)return res.json({success:true});
 const [[row]]=await db.platform.query('SELECT withdrawal_id FROM wallet_payouts WHERE provider_id=? OR withdrawal_id=? LIMIT 1',[entity.id,entity.reference_id||'']);
 // Re-fetch the authoritative state instead of trusting the delivery order of webhooks.
 if(row)await reconcile(row.withdrawal_id);
 res.json({success:true});
 }catch(e){next(e);}}
let running=false;
async function tick(){if(running)return;running=true;try{const [rows]=await db.platform.query("SELECT withdrawal_id FROM wallet_payouts WHERE status NOT IN ('failed','cancelled','rejected','reversed') AND (checked_at IS NULL OR checked_at<DATE_SUB(NOW(),INTERVAL 1 MINUTE)) ORDER BY COALESCE(checked_at,created_at) LIMIT 25");for(const row of rows)await reconcile(row.withdrawal_id);}finally{running=false;}}
function startWorker(){const timer=setInterval(()=>tick().catch(()=>console.error('Bank payout reconciliation needs attention.')),60000);timer.unref();}
module.exports={prepare,reconcile,webhook,startWorker,tick,validateBank};
