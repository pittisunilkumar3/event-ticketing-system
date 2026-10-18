// Disposable databases only; no real email or payment provider is contacted.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
process.env.DB_NAME=`tf_gateway_test_${Date.now()}_${process.pid}`;process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.SETTINGS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');delete process.env.BASE_DOMAIN;
const db=require('../config/db'),{migrateTenant,migratePlatform,sqlName}=require('../saas/provision');let server,connection,total=0;const pass=message=>{total++;console.log('PASS '+message);};
(async()=>{
 await migrateTenant(db.database);await migratePlatform();server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function req(path,method='GET',body,token,status=200,bookingToken){const r=await fetch(base+path,{method,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...(bookingToken?{'x-booking-token':bookingToken}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});const json=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(json));return json.data;}

 const nativeFetch=global.fetch,orders=new Map(),payments=new Map(),refunds=new Map(),payouts=new Map(),payoutBodies=new Map();let sequence=0,dropCreate=false,refundDelay=false,dropPayout=false,qaReady=false;
 global.fetch=async(url,options={})=>{
  if(!String(url).startsWith('https://api.razorpay.com/v1/'))return nativeFetch(url,options);
  const path=String(url).split('/v1/')[1],body=options.body?JSON.parse(options.body):null;
  if(path==='contacts'&&body)return Response.json({id:'cont_'+body.reference_id.replaceAll('-','')});
  if(path==='fund_accounts'&&body)return Response.json({id:'fa_'+body.contact_id.slice(5)});
  if(path==='payouts'&&body){
   assert.ok(options.headers['X-Payout-Idempotency']);const key=options.headers['X-Payout-Idempotency'];
   assert.equal(body.currency,'INR');assert.equal(body.mode,'NEFT');
   if(payoutBodies.has(key))assert.deepEqual(body,payoutBodies.get(key));else payoutBodies.set(key,body);
   let payout=payouts.get(key);if(!payout){payout={...body,id:'pout_'+(++sequence),status:'processing',debit_account_number:body.account_number};payouts.set(key,payout);}
   if(dropPayout){dropPayout=false;throw new Error('Simulated lost payout response');}return Response.json(payout);
  }
  if(/^payouts\/[^/]+$/.test(path)){const p=[...payouts.values()].find(p=>p.id===path.split('/')[1]);if(qaReady&&p.status==='processing'){p.status='processed';p.utr='QA-BANK-TRANSFER';}return Response.json(p);}
  if(path==='orders'&&body){const order={id:'order_'+(++sequence),...body,status:'created'};orders.set(order.id,order);if(dropCreate){dropCreate=false;throw new Error('Simulated lost response');}return Response.json(order);}
  if(path.startsWith('orders?receipt='))return Response.json({items:[...orders.values()].filter(o=>o.receipt===decodeURIComponent(path.split('=')[1]))});
  if(/^orders\/[^/]+\/payments$/.test(path))return Response.json({items:[...payments.values()].filter(p=>p.order_id===path.split('/')[1])});
  if(/^orders\/[^/]+$/.test(path))return Response.json(orders.get(path.split('/')[1]));
  if(/^payments\/[^/]+\/refund$/.test(path)){assert.ok(options.headers['X-Refund-Idempotency']);const key=options.headers['X-Refund-Idempotency'];let refund=[...refunds.values()].find(r=>r.receipt===key);if(!refund){refund={id:'rfnd_'+(++sequence),payment_id:path.split('/')[1],amount:body.amount,status:refundDelay?'pending':'processed',receipt:key};refunds.set(refund.id,refund);}return Response.json(refund);}
  if(/^payments\/[^/]+$/.test(path))return Response.json(payments.get(path.split('/')[1]));
  if(/^refunds\/[^/]+$/.test(path))return Response.json(refunds.get(path.split('/')[1]));
  throw new Error('Unexpected provider call '+path);
 };
 const tenants=[];
 for(const slug of ['gateway-alpha','gateway-bravo']){
  const created=(await req('/api/saas/signup','POST',{company_name:slug,slug,name:'Gateway Owner',email:'owner@gateway.test',password:'GatewayTestPassword!123'},null,201)).organization;
  await db.platform.query('UPDATE organizations SET event_balance=10 WHERE id=?',[created.id]);await require('./helpers/paidPackage')(db.platform,created.id,10);const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[created.id]);
  const token=(await req(`/api/o/${slug}/auth/login`,'POST',{email:'owner@gateway.test',password:'GatewayTestPassword!123'})).token;
  const t={org,token,path:`/api/o/${slug}`};
  t.event=(await req(t.path+'/admin/events','POST',{title:slug+' Event',venue:'Hall',city:'City',start_datetime:'2035-01-01 12:00:00',end_datetime:'2035-01-01 18:00:00',status:'published'},token,201)).event;
  t.type=(await req(t.path+'/admin/ticket-types','POST',{event_id:t.event.id,name:'General',price:50,quantity:100},token,201)).ticketType;
  tenants.push(t);
 }
 const [a,b]=tenants;const [pa]=await db.platform.query("INSERT INTO platform_admins(name,email,password_hash) VALUES ('Platform Tester','platform@gateway.test',?)",[await require('bcryptjs').hash('PlatformTestPassword!123',4)]);
 const pt=require('jsonwebtoken').sign({id:pa.insertId,type:'platform'},process.env.JWT_SECRET);
 const secret='fixture-secret',wh='fixture-webhook';
 const config=require('../saas/paymentSettings');
 const body=(t,key)=>({event_id:t.event.id,customer_name:'Gateway Guest',phone:'9876543210',email:'guest@gateway.test',items:[{ticket_type_id:t.type.id,qty:1,attendees:[{name:'Gateway Guest',email:'guest@gateway.test',phone:'9876543210'}]}],request_key:key,total_amount:1,payment_method:'mock'});
 await req(a.path+'/orders','POST',body(a,crypto.randomUUID()),null,503);
 await config.save({key_id:'rzp_test_fixture',key_secret:secret,webhook_secret:wh,mode:'test'},pa.insertId);
 const booking=async(t=a)=>{const token=crypto.randomUUID();const data=await req(t.path+'/orders','POST',body(t,token),null,201);return {...data,token};};
 const credit=async(t=a,mode='live')=>(await req(t.path+'/admin/wallet?mode='+mode,'GET',null,t.token)).summary;
 function capture(p,amount=p.payment.amount,currency='INR'){const order=orders.get(p.payment.order_id);order.status='paid';const pay={id:'pay_'+(++sequence),order_id:order.id,amount,currency,status:'captured',captured:true};payments.set(pay.id,pay);return pay;}
 const signature=p=>crypto.createHmac('sha256',secret).update(p.order_id+'|'+p.id).digest('hex');
 const verify=(p,pay,status=200)=>req(a.path+'/booking-payments/verify','POST',{razorpay_order_id:pay.order_id,razorpay_payment_id:pay.id,razorpay_signature:signature(pay)},null,status,p.token);
 async function webhook(event,status=200){const raw=JSON.stringify(event);const response=await nativeFetch(base+'/api/saas/razorpay/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':crypto.createHmac('sha256',wh).update(raw).digest('hex')},body:raw});assert.equal(response.status,status,await response.text());}
 const test=await booking();assert.equal(test.order.status,'pending');assert.equal(test.tickets.length,0);assert.equal((await credit()).balance,'0.00');
 const retry=await req(a.path+'/orders','POST',body(a,test.token),null,201);assert.equal(retry.order.id,test.order.id);assert.equal(orders.size,1);
 const payTest=capture(test);await req(a.path+'/booking-payments/verify','POST',{razorpay_order_id:payTest.order_id,razorpay_payment_id:payTest.id,razorpay_signature:'bad'},null,400,test.token);
 await req(b.path+'/booking-payments/status','POST',{},null,404,test.token);
 const paid=await verify(test,payTest);assert.equal(paid.tickets.length,1);assert.equal((await credit(a,'test')).balance,'50.00');assert.equal((await credit()).balance,'0.00');
 await webhook({event:'payment.captured',payload:{payment:{entity:payTest}}});assert.equal((await credit(a,'test')).bookings,1);
 const bank={event_id:a.event.id,amount:'10.00',holder:'Test Owner',bank_name:'Test Bank',account:'1234567890',routing:'HDFC0001234',country:'India',request_key:crypto.randomUUID()};
 await req(a.path+'/admin/wallet/withdrawals','POST',bank,a.token,409);
 await req('/api/platform/booking-payments/'+test.payment.id+'/refund','POST',{},pt);
 assert.equal((await credit(a,'test')).balance,'0.00');
 pass('no configured gateway fails closed; reserved stock, token isolation, verified capture, duplicate callbacks and test balances work');
 await config.save({key_id:'rzp_live_fixture',key_secret:secret,webhook_secret:wh,mode:'live'},pa.insertId);
 const live=await booking();const badAmount=capture(live,1);await verify(live,badAmount,409);payments.delete(badAmount.id);
 const badCurrency=capture(live,5000,'USD');await verify(live,badCurrency,409);payments.delete(badCurrency.id);
 const good=capture(live);
 await db.run(a.org,async()=>{await db.query("CREATE TRIGGER capture_failure BEFORE INSERT ON event_wallet_entries FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Simulated capture accounting failure'");try{await verify(live,good,500);}finally{await db.query('DROP TRIGGER capture_failure');}const [[state]]=await db.query('SELECT status FROM orders WHERE id=?',[live.order.id]);assert.equal(state.status,'pending');const [[tickets]]=await db.query('SELECT COUNT(*) n FROM tickets WHERE order_id=?',[live.order.id]);assert.equal(tickets.n,0);});
 await verify(live,good);assert.equal((await credit()).balance,'50.00');assert.equal((await credit(b)).balance,'0.00');
 const w1=await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'30.00'},a.token,201);
 const same=await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'30.00'},a.token,201);assert.equal(w1.id,same.id);
 assert.equal((await credit()).held,'30.00');assert.equal((await credit()).available,'20.00');
 await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'30.00',request_key:crypto.randomUUID()},a.token,409);
 await req(b.path+'/admin/wallet/withdrawals/'+w1.id+'/cancel','POST',{},b.token,404);
 await req('/api/platform/withdrawals/'+w1.id+'/review','POST',{action:'approve'},a.token,403);
 await req('/api/platform/withdrawals/'+w1.id+'/review','POST',{action:'approve'},pt,503);
 const payoutConfig={enabled:true,key_id:'rzp_live_payoutfixture',key_secret:'payout-secret',webhook_secret:'payout-webhook',account_number:'123456789000'};
 await req('/api/platform/settings/payouts','PUT',payoutConfig,a.token,403);
 const safeConfig=await req('/api/platform/settings/payouts','PUT',payoutConfig,pt);assert.equal(safeConfig.payout.key_secret,undefined);assert.equal(safeConfig.payout.account_number,undefined);
 await Promise.all([1,2].map(()=>req('/api/platform/withdrawals/'+w1.id+'/review','POST',{action:'approve'},pt)));
 assert.equal(payouts.size,1);
 await req('/api/platform/withdrawals/'+w1.id+'/review','POST',{action:'reject',note:'Cannot cancel a dispatched transfer'},pt,409);
 await req(a.path+'/admin/wallet/withdrawals/'+w1.id+'/cancel','POST',{},a.token,409);
 assert.equal((await credit()).balance,'50.00');
 await req('/api/platform/withdrawals/'+w1.id+'/review','POST',{action:'paid',transfer_reference:'MANUAL-BYPASS'},pt,400);
 const bankWebhook=async(entity,valid=true)=>{const raw=JSON.stringify({event:'payout.'+entity.status,payload:{payout:{entity}}});const r=await nativeFetch(base+'/api/saas/razorpayx/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':valid?crypto.createHmac('sha256','payout-webhook').update(raw).digest('hex'):'bad'},body:raw});assert.equal(r.status,valid?200:401);};
 const firstPayout=payouts.get(w1.id);firstPayout.status='processed';firstPayout.utr='BANK-TEST-001';
 await bankWebhook(firstPayout,false);assert.equal((await credit()).held,'30.00');
 await bankWebhook(firstPayout);await bankWebhook(firstPayout);
 assert.equal((await credit()).balance,'20.00');assert.equal((await credit()).held,'0.00');assert.equal((await credit()).withdrawn,'30.00');
 const listed=(await req(a.path+'/admin/wallet/withdrawals','GET',null,a.token)).withdrawals;assert.equal(listed[0].bank_encrypted,undefined);assert.equal(listed[0].bank_last4,'7890');
 const details=await req('/api/platform/withdrawals/'+w1.id+'/bank','GET',null,pt);assert.equal(details.bank.account,bank.account);
 const [[saved]]=await db.platform.query('SELECT bank_encrypted FROM wallet_withdrawals WHERE id=?',[w1.id]);assert.ok(!saved.bank_encrypted.includes(bank.account));
 pass('live amount/currency verification, event ownership, withdrawal holds, encrypted bank details and superadmin approval/payout deduplication');
 const requests=await Promise.all([1,2].map(()=>nativeFetch(base+a.path+'/admin/wallet/withdrawals',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token},body:JSON.stringify({...bank,amount:'15.00',request_key:crypto.randomUUID()})})));
 assert.deepEqual(requests.map(r=>r.status).sort(),[201,409]);const held=(await req(a.path+'/admin/wallet/withdrawals','GET',null,a.token)).withdrawals.find(x=>x.status==='pending');
 await req('/api/platform/withdrawals/'+held.id+'/review','POST',{action:'reject',note:'Fixture rejection'},pt);assert.equal((await credit()).available,'20.00');
 const cancelled=await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'10.00',request_key:crypto.randomUUID()},a.token,201);await req(a.path+'/admin/wallet/withdrawals/'+cancelled.id+'/cancel','POST',{},a.token);assert.equal((await credit()).available,'20.00');
 refundDelay=true;await req(a.path+'/admin/orders/'+live.order.id+'/refund','PATCH',{},a.token);assert.equal((await credit()).balance,'20.00');assert.equal((await credit()).refund_held,'50.00');assert.equal((await credit()).available,'-30.00');await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'1.00',request_key:crypto.randomUUID()},a.token,409);
 const liveRefund=[...refunds.values()].find(x=>x.payment_id===good.id);liveRefund.status='processed';
 await webhook({event:'refund.processed',payload:{refund:{entity:liveRefund}}});await webhook({event:'refund.processed',payload:{refund:{entity:liveRefund}}});
 assert.equal((await credit()).balance,'-30.00');assert.equal((await credit()).reversals,'50.00');
 await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'1.00',request_key:crypto.randomUUID()},a.token,409);
 pass('concurrent requests cannot overspend; rejection/cancellation releases holds; confirmed refunds reverse once and deficits block withdrawals');
 const expired=await booking();await db.platform.query('UPDATE booking_payments SET expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE id=?',[expired.payment.id]);
 const [[p]]=await db.platform.query('SELECT * FROM booking_payments WHERE id=?',[expired.payment.id]);await require('../services/bookingPayments').expire(p);
 const late=capture(expired);await verify(expired,late);const lateStatus=await req(a.path+'/booking-payments/status','POST',{},null,200,expired.token);assert.equal(lateStatus.payment.status,'review');assert.equal(lateStatus.tickets.length,0);assert.equal((await credit()).balance,'-30.00');
 refundDelay=false;await req('/api/platform/booking-payments/'+p.id+'/refund','POST',{},pt);
 const lostToken=crypto.randomUUID();dropCreate=true;await req(a.path+'/orders','POST',body(a,lostToken),null,500);
 const recovered=await req(a.path+'/booking-payments/status','POST',{},null,200,lostToken);assert.ok(recovered.payment.order_id);
 const recoveredPay=capture(recovered);await verify({...recovered,token:lostToken},recoveredPay);assert.equal((await credit()).balance,'20.00');
 pass('expired stock is released, late captures never issue tickets, and lost provider responses recover without a second charge order');
 const freeType=(await req(a.path+'/admin/ticket-types','POST',{event_id:a.event.id,name:'Free',price:0,quantity:10},a.token,201)).ticketType;const freeKey=crypto.randomUUID();const freeBody={...body(a,freeKey),items:[{ticket_type_id:freeType.id,qty:1,attendees:[{name:'Free Guest',email:'guest@gateway.test',phone:'9876543210'}]}]};
 const free1=await req(a.path+'/orders','POST',freeBody,null,201),free2=await req(a.path+'/orders','POST',freeBody,null,201);assert.equal(free1.order.id,free2.order.id);assert.equal(free1.tickets.length,1);
 pass('free bookings issue tickets without charging and retries are idempotent');
 const code=free1.tickets[0].ticket_code;
 await req(a.path+'/admin/tickets/'+code,'GET',null,null,401);
 await req(b.path+'/admin/tickets/'+code,'GET',null,b.token,404);
 await req(b.path+'/admin/tickets/checkin','POST',{ticket_code:code},a.token,403);
 for(const invalid of [null,42,{},[],true,'   '])await req(a.path+'/admin/tickets/checkin','POST',{ticket_code:invalid},a.token,400);
 await req(a.path+'/admin/tickets/checkin','POST',{ticket_code:'TCK-NOT-A-TICKET'},a.token,404);
 await db.run(a.org,()=>db.query("UPDATE orders SET status='pending' WHERE id=?",[free1.order.id]));
 await req(a.path+'/admin/tickets/checkin','POST',{ticket_code:code},a.token,409);
 await db.run(a.org,()=>db.query("UPDATE orders SET status='paid' WHERE id=?",[free1.order.id]));
 const checked=await req(a.path+'/admin/tickets/checkin','POST',{ticket_code:code.toLowerCase()},a.token);
 assert.equal(checked.ticket.status,'checked_in');assert.ok(checked.ticket.checked_in_at);
 await req(a.path+'/admin/tickets/checkin','POST',{ticket_code:code},a.token,409);
 assert.equal((await req(a.path+'/admin/tickets/'+code,'GET',null,a.token)).ticket.status,'checked_in');
 const cancelledFree=await req(a.path+'/orders','POST',{...freeBody,request_key:crypto.randomUUID()},null,201);
 await req(a.path+'/admin/orders/'+cancelledFree.order.id+'/cancel','PATCH',{},a.token);
 await req(a.path+'/admin/tickets/checkin','POST',{ticket_code:cancelledFree.tickets[0].ticket_code},a.token,409);
 pass('ticket lookup and check-in persist correctly; unpaid, cancelled, duplicate, malformed and cross-organizer check-ins are rejected');

 await webhook({event:'payment.dispute.created',payload:{dispute:{entity:{payment_id:recoveredPay.id}}}});
 assert.equal((await credit()).refund_held,'50.00');
 await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'1.00',request_key:crypto.randomUUID()},a.token,409);
 // Resolving a full refund releases the review hold and posts the refund debit.
 await req('/api/platform/booking-payments/'+recovered.payment.id+'/refund','POST',{},pt);
 assert.equal((await credit()).refund_held,'0.00');
 pass('signed dispute notices freeze the affected funds until payment review is resolved');

 const extraPayoutFunds=await booking();await verify(extraPayoutFunds,capture(extraPayoutFunds));
 assert.equal((await credit()).balance,'20.00');
 const payoutRequest=()=>req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'5.00',request_key:crypto.randomUUID()},a.token,201);
 const lost=await payoutRequest();dropPayout=true;
 await req('/api/platform/withdrawals/'+lost.id+'/review','POST',{action:'approve'},pt);
 assert.equal((await credit()).held,'5.00');const transferCount=payouts.size;
 await req('/api/platform/withdrawals/'+lost.id+'/sync','POST',{},a.token,403);
 await req('/api/platform/withdrawals/'+lost.id+'/sync','POST',{},pt);assert.equal(payouts.size,transferCount);
 const recoveredPayout=payouts.get(lost.id);recoveredPayout.status='processed';
 await bankWebhook(recoveredPayout);assert.equal((await credit()).balance,'15.00');
 recoveredPayout.status='reversed';await bankWebhook(recoveredPayout);await bankWebhook(recoveredPayout);
 assert.equal((await credit()).balance,'20.00');assert.equal((await credit()).withdrawn,'30.00');
 recoveredPayout.status='processed';await bankWebhook(recoveredPayout);assert.equal((await credit()).balance,'20.00');
 pass('lost payout responses retry the identical transfer; signed confirmations debit once and returned transfers restore funds exactly once');
 const failed=await payoutRequest();await req('/api/platform/withdrawals/'+failed.id+'/review','POST',{action:'approve'},pt);
 const wrong=payouts.get(failed.id);wrong.status='processed';wrong.amount=1;await bankWebhook(wrong);
 assert.equal((await credit()).held,'5.00');assert.equal((await credit()).balance,'20.00');
 wrong.amount=500;wrong.status='failed';await bankWebhook(wrong);assert.equal((await credit()).held,'0.00');
 await req('/api/platform/withdrawals/'+failed.id+'/review','POST',{action:'approve'},pt);assert.equal(payouts.get(failed.id).status,'failed');
 const cfg=await req('/api/platform/settings/payouts','GET',null,pt);assert.equal(cfg.payout.account_last4,'9000');
 await req('/api/platform/settings/payouts','PUT',{...payoutConfig,key_id:'rzp_live_other'},pt,409);
 await req('/api/platform/settings/payouts','PUT',{...payoutConfig,key_secret:'rotated-payout-secret'},pt);
 await req('/api/platform/withdrawals/'+w1.id+'/sync','POST',{},pt);
 await req('/api/platform/settings/payouts','PUT',{...payoutConfig,enabled:false},pt);
 const disabled=await payoutRequest();await req('/api/platform/withdrawals/'+disabled.id+'/review','POST',{action:'approve'},pt,503);
 await req(a.path+'/admin/wallet/withdrawals/'+disabled.id+'/cancel','POST',{},a.token);
 await req('/api/platform/settings/payouts','PUT',payoutConfig,pt);
 await db.run(a.org,()=>db.query("INSERT INTO event_wallet_entries(event_id,entry_type,reason,mode,currency,amount) VALUES (?,'booking','opening','live','USD',100)",[a.event.id]));
 assert.equal((await credit()).balance,'20.00');const historical=await req(a.path+'/admin/wallet?currency=USD','GET',null,a.token);assert.equal(historical.summary.balance,'100.00');
 await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'21.00',request_key:crypto.randomUUID()},a.token,409);
 await db.platform.query("UPDATE wallet_withdrawals SET currency='USD' WHERE id=?",[disabled.id]);
 await db.platform.query("UPDATE wallet_withdrawals SET status='pending' WHERE id=?",[disabled.id]);
 await req('/api/platform/withdrawals/'+disabled.id+'/review','POST',{action:'approve'},pt,409);
 await req('/api/platform/withdrawals/'+disabled.id+'/review','POST',{action:'reject',note:'Historical currency fixture'},pt);
 pass('failed payouts release holds; wrong amounts, disabled settings, tenant access and USD/INR mixing are blocked');
 if(process.env.GATEWAY_UI_QA==='1'){qaReady=true;const extra=await booking();await verify(extra,capture(extra));await req(a.path+'/admin/wallet/withdrawals','POST',{...bank,amount:'10.00',request_key:crypto.randomUUID()},a.token,201);console.log('QA_API='+base);console.log('QA_EVENT='+a.event.slug);await new Promise(r=>process.once('SIGTERM',r));}
 global.fetch=nativeFetch;
 console.log(`Gateway and withdrawal integration passed: ${total} scenarios.`);

})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));try{const [orgs]=await db.platform.query('SELECT db_name FROM organizations WHERE is_legacy=FALSE');connection=await mysql.createConnection(db.options);for(const org of orgs)if(/^tf_[a-f0-9]{24}$/.test(org.db_name))await connection.query('DROP DATABASE '+sqlName(org.db_name));await db.end();if(/^tf_gateway_test_\d+_\d+$/.test(db.database))await connection.query('DROP DATABASE '+sqlName(db.database));}finally{await connection?.end();}});
