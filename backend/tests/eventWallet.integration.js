// Disposable databases only; no real email or payment provider is contacted.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
process.env.DB_NAME=`tf_wallet_test_${Date.now()}_${process.pid}`;process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.SETTINGS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');delete process.env.BASE_DOMAIN;
const db=require('../config/db'),{migrateTenant,migratePlatform,sqlName}=require('../saas/provision');let server,connection,total=0;const pass=message=>{total++;console.log('PASS '+message);};
(async()=>{
 await migrateTenant(db.database);await migratePlatform();require('./helpers/legacyDemoCheckout');server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function req(path,method='GET',body,token,status=200){const r=await fetch(base+path,{method,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});const json=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(json));return json.data;}

 const tenants=[];
 for(const slug of ['wallet-alpha','wallet-bravo']){
   const created=(await req('/api/saas/signup','POST',{company_name:slug,slug,name:'Wallet Owner',email:'owner@wallet.test',password:'WalletTestPassword!123'},null,201)).organization;
   await db.platform.query('UPDATE organizations SET event_balance=10 WHERE id=?',[created.id]);
   await require('./helpers/paidPackage')(db.platform,created.id,10);
   const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[created.id]);
   const token=(await req(`/api/o/${slug}/auth/login`,'POST',{email:'owner@wallet.test',password:'WalletTestPassword!123'})).token;
   tenants.push({org,token,path:`/api/o/${slug}`});
 }
 const [a,b]=tenants;
 async function event(t,title){return (await req(t.path+'/admin/events','POST',{title,venue:'Hall',city:'City',start_datetime:'2035-01-01 12:00:00',end_datetime:'2035-01-01 18:00:00',status:'published'},t.token,201)).event;}
 const first=await event(a,'First wallet'),second=await event(a,'Second wallet');await event(b,'Other organization');
 async function type(eventId,price){return (await req(a.path+'/admin/ticket-types','POST',{event_id:eventId,name:'Admission '+price,price,quantity:100},a.token,201)).ticketType;}
 const t1=await type(first.id,0.1),t2=await type(first.id,0.2),t3=await type(second.id,19.99),free=await type(second.id,0);
 const payload=(event_id,items)=>({event_id,customer_name:'Wallet Guest',phone:'9876543210',email:'guest@wallet.test',items,payment_method:'cash',total_amount:999999,status:'paid'});
 const book=(event_id,items)=>req(a.path+'/orders','POST',payload(event_id,items),null,201);
 const wallet=(suffix='',t=a)=>req(t.path+'/admin/wallet'+(suffix?(suffix.includes('mode=')?suffix:suffix+'&mode=demo'):'?mode=demo')+'&currency=USD','GET',null,t.token);
 const one=await book(first.id,[{ticket_type_id:t1.id,qty:3},{ticket_type_id:t2.id,qty:1}]);
 assert.equal(one.order.total_amount,'0.50');
 let w=await wallet();assert.equal(w.summary.balance,'0.50');assert.equal(w.entries.length,1);assert.equal(w.entries[0].mode,'demo');
 await book(second.id,[{ticket_type_id:t3.id,qty:2}]);await book(second.id,[{ticket_type_id:free.id,qty:1}]);
 assert.equal((await wallet()).summary.balance,'40.48');assert.equal((await wallet('?event_id='+first.id)).summary.balance,'0.50');
 assert.equal((await wallet('?mode=recorded')).summary.balance,'0.00');assert.equal((await wallet('',b)).summary.balance,'0.00');
 pass('decimal credits, free bookings, per-event totals and demo isolation; forged amounts and payment method ignored');
 await req(a.path+'/admin/wallet','GET',null,null,401);await req(b.path+'/admin/wallet','GET',null,a.token,403);
 await db.run(a.org,async()=>{const [r]=await db.query("INSERT INTO admins(name,email,password_hash,role) VALUES ('Staff','staff@wallet.test','unused','staff')");const token=require('jsonwebtoken').sign({id:r.insertId,organization_id:a.org.id,role:'super_admin'},process.env.JWT_SECRET);await req(a.path+'/admin/wallet','GET',null,token,403);});
 await req(a.path+'/admin/wallet?event_id=999999','GET',null,a.token,404);
 for(const q of ['page=-1','page=1.5','event_id=abc','mode=invalid','include_archived=invalid'])await req(a.path+'/admin/wallet?'+q,'GET',null,a.token,400);
 await req(a.path+'/admin/wallet','POST',{amount:100},a.token,404);
 pass('owner-only access, tenant isolation, validated filters and no direct balance mutation');
 const responses=await Promise.all(['refund','cancel'].map(action=>fetch(base+a.path+'/admin/orders/'+one.order.id+'/'+action,{method:'PATCH',headers:{Authorization:'Bearer '+a.token}})));
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 w=await wallet('?event_id='+first.id);assert.equal(w.summary.balance,'0.00');assert.equal(w.summary.reversals,'0.50');assert.equal(w.entries.length,2);
 await req(a.path+'/admin/orders/'+one.order.id+'/refund','PATCH',{},a.token,409);
 const cancel=await book(first.id,[{ticket_type_id:t1.id,qty:1}]);await req(a.path+'/admin/orders/'+cancel.order.id+'/cancel','PATCH',{},a.token);
 w=await wallet('?event_id='+first.id);assert.equal(w.summary.balance,'0.00');assert.equal(w.entries[0].reason,'cancelled');
 pass('concurrent and repeated refunds/cancellations reverse exactly once');
 await db.run(a.org,async()=>{
   const [[before]]=await db.query('SELECT COUNT(*) n FROM orders');const [[stock]]=await db.query('SELECT sold FROM ticket_types WHERE id=?',[t1.id]);
   await db.query("CREATE TRIGGER wallet_failure BEFORE INSERT ON event_wallet_entries FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Simulated wallet failure'");
   try{await req(a.path+'/orders','POST',payload(first.id,[{ticket_type_id:t1.id,qty:1}]),null,500);}finally{await db.query('DROP TRIGGER wallet_failure');}
   const [[after]]=await db.query('SELECT COUNT(*) n FROM orders');assert.equal(after.n,before.n);
   const [[newStock]]=await db.query('SELECT sold FROM ticket_types WHERE id=?',[t1.id]);assert.equal(newStock.sold,stock.sold);
   const [[paid]]=await db.query("SELECT id FROM orders WHERE status='paid' AND total_amount>0 LIMIT 1");
   const [[valid]]=await db.query("SELECT COUNT(*) n FROM tickets WHERE order_id=? AND status='valid'",[paid.id]);
   await db.query("CREATE TRIGGER reversal_failure BEFORE INSERT ON event_wallet_entries FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Simulated reversal failure'");
   try{await req(a.path+'/admin/orders/'+paid.id+'/refund','PATCH',{},a.token,500);}finally{await db.query('DROP TRIGGER reversal_failure');}
   const [[preserved]]=await db.query('SELECT status FROM orders WHERE id=?',[paid.id]);assert.equal(preserved.status,'paid');
   const [[stillValid]]=await db.query("SELECT COUNT(*) n FROM tickets WHERE order_id=? AND status='valid'",[paid.id]);assert.equal(stillValid.n,valid.n);
   const [[noDebit]]=await db.query("SELECT COUNT(*) n FROM event_wallet_entries WHERE order_id=? AND entry_type='reversal'",[paid.id]);assert.equal(noDebit.n,0);

   for(const status of ['paid','pending','cancelled','refunded'])await db.query("INSERT INTO orders(event_id,booking_ref,customer_name,email,total_amount,status,payment_method) VALUES (?,?,'Historical','history@wallet.test',12.34,?,'cash')",[second.id,'HIST-'+status,status]);
   const sql=await require('node:fs/promises').readFile(require('node:path').join(__dirname,'../migrations/010_event_wallets.sql'),'utf8');
   const opening=sql.slice(sql.indexOf('INSERT IGNORE'));await db.query(opening);await db.query(opening);
 });
 w=await wallet('?mode=recorded');assert.equal(w.summary.balance,'12.34');assert.equal(w.entries.length,1);assert.equal(w.entries[0].reason,'opening');
 pass('failed credits roll back orders and stock; opening import excludes unpaid/closed orders and cannot duplicate credits');
 await db.run(a.org,async()=>{const [[pending]]=await db.query("SELECT id FROM orders WHERE booking_ref='HIST-pending'");await req(a.path+'/admin/orders/'+pending.id+'/cancel','PATCH',{},a.token);const [[count]]=await db.query('SELECT COUNT(*) n FROM event_wallet_entries WHERE order_id=?',[pending.id]);assert.equal(count.n,0);});
 for(let i=0;i<24;i++)await book(first.id,[{ticket_type_id:t1.id,qty:1}]);
 const p1=await wallet(),p2=await wallet('?page=2');assert.equal(p1.entries.length,25);assert.ok(p2.entries.length>0);assert.ok(!p1.entries.some(x=>p2.entries.some(y=>x.id===y.id)));
 assert.equal((await wallet('?event_id='+first.id)).summary.balance,'2.40');
 const beforeArchive=await wallet();
 await req(a.path+'/admin/events/'+first.id,'DELETE',null,a.token);
 const current=await wallet();
 assert.deepEqual(current.events.map(e=>e.id),[second.id]);
 assert.equal(current.include_archived,false);
 assert.ok(current.entries.every(e=>e.event_id===second.id));
 assert.equal(current.summary.balance,(Number(beforeArchive.summary.balance)-2.4).toFixed(2));
 const all=await wallet('?include_archived=true');
 assert.equal(all.include_archived,true);assert.equal(all.events.length,2);
 assert.equal(all.summary.balance,beforeArchive.summary.balance);
 assert.equal(all.pagination.total,beforeArchive.pagination.total);
 assert.equal((await wallet('?include_archived=false')).events.length,1);
 const archived=await wallet('?event_id='+first.id);
 assert.equal(archived.summary.balance,'2.40');assert.equal(archived.include_archived,true);
 assert.ok(archived.events.find(e=>e.id===first.id)?.archived_at);
 await req(a.path+'/admin/events/'+first.id+'/restore','POST',{},a.token);
 assert.equal((await wallet()).events.length,2);
 assert.equal((await wallet()).summary.balance,beforeArchive.summary.balance);
 pass('pending cancellations create no debit; pagination works; current events exclude archives while archived balances remain accessible and restore correctly');
 await db.run(a.org,async()=>{
  await require('../models/Studio').saveSetting('order_list',{separate_test_bookings:true});
  for(const [ref,method,amount,status] of [['GROUP-FREE','free',0,'paid'],['GROUP-TEST','razorpay_test',15,'paid'],['GROUP-LIVE','razorpay_live',15,'paid'],['GROUP-PENDING','razorpay_live',15,'pending']])await db.query("INSERT INTO orders(event_id,booking_ref,customer_name,email,total_amount,status,payment_method) VALUES (?,?,'Group fixture','group@wallet.test',?,?,?)",[second.id,ref,amount,status,method]);
 });
 await db.run(b.org,()=>db.query("INSERT INTO orders(event_id,booking_ref,customer_name,email,total_amount,status,payment_method) SELECT id,'OTHER-DEMO','Other fixture','other@wallet.test',1,'paid','mock' FROM events LIMIT 1"));
 const real=await req(a.path+'/admin/orders','GET',null,a.token);
 assert.equal(real.separate_test_bookings,true);assert.equal(real.booking_group,'real');
 assert.ok(real.orders.every(o=>!['mock','razorpay_test'].includes(o.payment_method)));
 assert.ok(real.orders.some(o=>o.booking_ref==='GROUP-FREE'));assert.ok(real.orders.some(o=>o.booking_ref==='GROUP-PENDING'));
 const testOnly=await req(a.path+'/admin/orders?booking_group=test&search=GROUP-TEST','GET',null,a.token);
 assert.equal(testOnly.pagination.total,1);assert.equal(testOnly.orders[0].payment_method,'razorpay_test');
 const filtered=await req(a.path+'/admin/orders?booking_group=real&event_id='+second.id+'&status=paid&search=GROUP-&limit=1','GET',null,a.token);
 assert.equal(filtered.orders.length,1);assert.equal(filtered.pagination.total,2);assert.equal(filtered.pagination.pages,2);
 const demo=await req(a.path+'/admin/orders/'+one.order.id,'GET',null,a.token);assert.equal(demo.separate_test_bookings,true);
 await req(a.path+'/admin/orders?booking_group=invalid','GET',null,a.token,400);
 await req(b.path+'/admin/orders','GET',null,a.token,403);
 const untouched=await req(b.path+'/admin/orders','GET',null,b.token);assert.equal(untouched.separate_test_bookings,true);assert.equal(untouched.orders.length,0);const otherTests=await req(b.path+'/admin/orders?booking_group=test','GET',null,b.token);assert.equal(otherTests.orders[0].booking_ref,'OTHER-DEMO');
 pass('organization-specific order views separate mock/test bookings, retain live/free bookings, paginate matching counts and exclude demo bookings by default in every organization');
 const dashboard=await req(a.path+'/admin/dashboard','GET',null,a.token);
 assert.equal(dashboard.separate_test_bookings,true);assert.equal(Number(dashboard.kpi.total_revenue),27.34);assert.equal(dashboard.kpi.inr_paid_orders,3);
 assert.equal(dashboard.kpi.valid_tickets,0);assert.equal(dashboard.kpi.checked_in_tickets,0);
 assert.ok(dashboard.recentOrders.every(o=>!['mock','razorpay_test'].includes(o.payment_method)));
 assert.ok(dashboard.upcoming.every(e=>e.tickets_sold===0));assert.equal(dashboard.topEvents.length,1);
 assert.equal(Number(dashboard.topEvents[0].revenue),27.34);
 await db.run(a.org,()=>db.query("INSERT INTO orders(event_id,booking_ref,customer_name,email,total_amount,status,payment_method,currency,created_at) VALUES (?,'OLD-LIVE','Earlier guest','earlier@wallet.test',25,'paid','razorpay_live','INR',DATE_SUB(NOW(),INTERVAL 45 DAY))",[second.id]));
 const month=await req(a.path+'/admin/dashboard?days=30','GET',null,a.token),quarter=await req(a.path+'/admin/dashboard?days=90','GET',null,a.token);
 assert.equal(Number(month.kpi.total_revenue),52.34);assert.equal(month.days,30);assert.equal(quarter.days,90);
 const sum=data=>Number(data.salesTrend.reduce((n,p)=>n+Number(p.revenue),0).toFixed(2));
 assert.equal(sum(month),27.34);assert.equal(sum(quarter),52.34);
 await req(a.path+'/admin/dashboard?days=invalid','GET',null,a.token,400);
 await req(a.path+'/admin/dashboard','GET',null,b.token,403);
 const otherDashboard=await req(b.path+'/admin/dashboard','GET',null,b.token);assert.equal(otherDashboard.separate_test_bookings,true);assert.equal(otherDashboard.recentOrders.length,0);assert.equal(Number(otherDashboard.kpi.total_revenue),0);
 pass('dashboard excludes demo figures for the configured organization, retains tenant isolation and applies real 14/30/90 day revenue periods');
 console.log(`Wallet integration passed: ${total} scenarios.`);

})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));try{const [orgs]=await db.platform.query('SELECT db_name FROM organizations WHERE is_legacy=FALSE');connection=await mysql.createConnection(db.options);for(const org of orgs)if(/^tf_[a-f0-9]{24}$/.test(org.db_name))await connection.query('DROP DATABASE '+sqlName(org.db_name));await db.end();if(/^tf_wallet_test_\d+_\d+$/.test(db.database))await connection.query('DROP DATABASE '+sqlName(db.database));}finally{await connection?.end();}});
