const crypto=require('node:crypto');
const db=require('../config/db');
const {sqlName}=require('../saas/provision');
const settings=require('../saas/paymentSettings');
const gateway=require('../saas/payments');
const {fail}=require('./studioValidation');
const wallet=require('./eventWallet');
const table=sqlName(db.database)+'.booking_payments';
const central=name=>sqlName(db.database)+'.'+name;
const hash=token=>crypto.createHash('sha256').update(token).digest('hex');
function tokenHash(token){if(typeof token!=='string'||!/^[a-zA-Z0-9-]{32,80}$/.test(token))fail('A valid checkout reference is required.');return hash(token);}
async function lockedConfig(conn){
 const wrapped={query:(sql,args)=>conn.query(sql.replaceAll('platform_settings',central('platform_settings')),args)};
 await settings.lock(wrapped);return settings.get(wrapped);
}
async function register(conn,p){
 await conn.query(`INSERT INTO ${table}(id,organization_id,event_id,order_id,request_hash,key_id,mode,amount_minor,currency,expires_at) VALUES (?,?,?,?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))`,
 [p.id,db.current().id,p.event_id,p.order_id,p.request_hash,p.gateway.key_id,p.gateway.key_id.startsWith('rzp_live_')?'live':'test',p.amount_minor,p.currency]);
}
async function findToken(token){const [[p]]=await db.platform.query('SELECT *,expires_at>NOW() can_pay FROM booking_payments WHERE organization_id=? AND request_hash=?',[db.current().id,tokenHash(token)]);if(!p)fail('Checkout not found.',404);return p;}
async function configFor(p){const config=await settings.get();if(config.key_id!==p.key_id)fail('This payment needs platform support: the gateway account has changed.',409);return config;}
async function create(payload,token){
 const request_hash=tokenHash(token);
 const [[prior]]=await db.query('SELECT id,event_id,status FROM orders WHERE checkout_request_hash=?',[request_hash]);
 if(prior && prior.event_id!==Number(payload.event_id))fail('This checkout belongs to another event.',409);
 if(prior?.status==='paid'){const order=await require('../models/Order').findById(prior.id);return {paid:true,order,tickets:await require('../models/Ticket').findByOrderId(prior.id)};}
 let [[p]]=await db.platform.query('SELECT *,expires_at>NOW() can_pay FROM booking_payments WHERE organization_id=? AND request_hash=?',[db.current().id,request_hash]);
 if(!p){
  let result;
  try{result=await require('../models/Order').createWithTickets({...payload,payment:{id:crypto.randomUUID(),request_hash}});}
  catch(e){if(e.code!=='ER_DUP_ENTRY')throw e;const [[existing]]=await db.query('SELECT id,status FROM orders WHERE checkout_request_hash=?',[request_hash]);if(existing?.status==='paid')return {paid:true,order:await require('../models/Order').findById(existing.id),tickets:await require('../models/Ticket').findByOrderId(existing.id)};}
  if(result?.order.status==='paid')return {paid:true,...result};
  [[p]]=await db.platform.query('SELECT *,expires_at>NOW() can_pay FROM booking_payments WHERE organization_id=? AND request_hash=?',[db.current().id,request_hash]);
 }
 if(!p)fail('Could not prepare checkout.',409);
 if(Number(payload.event_id)!==p.event_id)fail('This checkout belongs to another event.',409);
 // Only the transaction which just created the booking may create its provider order.
 // A named claim is atomic and retained on unknown network outcomes.
 const [claim]=await db.platform.query("UPDATE booking_payments SET status='review' WHERE id=? AND status='creating'",[p.id]);
 if(claim.affectedRows){
  const config=await configFor(p);
  const provider=await gateway.razorpay('orders',{amount:Number(p.amount_minor),currency:p.currency,receipt:p.id,notes:{booking_payment_id:p.id,organization_id:String(p.organization_id)}},config);
  if(!provider.id||Number(provider.amount)!==Number(p.amount_minor)||provider.currency!==p.currency)fail('Payment provider returned an unexpected order.',502);
  await db.platform.query("UPDATE booking_payments SET provider_order_id=?,status=IF(status='review','pending',status) WHERE id=?",[provider.id,p.id]);
 }
 return checkout(await findToken(token));
}
async function checkout(p){
 const order=await require('../models/Order').findById(p.order_id);
 const [reserved]=await db.query('SELECT ticket_type_id,qty,design_json FROM booking_reserved_items WHERE order_id=?',[p.order_id]);
 const items=reserved.map(r=>{const design=JSON.parse(r.design_json);return {ticket_type_id:r.ticket_type_id,qty:r.qty,name:design.type_name,price:design.price};});
 return {attendees:await require('./attendees').forOrder(p.order_id),items,paid:p.status==='paid',order,tickets:p.status==='paid'?await require('../models/Ticket').findByOrderId(p.order_id):[],payment:{id:p.id,status:p.status,can_pay:Boolean(p.can_pay&&!p.provider_payment_id&&['pending','review'].includes(p.status)),order_id:p.provider_order_id,key:p.key_id,amount:Number(p.amount_minor),currency:p.currency,mode:p.mode,expires_at:p.expires_at}};
}
async function tenant(p,fn){const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[p.organization_id]);if(!org)fail('Organizer not found.',404);return db.run(org,fn);}
async function transaction(p,fn){return tenant(p,async()=>{const conn=await db.getConnection();try{await conn.beginTransaction();await conn.query('SELECT id FROM events WHERE id=? FOR UPDATE',[p.event_id]);const [[fresh]]=await conn.query(`SELECT *,expires_at<=NOW() expired FROM ${table} WHERE id=? FOR UPDATE`,[p.id]);const result=await fn(conn,fresh);await conn.commit();return result;}catch(e){await conn.rollback();throw e;}finally{conn.release();}});}
async function expire(p){return transaction(p,async(conn,fresh)=>{
 if(!fresh.expired||!['creating','pending','review'].includes(fresh.status)||fresh.provider_payment_id)return;
 const [items]=await conn.query('SELECT * FROM booking_reserved_items WHERE order_id=?',[fresh.order_id]);
 for(const item of items)await require('../models/TicketType').release(item.ticket_type_id,item.qty,conn);
 await conn.query("UPDATE orders SET status='cancelled' WHERE id=? AND status='pending'",[fresh.order_id]);
 await conn.query(`UPDATE ${table} SET status='expired' WHERE id=?`,[fresh.id]);
});}
async function fulfill(payment,config){
 if(payment.status!=='captured'||payment.captured!==true)fail('Payment is awaiting capture. Check payment again shortly.',409);
 const order=await gateway.razorpay('orders/'+encodeURIComponent(payment.order_id),undefined,config);
 const [[p]]=await db.platform.query('SELECT * FROM booking_payments WHERE id=?',[order.receipt]);
 if(!p)return false;
 if(config.key_id!==p.key_id||order.id!==payment.order_id||Number(payment.amount)!==Number(p.amount_minor)||Number(order.amount)!==Number(p.amount_minor)||payment.currency!==p.currency||order.currency!==p.currency||order.status!=='paid'||(p.provider_order_id&&p.provider_order_id!==order.id))fail('Payment amount, currency or account does not match this booking.',409);
 await transaction(p,async(conn,fresh)=>{
  if(['paid','refund_pending','refunded'].includes(fresh.status)){if(fresh.provider_payment_id!==payment.id)fail('A different payment is already linked to this booking.',409);return;}
  if(fresh.status==='expired'){
   await conn.query(`UPDATE ${table} SET status='review',provider_order_id=?,provider_payment_id=? WHERE id=?`,[order.id,payment.id,p.id]);return;
  }
  // Review with a recorded payment denotes a late capture needing a refund, not fulfillment.
  if(fresh.status==='review'&&fresh.provider_payment_id)return;
  const [[booking]]=await conn.query('SELECT * FROM orders WHERE id=? FOR UPDATE',[p.order_id]);
  if(booking.status!=='pending')fail('Booking needs payment review.',409);
  const [items]=await conn.query('SELECT * FROM booking_reserved_items WHERE order_id=? ORDER BY ticket_type_id',[p.order_id]);
  const attendees=await require('./attendees').forOrder(p.order_id,conn);
  for(const item of items){
   const people=attendees.filter(a=>a.ticket_type_id===item.ticket_type_id);
   if(attendees.length&&people.length!==item.qty)fail('Attendee details do not match the reserved tickets.',409);
   for(let i=0;i<item.qty;i++)await require('../models/Ticket').create({order_id:p.order_id,ticket_type_id:item.ticket_type_id,attendee_name:people[i]?.name||booking.customer_name,attendee_id:people[i]?.id||null,design_snapshot:JSON.parse(item.design_json),email_snapshot:item.email_snapshot?JSON.parse(item.email_snapshot):null},conn);
  }
  await conn.query("UPDATE orders SET status='paid' WHERE id=?",[p.order_id]);
  await wallet.credit(conn,p.order_id);
  await conn.query(`UPDATE ${table} SET status='paid',provider_order_id=?,provider_payment_id=? WHERE id=?`,[order.id,payment.id,p.id]);
  await require('./mailer').enqueue(conn,p.order_id,'booking_confirmed');
 });
 return true;
}
async function reconcile(p){
 if(['paid','refunded'].includes(p.status))return;
 const config=await configFor(p);
 if(!p.provider_order_id){
  const result=await gateway.razorpay('orders?receipt='+encodeURIComponent(p.id),undefined,config);
  const matches=(result.items||[]).filter(x=>x.receipt===p.id&&Number(x.amount)===Number(p.amount_minor)&&x.currency===p.currency);
  if(matches.length!==1){await expire(p);return;}
  p.provider_order_id=matches[0].id;
  await db.platform.query('UPDATE booking_payments SET provider_order_id=? WHERE id=? AND provider_order_id IS NULL',[p.provider_order_id,p.id]);
 }
 if(p.status==='refund_pending'&&!p.provider_refund_id){await refund(p.id);return;}
 if(p.status==='refund_pending'&&p.provider_refund_id){await processedRefund(await gateway.razorpay('refunds/'+encodeURIComponent(p.provider_refund_id),undefined,config));return;}
 const result=await gateway.razorpay('orders/'+encodeURIComponent(p.provider_order_id)+'/payments',undefined,config);
 const captured=(result.items||[]).find(x=>x.status==='captured'&&x.captured===true);
 if(captured)await fulfill(captured,config);else await expire(p);
}
async function verify(token,input){
 const p=await findToken(token),config=await configFor(p);
 if(!p.provider_order_id||input.razorpay_order_id!==p.provider_order_id||!gateway.signatureValid(p.provider_order_id+'|'+input.razorpay_payment_id,input.razorpay_signature,config.key_secret))fail('Payment signature is invalid.',400);
 const payment=await gateway.razorpay('payments/'+encodeURIComponent(input.razorpay_payment_id),undefined,config);
 if(payment.order_id!==p.provider_order_id)fail('Payment belongs to another booking.',400);
 await fulfill(payment,config);return checkout(await findToken(token));
}
async function resume(token){let p=await findToken(token);await reconcile(p);return checkout(await findToken(token));}
async function refund(id){
 const [[p]]=await db.platform.query('SELECT * FROM booking_payments WHERE id=?',[id]);if(!p)fail('Payment not found.',404);
 const config=await configFor(p);
 await transaction(p,async(conn,fresh)=>{
  if(fresh.status==='refunded')return;
  if(!['paid','refund_pending','review'].includes(fresh.status)||!fresh.provider_payment_id)fail('A captured payment is required before refunding.',409);
  await conn.query(`UPDATE ${table} SET status='refund_pending' WHERE id=?`,[p.id]);
 });
 if(p.status==='refunded')return {status:'refunded'};
 const result=await gateway.razorpay('payments/'+encodeURIComponent(p.provider_payment_id)+'/refund',{amount:Number(p.amount_minor),speed:'normal',receipt:p.id},config,{'X-Refund-Idempotency':p.id});
 if(result.payment_id!==p.provider_payment_id||Number(result.amount)!==Number(p.amount_minor))fail('Refund needs provider review.',409);
 await db.platform.query('UPDATE booking_payments SET provider_refund_id=? WHERE id=?',[result.id,p.id]);
 await processedRefund(result);
 const [[latest]]=await db.platform.query('SELECT status FROM booking_payments WHERE id=?',[p.id]);return latest;
}
async function processedRefund(refund){
 const [[p]]=await db.platform.query('SELECT * FROM booking_payments WHERE provider_payment_id=?',[refund.payment_id]);if(!p)return false;
 // Never accept partial/unverified reversals as a full refund.
 if(refund.status!=='processed')return true;
 if(Number(refund.amount)!==Number(p.amount_minor)){
  await transaction(p,async(conn,fresh)=>{if(fresh.status!=='refunded'){await conn.query(`UPDATE ${table} SET status='review' WHERE id=?`,[p.id]);await conn.query(`INSERT INTO ${central('platform_audit')}(organization_id,action,details_json) VALUES (?,'payment.review',?)`,[p.organization_id,JSON.stringify({booking_payment_id:p.id,reason:'partial_refund',refund_id:refund.id})]);}});
  return true;
 }
 await transaction(p,async(conn,fresh)=>{
  if(fresh.status==='refunded')return;
  const [[order]]=await conn.query('SELECT * FROM orders WHERE id=? FOR UPDATE',[p.order_id]);
  if(order.status==='paid'){
   await conn.query("UPDATE tickets SET status='cancelled',checked_in_at=NULL WHERE order_id=?",[p.order_id]);
   const [items]=await conn.query('SELECT * FROM booking_reserved_items WHERE order_id=?',[p.order_id]);
   for(const item of items)await require('../models/TicketType').release(item.ticket_type_id,item.qty,conn);
   await wallet.reverse(conn,p.order_id,'refunded');
   await conn.query("UPDATE orders SET status='refunded' WHERE id=?",[p.order_id]);
   await require('./mailer').enqueue(conn,p.order_id,'booking_refunded');
  }
  await conn.query(`UPDATE ${table} SET status='refunded',provider_refund_id=? WHERE id=?`,[refund.id,p.id]);
 });return true;
}
async function cancelOrder(orderId){
 const [[p]]=await db.platform.query('SELECT * FROM booking_payments WHERE organization_id=? AND order_id=?',[db.current().id,orderId]);
 if(!p)fail('Gateway booking not found.',404);
 if(['creating','pending'].includes(p.status)){await reconcile(p);fail('Payment is pending. Unpaid reservations expire automatically after 15 minutes.',409);}
 return refund(p.id);
}
async function webhookEvent(event,config){
 if(event.event==='payment.dispute.created'){
  const paymentId=event.payload?.dispute?.entity?.payment_id;
  const [[p]]=await db.platform.query('SELECT * FROM booking_payments WHERE provider_payment_id=?',[paymentId||'']);
  if(!p)return false;
  await transaction(p,async(conn,fresh)=>{if(fresh.status!=='refunded'){await conn.query(`UPDATE ${table} SET status='review' WHERE id=?`,[p.id]);await conn.query(`INSERT INTO ${central('platform_audit')}(organization_id,action,details_json) VALUES (?,'payment.review',?)`,[p.organization_id,JSON.stringify({booking_payment_id:p.id,reason:'dispute',payment_id:paymentId})]);}});
  return true;
 }

 if(['payment.captured','order.paid'].includes(event.event)&&event.payload?.payment?.entity)return fulfill(event.payload.payment.entity,config);
 if(event.event==='refund.processed'&&event.payload?.refund?.entity){
  const entity=event.payload.refund.entity;
  const [[p]]=await db.platform.query('SELECT id FROM booking_payments WHERE provider_payment_id=?',[entity.payment_id]);
  if(!p)return false;
  return processedRefund(await gateway.razorpay('refunds/'+encodeURIComponent(entity.id),undefined,config));
 }
 return false;
}
let working=false;
async function sweep(){if(working)return;working=true;try{const [rows]=await db.platform.query("SELECT * FROM booking_payments WHERE status IN ('creating','pending','review','refund_pending') ORDER BY updated_at LIMIT 25");for(const p of rows){try{await db.platform.query('UPDATE booking_payments SET updated_at=NOW() WHERE id=?',[p.id]);await reconcile(p);}catch{await expire(p).catch(()=>{});}}}finally{working=false;}}
function startWorker(){const timer=setInterval(()=>sweep().catch(()=>{}),60000);timer.unref();}
module.exports={lockedConfig,register,create,resume,verify,refund,cancelOrder,webhookEvent,fulfill,processedRefund,expire,sweep,startWorker,central};
