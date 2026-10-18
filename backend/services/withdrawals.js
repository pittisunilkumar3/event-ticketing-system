const crypto=require('node:crypto');
const db=require('../config/db');
const {sqlName}=require('../saas/provision');
const {encrypt,decrypt}=require('./secrets');
const {fail,string}=require('./studioValidation');
const {minorUnits,decimal}=require('./eventWallet');
const table=sqlName(db.database)+'.wallet_withdrawals';
const audit=sqlName(db.database)+'.platform_audit';
const select='id,organization_id,event_id,event_title,amount,currency,status,bank_last4,requested_by,reviewed_by,review_note,transfer_reference,created_at,reviewed_at,paid_at';
async function funds(conn,eventId){
 const [[balance]]=await conn.query("SELECT COALESCE(SUM(amount),0) balance FROM event_wallet_entries WHERE event_id=? AND mode='live' AND currency='INR'",[eventId]);
 const [[held]]=await conn.query(`SELECT COALESCE(SUM(amount),0) held FROM ${table} WHERE organization_id=? AND event_id=? AND currency='INR' AND status IN ('pending','approved')`,[db.current().id,eventId]);
 const [[refunds]]=await conn.query(`SELECT COALESCE(SUM(p.amount_minor)/100,0) amount FROM ${sqlName(db.database)}.booking_payments p JOIN orders o ON o.id=p.order_id WHERE p.organization_id=? AND p.event_id=? AND p.mode='live' AND p.currency='INR' AND p.status IN ('refund_pending','review') AND o.status='paid'`,[db.current().id,eventId]);
 // Refunds may make a previously paid-out wallet negative. Do not hide the deficit.
 return {balance:Number(balance.balance),held:Number(held.held),refund_held:Number(refunds.amount),available:Number((Number(balance.balance)-Number(held.held)-Number(refunds.amount)).toFixed(2))};
}
async function request(input,actor){
 const eventId=Number(input.event_id);if(!Number.isSafeInteger(eventId)||eventId<1)fail('Choose an event.');
 const amount=decimal(minorUnits(input.amount));if(Number(amount)<=0)fail('Enter an amount greater than zero.');
 const key=string(input.request_key,'Request reference',80,true);if(!/^[a-zA-Z0-9-]{16,80}$/.test(key))fail('Invalid request reference.');
 const bank={holder:string(input.holder,'Account holder',150,true),bank_name:string(input.bank_name,'Bank name',150,true),account:string(input.account,'Account number / IBAN',50,true).replace(/\s/g,''),routing:string(input.routing,'Routing code / SWIFT',50,true),country:string(input.country,'Bank country',60,true)};
 bank.routing=bank.routing.toUpperCase();
 require('./bankPayouts').validateBank(bank);
 if(Number(amount)<1)fail('The minimum withdrawal is ₹1.');
 const conn=await db.getConnection();try{
  await conn.beginTransaction();const [[event]]=await conn.query('SELECT id,title FROM events WHERE id=? FOR UPDATE',[eventId]);if(!event)fail('Event not found.',404);
  const [[old]]=await conn.query(`SELECT ${select} FROM ${table} WHERE organization_id=? AND request_key=?`,[db.current().id,key]);
  if(old){if(old.event_id!==eventId||Number(old.amount)!==Number(amount))fail('This request reference has already been used.',409);await conn.commit();return old;}
  const available=await funds(conn,eventId);if(Number(amount)>available.available)fail('The amount exceeds this event’s available live balance.',409);
  const id=crypto.randomUUID();await conn.query(`INSERT INTO ${table}(id,organization_id,event_id,event_title,amount,currency,request_key,bank_encrypted,bank_last4,requested_by) VALUES (?,?,?,?,?,'INR',?,?,?,?)`,[id,db.current().id,eventId,event.title,amount,key,encrypt(JSON.stringify(bank)),bank.account.slice(-4),actor]);
  await conn.query(`INSERT INTO ${audit}(organization_id,action,details_json) VALUES (?,'withdrawal.requested',?)`,[db.current().id,JSON.stringify({withdrawal_id:id,event_id:eventId,amount,requested_by:actor})]);
  await conn.commit();return {id,status:'pending'};
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function list(orgId){
 const fields=select.split(',').map(f=>'w.'+f).join(',');
 const [rows]=await db.platform.query(`SELECT ${fields},p.status payout_status,p.provider_id payout_id,p.utr,p.last_error payout_message FROM wallet_withdrawals w LEFT JOIN wallet_payouts p ON p.withdrawal_id=w.id${orgId?' WHERE w.organization_id=?':''} ORDER BY w.created_at DESC LIMIT 100`,orgId?[orgId]:[]);return rows;
}
async function review(id,input,actor,orgId){
 const [[row]]=await db.platform.query('SELECT * FROM wallet_withdrawals WHERE id=?'+(orgId?' AND organization_id=?':''),orgId?[id,orgId]:[id]);if(!row)fail('Withdrawal request not found.',404);
 const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[row.organization_id]);
 const action=input.action;if(!(orgId?['cancel']:['approve','reject']).includes(action))fail('Choose a valid withdrawal action.');
 const note=string(input.note||'','Review note',500,action==='reject');
 await db.run(org,async()=>{const conn=await db.getConnection();try{
  await conn.beginTransaction();await conn.query('SELECT id FROM events WHERE id=? FOR UPDATE',[row.event_id]);
  const [[fresh]]=await conn.query(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`,[id]);
  const [[payout]]=await conn.query(`SELECT withdrawal_id FROM ${sqlName(db.database)}.wallet_payouts WHERE withdrawal_id=?`,[id]);
  if(payout){if(action==='approve'){await conn.commit();return;}fail('The bank transfer has already started. Wait for bank confirmation.',409);}
  const allowed={approve:['pending','approved'],reject:['pending','approved'],cancel:['pending']};
  if(!allowed[action].includes(fresh.status))fail('This request has already changed. Refresh before continuing.',409);
  if(action==='approve'){
   const [[organization]]=await conn.query(`SELECT status FROM ${sqlName(db.database)}.organizations WHERE id=? FOR UPDATE`,[org.id]);
   if(organization.status!=='active')fail('This organization is suspended. Resolve the account status first.',409);
   const current=await funds(conn,fresh.event_id);if(current.available<0)fail('Refunds have reduced this event’s balance. Resolve outstanding requests before paying.',409);
   await require('./bankPayouts').prepare(conn,fresh);
  }
  const status={approve:'approved',reject:'rejected',cancel:'cancelled'}[action];
  await conn.query(`UPDATE ${table} SET status=?,reviewed_by=?,review_note=?,reviewed_at=NOW() WHERE id=?`,[status,orgId?null:actor,note||null,id]);
  await conn.query(`INSERT INTO ${audit}(actor_id,organization_id,action,details_json) VALUES (?,?,?,?)`,[orgId?null:actor,org.id,'withdrawal.'+status,JSON.stringify({withdrawal_id:id,amount:fresh.amount,currency:fresh.currency,event_id:fresh.event_id,note})]);
  await conn.commit();
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}});
 if(action==='approve')await require('./bankPayouts').reconcile(id);
 return (await list(org.id)).find(r=>r.id===id)||{id};
}
async function detail(id,actor){const [[row]]=await db.platform.query('SELECT * FROM wallet_withdrawals WHERE id=?',[id]);if(!row)fail('Withdrawal not found.',404);await db.platform.query("INSERT INTO platform_audit(actor_id,organization_id,action,details_json) VALUES (?,?,'withdrawal.bank_viewed',?)",[actor,row.organization_id,JSON.stringify({withdrawal_id:id})]);const bank=JSON.parse(decrypt(row.bank_encrypted));return {bank};}
module.exports={request,list,review,detail,funds};
