const crypto = require('node:crypto');
const db = require('../config/db');
const { fail } = require('../services/studioValidation');
const paymentSettings = require('./paymentSettings');
async function configured(){return paymentSettings.safe(await paymentSettings.get()).configured;}
function signatureValid(payload, signature, secret) {
  if(!secret || typeof signature!=='string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected=crypto.createHmac('sha256',secret).update(payload).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
async function razorpay(path,body,config,extraHeaders={}) {
  config ||= await paymentSettings.get();
  if(path==='orders'&&body)paymentSettings.assertLiveCheckout(config);
  if(!config.key_id || !config.key_secret) fail('Razorpay is not configured. Contact the platform administrator.',503);
  const response=await fetch('https://api.razorpay.com/v1/'+path,{
    method:body?'POST':'GET',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Basic '+Buffer.from(`${config.key_id}:${config.key_secret}`).toString('base64'),'Content-Type':'application/json',...extraHeaders},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  if(!response.ok) fail('Payment provider could not complete the request. Please try again.',502);
  return response.json();
}
async function createPurchase(orgId,packageId,requestKey) {
  if(typeof requestKey!=='string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey)) fail('A valid purchase reference is required.');
  // Serialize order creation for a request reference. The local purchase survives uncertain provider outcomes.
  const conn=await db.platform.getConnection();let purchase,config;
  try {
    await conn.beginTransaction();
    await paymentSettings.lock(conn);
    config=await paymentSettings.get(conn);
    paymentSettings.assertLiveCheckout(config);
    if(!config.key_id || !config.key_secret) fail('Online payments are not available yet. Contact the platform administrator.',503);
    const [[org]]=await conn.query('SELECT status FROM organizations WHERE id=? FOR UPDATE',[orgId]);
    if(org?.status!=='active') fail('This organizer cannot buy packages.',403);
    const [[existing]]=await conn.query('SELECT * FROM package_purchases WHERE organization_id=? AND request_key=?',[orgId,requestKey]);
    if(existing){if(existing.package_id!==Number(packageId)) fail("This purchase reference belongs to another package.",409);purchase=existing;}
    else {
      const [[pack]]=await conn.query('SELECT * FROM event_packages WHERE id=? AND active=TRUE',[packageId]);
      if(!pack || !pack.price_paise) fail('This package is not available for purchase.',409);
      purchase={id:crypto.randomUUID(),organization_id:orgId,package_id:pack.id,package_name:pack.name,event_count:pack.event_count,amount_paise:pack.price_paise,currency:'INR',status:'pending'};
      await conn.query('INSERT INTO package_purchases(id,organization_id,package_id,package_name,event_count,amount_paise,request_key) VALUES (?,?,?,?,?,?,?)',[purchase.id,orgId,pack.id,pack.name,pack.event_count,pack.price_paise,requestKey]);
    }
    await conn.commit();
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
  if(purchase.status==='paid') return {purchase,paid:true};
  if(!purchase.provider_order_id){
    const [claim]=await db.platform.query("UPDATE package_purchases SET status='review' WHERE id=? AND status='pending' AND provider_order_id IS NULL",[purchase.id]);
    if(!claim.affectedRows) fail('This payment is being prepared. Refresh your purchases before trying again.',409);
    try {
      const order=await razorpay('orders',{amount:purchase.amount_paise,currency:'INR',receipt:purchase.id,notes:{purchase_id:purchase.id}},config);
      await db.platform.query("UPDATE package_purchases SET provider_order_id=?,status=IF(status='paid','paid','pending') WHERE id=?",[order.id,purchase.id]);
      purchase.provider_order_id=order.id;
    }catch(e){
      // Do not blindly recreate an order after an uncertain network result; a signed webhook can recover it by receipt.
      throw e;
    }
  }
  const [[latest]]=await db.platform.query('SELECT * FROM package_purchases WHERE id=?',[purchase.id]);
  return {purchase:latest,paid:latest.status==='paid',key:config.key_id};
}
async function fulfill(payment,config) {
  if(payment.status!=='captured' || !payment.captured) fail('Payment is not captured yet. Your balance will update once confirmed.',409);
  if(!payment.order_id || !payment.id) fail('Invalid payment.',400);
  // Server-to-server order lookup also recovers an order creation response lost in transit.
  const order=await razorpay('orders/'+encodeURIComponent(payment.order_id),undefined,config);
  const conn=await db.platform.getConnection();
  try {
    await conn.beginTransaction();
    const [[owner]]=await conn.query('SELECT organization_id FROM package_purchases WHERE id=?',[order.receipt]);
    if(!owner) fail('Package purchase not found.',404);
    await conn.query('SELECT id FROM organizations WHERE id=? FOR UPDATE',[owner.organization_id]);
    const [[purchase]]=await conn.query('SELECT * FROM package_purchases WHERE id=? FOR UPDATE',[order.receipt]);
    if(!purchase) fail('Package purchase not found.',404);
    if(order.id!==payment.order_id || purchase.amount_paise!==payment.amount || payment.currency!=='INR' || order.amount!==purchase.amount_paise || order.currency!=='INR' || order.status!=='paid' || (purchase.provider_order_id && purchase.provider_order_id!==payment.order_id)) fail('Payment does not match this purchase.',409);
    if(purchase.status!=='paid') {
      await conn.query('SELECT id FROM organizations WHERE id=? FOR UPDATE',[purchase.organization_id]);
      await conn.query("UPDATE package_purchases SET status='paid',provider_order_id=?,provider_payment_id=?,paid_at=NOW() WHERE id=?",[payment.order_id,payment.id,purchase.id]);
      await conn.query('UPDATE organizations SET event_balance=event_balance+? WHERE id=?',[purchase.event_count,purchase.organization_id]);
      await conn.query("INSERT INTO event_credits(organization_id,amount,kind,reason,reference_key) VALUES (?,?,'purchase',?,?)",[purchase.organization_id,purchase.event_count,purchase.package_name,'purchase:'+purchase.id]);
      await conn.query("INSERT INTO platform_audit(organization_id,action,details_json) VALUES (?,'purchase.paid',?)",[purchase.organization_id,JSON.stringify({purchase_id:purchase.id,payment_id:payment.id})]);
      const [[org]]=await conn.query('SELECT * FROM organizations WHERE id=?',[purchase.organization_id]);
      const values={organization_name:org.name,owner_name:org.name,owner_email:org.owner_email,workspace_url:require('./provision').siteUrl(org)+'/admin',site_url:require('./provision').siteUrl(org),package_name:purchase.package_name,event_count:purchase.event_count,amount:new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(purchase.amount_paise/100),purchase_id:purchase.id,payment_id:payment.id,paid_at:new Date().toISOString().slice(0,10)};
      await require('./platformMail').enqueue(conn,'payment_receipt',org.id,org.owner_email,values,'purchase:'+purchase.id);
      await require('./platformMail').enqueue(conn,'payment_alert',org.id,null,values,'purchase:'+purchase.id);
    }
    await conn.commit();
    return purchase.id;
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function verify(orgId,input){
  const config=await paymentSettings.get();
  const [[purchase]]=await db.platform.query('SELECT * FROM package_purchases WHERE id=? AND organization_id=?',[input.purchase_id,orgId]);
  if(!purchase || !purchase.provider_order_id) fail('Purchase not found.',404);
  if(!signatureValid(purchase.provider_order_id+'|'+input.razorpay_payment_id,input.razorpay_signature,config.key_secret)) fail('Payment signature is invalid.',400);
  if(input.razorpay_order_id!==purchase.provider_order_id) fail('Payment order does not match.',400);
  const payment=await razorpay('payments/'+encodeURIComponent(input.razorpay_payment_id),undefined,config);
  if(payment.order_id!==purchase.provider_order_id) fail('Payment belongs to another order.',400);
  await fulfill(payment,config);
}
// Recover a missed callback/webhook or a lost order-creation response without
// ever granting credits based on a browser claim or creating a second order.
async function reconcile(id,orgId){
 const config=await paymentSettings.get();
 const [[purchase]]=await db.platform.query('SELECT * FROM package_purchases WHERE id=?'+(orgId?' AND organization_id=?':''),orgId?[id,orgId]:[id]);
 if(!purchase)fail('Purchase not found.',404);
 if(purchase.status==='paid')return {status:'paid'};
 let orderId=purchase.provider_order_id;
 if(!orderId){
  const result=await razorpay('orders?receipt='+encodeURIComponent(purchase.id),undefined,config);
  const matches=(result.items||[]).filter(o=>o.receipt===purchase.id&&o.amount===purchase.amount_paise&&o.currency==='INR');
  if(matches.length!==1)fail('The provider order needs review. No credits have been changed. Contact platform support.',409);
  orderId=matches[0].id;
  await db.platform.query("UPDATE package_purchases SET provider_order_id=?,status=IF(status='paid','paid','pending') WHERE id=? AND provider_order_id IS NULL AND status<>'paid'",[orderId,id]);
 }
 const result=await razorpay('orders/'+encodeURIComponent(orderId)+'/payments',undefined,config);
 const captured=(result.items||[]).find(p=>p.order_id===orderId&&p.status==='captured'&&p.captured);
 if(!captured)return {status:'pending'};
 await fulfill(captured,config);
 return {status:'paid'};
}
async function webhook(req,res,next){
 try {
  const config=await paymentSettings.get();
  if(!signatureValid(req.body,req.get('x-razorpay-signature'),config.webhook_secret)) fail('Invalid webhook signature.',400);
  const event=JSON.parse(req.body.toString('utf8'));
  if(await require('../services/bookingPayments').webhookEvent(event,config)){res.json({success:true});return;}
  if(event.event==='payment.captured') await fulfill(event.payload.payment.entity,config);
  if(event.event==='order.paid' && event.payload.payment) await fulfill(event.payload.payment.entity,config);
  if(['refund.processed','payment.dispute.created'].includes(event.event)) {
    // Financial reversals require review; used event allowances and attendees must not be silently invalidated.
    await db.platform.query("INSERT INTO platform_audit(action,details_json) VALUES ('payment.review',?)",[JSON.stringify({event:event.event,event_id:req.get('x-razorpay-event-id') || null,payment_id:event.payload?.refund?.entity?.payment_id || event.payload?.dispute?.entity?.payment_id})]);
  }
  res.json({success:true});
 }catch(e){next(e);}
}
module.exports={razorpay,configured,signatureValid,createPurchase,verify,webhook,fulfill,reconcile};
