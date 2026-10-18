// Disposable tenant databases only. No mail, payment or production changes.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise'),express=require('express'),jwt=require('jsonwebtoken');
process.env.DB_NAME='tf_report_'+Date.now()+'_'+process.pid;process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
const db=require('../config/db'),{migrateTenant,sqlName}=require('../saas/provision');
const orgs=[{id:101,slug:'alpha',name:'Alpha',db_name:db.database+'_a'},{id:102,slug:'bravo',name:'Bravo',db_name:db.database+'_b'}];
let server;const owned=[];
(async()=>{
 for(const org of orgs){await migrateTenant(org.db_name);owned.push(org.db_name);await db.run(org,async()=>{
  await db.query("INSERT INTO admins (name,email,password_hash,role) VALUES ('Owner','owner@example.test','unused','super_admin'),('Manager','manager@example.test','unused','staff')");
  await db.query("INSERT INTO events (title,slug,start_datetime,status) VALUES ('Expo','expo','2035-01-01','published'),('Archived event','archived','2035-01-02','draft')");
  await db.query("INSERT INTO ticket_types (event_id,name,quantity) VALUES (1,'VIP',2000),(1,'General',2000),(2,'Old pass',2000)");
  await db.query("INSERT INTO orders (event_id,booking_ref,customer_name,email,phone,status,payment_method,created_at) VALUES (1,'BOOK-THREE','Booker','buyer@example.test','9000000000','paid','free','2026-10-01 23:59:59'),(1,'BOOK-TEST','Tester','test@example.test','9000000001','paid','razorpay_test','2026-10-02'),(1,'BOOK-PENDING','Pending','pending@example.test',NULL,'pending','razorpay_live','2026-10-03'),(1,'BOOK-VOID','Cancelled','void@example.test',NULL,'refunded','razorpay_live','2026-10-04'),(2,'BOOK-OLD','Legacy','legacy@example.test',NULL,'paid','free','2026-10-05')");
  for(let i=0;i<3;i++){await db.query('INSERT INTO order_attendees (order_id,ticket_type_id,position,name,email,phone,answers_json) VALUES (1,?,?,?,?,?,?)',[i<2?1:2,i+1,org.name+' Guest '+(i+1),'guest'+i+'@example.test','911111111'+i,JSON.stringify([{label:'City',value:'Hyderabad'}])]);await db.query('INSERT INTO tickets (order_id,ticket_type_id,ticket_code,attendee_name,attendee_id,status) VALUES (1,?,?,?,?,?)',[i<2?1:2,'TCK-THREE-'+i,org.name+' Guest '+(i+1),i+1,i===1?'checked_in':'valid']);}
  await db.query("INSERT INTO tickets (order_id,ticket_type_id,ticket_code,attendee_name,status) VALUES (4,1,'TCK-VOID','Cancelled','checked_in'),(5,3,'TCK-OLD','Legacy','valid')");
  const bulk=Array.from({length:1003},(_,i)=>[2,1,'TCK-BULK-'+i,i===0?'=HYPERLINK("unsafe")':'Test Guest '+i,'valid']);
  await db.query('INSERT INTO tickets (order_id,ticket_type_id,ticket_code,attendee_name,status) VALUES ?',[bulk]);
 });}
 const app=express();app.use('/o/:slug/orders',(req,res,next)=>{req.organization=orgs.find(o=>o.slug===req.params.slug);db.run(req.organization,next);},require('../routes/orderRoutes'));app.use(require('../middleware/errorHandler').errorHandler);
 server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});const origin='http://127.0.0.1:'+server.address().port;
 const token=(org,id=1)=>jwt.sign({id,organization_id:org.id},process.env.JWT_SECRET);
 async function request(path='',auth=token(orgs[0]),status=200,slug='alpha'){const r=await fetch(origin+'/o/'+slug+'/orders/tickets'+path,{headers:auth?{Authorization:'Bearer '+auth}:{}});assert.equal(r.status,status,path);return r;}
 const data=async path=>(await(await request(path)).json()).data;
 assert.equal((await data()).pagination.total,5);
 const three=await data('?event_id=1&from=2026-10-01&to=2026-10-01');assert.equal(three.tickets.length,3);assert.equal(new Set(three.tickets.map(t=>t.order_id)).size,1);assert.equal(new Set(three.tickets.map(t=>t.attendee_email)).size,3);assert.ok(three.tickets.every(t=>t.answers_json===undefined));
 assert.equal((await data('?ticket_type_id=1&status=paid')).pagination.total,2);
 assert.equal((await data('?ticket_status=checked_in')).pagination.total,1);
 const cancelled=await data('?ticket_status=cancelled');assert.equal(cancelled.pagination.total,1);assert.equal(cancelled.tickets[0].order_status,'refunded');
 for(const search of ['guest0@example.test','9111111110','TCK-THREE-0'])assert.equal((await data('?search='+encodeURIComponent(search))).pagination.total,1);
 assert.equal((await data('?search=%25')).pagination.total,0);
 const page=await data('?limit=2&page=2');assert.equal(page.tickets.length,2);assert.equal(page.pagination.pages,3);
 const old=await data('?event_id=2');assert.equal(old.tickets[0].attendee_email,null,'No false attribution of booker email to legacy attendees');
 const options=await data('/options?event_id=1');assert.equal(options.events.length,2);assert.equal(options.ticketTypes.length,2);
 const csvResponse=await request('/export?event_id=1&from=2026-10-01&to=2026-10-01&limit=1&page=2');const csv=await csvResponse.text();assert.match(csvResponse.headers.get('cache-control'),/no-store/);assert.match(csvResponse.headers.get('content-type'),/text\/csv/);assert.equal((csv.match(/TCK-THREE-/g)||[]).length,3,'Export ignores screen pagination');assert.match(csv,/City: Hyderabad/);assert.doesNotMatch(csv,/TCK-BULK/);
 const allTest=await(await request('/export?booking_group=test')).text();assert.equal((allTest.match(/TCK-BULK-/g)||[]).length,1003,'Export crosses batch boundary without dropping rows');assert.match(allTest,/"'=HYPERLINK/);
 const empty=await(await request('/export?search=missing')).text();assert.match(empty,/Attendee name/);assert.doesNotMatch(empty,/TCK-/);
 await request('',null,401);await request('/export',token(orgs[1]),403);await request('/options',jwt.sign({id:1,type:'platform'},process.env.JWT_SECRET),403);
 const bravo=(await(await request('',token(orgs[1]),200,'bravo')).json()).data;assert.ok(bravo.tickets.some(t=>t.attendee_name==='Bravo Guest 1'));assert.ok(!bravo.tickets.some(t=>t.attendee_name==='Alpha Guest 1'));
 await request('',token(orgs[0],2));await request('/export?event_id=1',token(orgs[0],2));
 await request('?from=invalid',token(orgs[0]),400);await request('?page=0',token(orgs[0]),400);
 console.log('PASS individual rows, tenant/role isolation, all filters, pagination, archived history, legacy contacts, private CSV, formula safety and complete multi-batch export.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.end();if(owned.length){const conn=await mysql.createConnection(db.options);try{for(const name of owned)await conn.query('DROP DATABASE '+sqlName(name));}finally{await conn.end();}}});
