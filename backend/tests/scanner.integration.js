// Disposable databases only; no production credentials, payment calls or emails.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
process.env.DB_NAME='tf_scanner_test_'+Date.now()+'_'+process.pid;
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
const db=require('../config/db'),{migrateTenant,migratePlatform,sqlName}=require('../saas/provision');
const owned=[db.database];let server;
(async()=>{
 await migrateTenant(db.database);await migratePlatform();
 const tenants=[];
 for(const slug of ['scanner-alpha','scanner-bravo']){
  const name='tf_scanner_'+crypto.randomBytes(8).toString('hex');owned.push(name);await migrateTenant(name);
  const [insert]=await db.platform.query("INSERT INTO organizations(name,slug,db_name,owner_email,status) VALUES (?,?,?,'gate@example.test','active')",[slug,slug,name]);
  const org={id:insert.insertId,db_name:name,slug};
  await db.run(org,async()=>{
   const hash=await require('bcryptjs').hash('Scanner-Test-Password!',4);
   await db.query("INSERT INTO admins(name,email,password_hash,role) VALUES ('Gate staff','gate@example.test',?,'scanner')",[hash]);
   for(let i=1;i<=2;i++)await db.query("INSERT INTO events(title,slug,start_datetime,status) VALUES (?,?,NOW(),'published')",['Event '+i,'event-'+i]);
   await db.query("INSERT INTO ticket_types(event_id,name,quantity) VALUES (1,'Admission',100)");
   for(let i=1;i<=12;i++){
    await db.query("INSERT INTO orders(event_id,booking_ref,customer_name,email,status,payment_method) VALUES (1,?,'Test Guest','guest@example.test',?,?)",['SCAN-'+i,i===3?'pending':i===4?'refunded':'paid',i===5?'razorpay_test':'free']);
    await db.query("INSERT INTO tickets(order_id,ticket_type_id,ticket_code,attendee_name,status) VALUES (?,1,?,'Gate Guest',?)",[i,'TCK-AAAA-BBBB-'+String(i).padStart(4,'0'),i===6?'cancelled':'valid']);
   }
  });tenants.push(org);
 }
 server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function req(org,path,body,token,status=200){const r=await fetch(base+'/api/o/'+org.slug+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data;}
 const [a,b]=tenants;
 const token=(await req(a,'/auth/login',{email:'gate@example.test',password:'Scanner-Test-Password!'})).token;
 const scan='/admin/scanner',payload=(n,event=1)=>({ticket_code:'TCK-AAAA-BBBB-'+String(n).padStart(4,'0'),event_id:event});
 await req(a,scan+'/events',null,null,401);await req(b,scan+'/events',null,token,403);
 console.log('PASS organization login, authentication and cross-organization token isolation');
 for(const path of ['/admin/dashboard','/admin/events','/admin/orders','/admin/studio/bootstrap','/admin/saas/team','/admin/wallet']) await req(a,path,null,token,403);
 assert.equal((await req(a,'/auth/me',null,token)).admin.role,'scanner');
 const before=await req(a,scan+'/events',null,token);assert.equal(before.events.length,2);
 assert.equal((await req(a,scan+'/verify',payload(1),token)).reason,'valid');
 assert.equal((await req(a,scan+'/verify',payload(1),token)).reason,'valid');
 assert.equal((await req(a,scan+'/verify',payload(1,2),token)).reason,'wrong_event');
 await req(a,scan+'/checkin',payload(1,2),token,409);
 await req(a,scan+'/verify',{ticket_code:'https://untrusted.example',event_id:1},token,400);
 await req(a,scan+'/verify',{ticket_code:payload(1).ticket_code,event_id:'1 OR 1=1'},token,400);
 for(const [i,reason] of [[3,'unpaid'],[4,'cancelled'],[5,'test_ticket'],[6,'cancelled'],[99,'not_found']])assert.equal((await req(a,scan+'/checkin',payload(i),token,409)).reason,reason);
 console.log('PASS validation is read-only; wrong event, invalid QR, unpaid, refunded, test and cancelled tickets rejected');
 const results=await Promise.all(Array.from({length:12},async()=>{const r=await fetch(base+'/api/o/'+a.slug+scan+'/checkin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload(1))});return {status:r.status,body:await r.json()};}));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.body.data.reason==='already_used').length,11);
 const used=await req(a,scan+'/verify',payload(1),token);assert.equal(used.reason,'already_used');assert.ok(used.ticket.checked_in_at);
 console.log('PASS twelve simultaneous check-ins admit exactly once and preserve timestamp');
 await req(a,scan+'/verify',payload(2),token);
 await db.run(a,()=>db.query("UPDATE orders SET status='cancelled' WHERE id=2"));
 assert.equal((await req(a,scan+'/checkin',payload(2),token,409)).reason,'cancelled');
 await db.run(a,()=>db.query('UPDATE orders SET archived_at=NOW() WHERE id=7'));
 assert.equal((await req(a,scan+'/verify',payload(7),token)).reason,'not_found');
 await db.run(a,()=>db.query("UPDATE events SET status='cancelled' WHERE id=1"));
 assert.equal((await req(a,scan+'/checkin',payload(8),token,409)).reason,'event_unavailable');
 await db.run(a,()=>db.query("UPDATE events SET status='published' WHERE id=1"));
 const history=await req(a,scan+'/guests?event_id=1&status=checked_in',null,token);assert.equal(history.total,1);assert.equal(history.tickets[0].ticket_code,payload(1).ticket_code);
 assert.equal((await req(a,scan+'/guests?event_id=2',null,token)).total,0);
 assert.equal((await req(a,scan+'/guests?event_id=1&search=not-present',null,token)).total,0);
 console.log('PASS post-preview changes, archive state, cancelled events, scoped history and guest search');
 await db.platform.query("UPDATE organizations SET status='suspended' WHERE id=?",[a.id]);
 assert.equal((await req(a,scan+'/checkin',payload(8),token)).reason,'checked_in');
 await db.run(a,()=>db.query('DELETE FROM admins WHERE id=1'));
 await req(a,scan+'/events',null,token,401);
 console.log('PASS suspended organization retains existing entry access; removed staff lose access');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));await db.end();const c=await mysql.createConnection(db.options);try{for(const name of owned.reverse())await c.query('DROP DATABASE IF EXISTS '+sqlName(name));}finally{await c.end();}});
