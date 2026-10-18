// Disposable tenant databases. SMTP is mocked; no customer email is sent.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise'),jwt=require('jsonwebtoken');
process.env.DB_NAME='tf_bookermail_'+Date.now();process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.SETTINGS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');delete process.env.BASE_DOMAIN;
const db=require('../config/db'),{migrateTenant,migratePlatform,sqlName}=require('../saas/provision'),messages=require('../services/organizerMessages'),Studio=require('../models/Studio');
const deliveries=[];let fail=false;
require('nodemailer').createTransport=()=>({close(){},sendMail:async m=>{if(fail)throw Error('SMTP fixture failure');deliveries.push(m);return{accepted:[m.to.address],rejected:[]};}});
const owned=[db.database];let server;
(async()=>{
 await migrateTenant(db.database);await migratePlatform();server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 async function req(path,method='GET',body,token,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(data));return data.data;}
 const tenants=[];
 for(const slug of ['bookermail-alpha','bookermail-bravo']){
  const created=(await req('/api/saas/signup','POST',{company_name:slug,slug,name:'Owner',email:'owner@fixture.test',password:'FixtureOwner!123'},null,201)).organization;
  const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[created.id]);owned.push(org.db_name);
  const token=(await req('/api/o/'+slug+'/auth/login','POST',{email:'owner@fixture.test',password:'FixtureOwner!123'})).token;
  await db.run(org,async()=>{
   await db.query("INSERT INTO events(title,slug,start_datetime,venue,city,status) VALUES ('Fixture Expo','fixture','2035-01-01 10:00:00','Hall','Hyderabad','published')");
   for(const [name,email,status] of [['Alice','alice@fixture.test','paid'],['Alice','ALICE@fixture.test','paid'],['Bob','bob@fixture.test','paid'],['Cancelled','cancelled@fixture.test','cancelled'],['Pending','pending@fixture.test','pending'],['Blank','','paid']])await db.query('INSERT INTO orders(event_id,booking_ref,customer_name,email,status) VALUES (1,?,?,?,?)',[crypto.randomUUID().slice(0,20),name,email,status]);
   await db.query("INSERT INTO events(title,slug,start_datetime,venue,city,status) VALUES ('Other Expo','other','2035-01-01 10:00:00','Hall','Hyderabad','published')");
   await db.query("INSERT INTO ticket_types(event_id,name) VALUES (1,'Explorer'),(1,'VIP'),(2,'Other event pass')");
   await db.query("INSERT INTO tickets(order_id,ticket_type_id,ticket_code,status) VALUES (1,1,'explorer-1','valid'),(1,1,'explorer-2','valid'),(2,1,'explorer-3','checked_in'),(3,2,'vip-1','valid'),(3,1,'cancelled-explorer','cancelled')");
   await Studio.saveSetting('smtp' ,{enabled:true,host:slug+'.smtp.fixture',port:587,encryption:'none',from_email:slug+'@fixture.test',from_name:slug});
  });tenants.push({org,token,path:'/api/o/'+slug+'/admin/messages'});
 }
 const [a,b]=tenants;
 await req(a.path,'GET',null,null,401);await req(b.path,'GET',null,a.token,403);
 const staff=await db.run(a.org,()=>require('../models/Admin').create({name:'Staff',email:'staff@fixture.test',passwordHash:'unused',role:'staff'}));const staffToken=jwt.sign({id:staff.id,organization_id:a.org.id},process.env.JWT_SECRET);
 await req(a.path,'GET',null,staffToken,403);
 const contacts=await req(a.path+'/recipients?event_id=1','GET',null,a.token);assert.equal(contacts.recipients.length,2);assert.equal(contacts.recipients[0].bookings,2);
 const explorer=await req(a.path+'/recipients?event_id=1&ticket_type_id=1','GET',null,a.token);
 assert.equal(explorer.total,1);assert.equal(explorer.recipients[0].email,'alice@fixture.test');assert.equal(explorer.recipients[0].bookings,2,'Multiple tickets must not inflate order count');assert.equal(explorer.ticket_types.length,2);
 const vip=await req(a.path+'/recipients?event_id=1&ticket_type_id=2','GET',null,a.token);assert.equal(vip.total,1);assert.equal(vip.recipients[0].email,'bob@fixture.test');
 assert.equal((await req(a.path+'/recipients?event_id=1&ticket_type_id=1&search=bob','GET',null,a.token)).total,0);
 await req(a.path+'/recipients?event_id=1&ticket_type_id=3','GET',null,a.token,404);
 await req(a.path+'/recipients?event_id=1&ticket_type_id=invalid','GET',null,a.token,400);
 const payload={event_id:1,recipients:['alice@fixture.test','ALICE@fixture.test','bob@fixture.test'],subject:'Update: {{event_title}}',body:'<p>Hello {{customer_name}}</p><p>The venue is {{venue}}.</p><script>alert(1)</script>',request_key:crypto.randomUUID()};
 await req(a.path+'/preview','POST',{...payload,recipients:['outsider@fixture.test']},a.token,409);
 await req(a.path+'/preview','POST',{...payload,body:'{{ticket}}'},a.token,400);
 await req(a.path+'/preview','POST',{...payload,ticket_type_id:1,recipients:['bob@fixture.test']},a.token,409);
 const allExplorer=await req(a.path+'/preview','POST',{...payload,ticket_type_id:1,select_all:true,recipients:[]},a.token);assert.equal(allExplorer.count,1);assert.match(allExplorer.selection_hash,/^[a-f0-9]{64}$/);
 const preview=await req(a.path+'/preview','POST',payload,a.token);assert.equal(preview.count,2);assert.match(preview.html,/Hello Alice/);assert.doesNotMatch(preview.html,/script|Your entry tickets|Booking reference<\/td>/);assert.equal(deliveries.length,0);
 const [first,duplicate]=await Promise.all([req(a.path,'POST',payload,a.token),req(a.path,'POST',payload,a.token)]);assert.equal(first.id,duplicate.id);
 await req(a.path,'POST',{...payload,subject:'Changed'},a.token,409);
 assert.equal((await req(b.path,'GET',null,b.token)).messages.length,0);await req(b.path+'/'+first.id,'GET',null,b.token,404);
 await db.run(a.org,async()=>{
  const [[order]]=await db.query("SELECT id FROM orders WHERE email='alice@fixture.test' LIMIT 1");
  await db.query("INSERT INTO mail_outbox(order_id,event_key,recipient_key,status) VALUES (?,'priority-test','booking','pending')",[order.id]);
  await messages.processOutbox();assert.equal(deliveries.length,0);
  await db.query("UPDATE mail_outbox SET status='sent' WHERE event_key='priority-test'");
  await Promise.all([messages.processOutbox(),messages.processOutbox()]);assert.equal(deliveries.length,1);
  await messages.processOutbox();assert.equal(deliveries.length,1,'Throttle must prevent an immediate second send');
  assert.equal(deliveries[0].from.address,'bookermail-alpha@fixture.test');assert.equal(deliveries[0].to.address,'alice@fixture.test');assert.equal(deliveries[0].html,preview.html);
  await db.query("UPDATE orders SET status='cancelled' WHERE email='bob@fixture.test'");await db.query('UPDATE organizer_message_recipients SET updated_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE)');await messages.processOutbox();
 });
 const detail=await req(a.path+'/'+first.id,'GET',null,a.token);assert.equal(detail.recipients.find(r=>r.email==='bob@fixture.test').status,'skipped');
 console.log('PASS owner access, tenant isolation, confirmed recipients, deduplication, safe preview, concurrent idempotency, priority, throttle and cancelled-booking recheck.');
 const again={...payload,recipients:['alice@fixture.test'],request_key:crypto.randomUUID()};const next=await req(a.path,'POST',again,a.token);
 fail=true;await db.run(a.org,async()=>{await db.query('UPDATE organizer_message_recipients SET updated_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE)');await messages.processOutbox();});
 const failed=await req(a.path+'/'+next.id,'GET',null,a.token);assert.equal(failed.message.paused,1);assert.equal(failed.recipients[0].status,'failed');
 fail=false;await req(a.path+'/'+next.id+'/retry','POST',{},a.token);await db.run(a.org,async()=>{await db.query('UPDATE organizer_message_recipients SET updated_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE)');await messages.processOutbox();});assert.equal(deliveries.length,2);
 const last=await req(a.path,'POST',{...again,request_key:crypto.randomUUID()},a.token);await req(a.path+'/'+last.id+'/cancel','POST',{},a.token);assert.equal((await req(a.path+'/'+last.id,'GET',null,a.token)).recipients[0].status,'skipped');
 // Recheck the selected pass even when the contact still has another paid booking.
 const filteredInput={...again,ticket_type_id:1,select_all:true,recipients:[],request_key:crypto.randomUUID()};
 const filteredPreview=await req(a.path+'/preview','POST',filteredInput,a.token);
 const filtered=await req(a.path,'POST',{...filteredInput,selection_hash:filteredPreview.selection_hash},a.token);
 await db.run(a.org,async()=>{await db.query("UPDATE tickets SET status='cancelled' WHERE ticket_type_id=1");await db.query('UPDATE organizer_message_recipients SET updated_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE)');await messages.processOutbox();});
 assert.equal((await req(a.path+'/'+filtered.id,'GET',null,a.token)).recipients[0].status,'skipped');assert.equal(deliveries.length,2);
 // Select all goes beyond the displayed 500, and send requires a current preview.
 await db.run(a.org,async()=>{const values=Array.from({length:502},(_,i)=>[2,'large-'+i,'Contact '+i,'large'+i+'@fixture.test','paid']);await db.query('INSERT INTO orders(event_id,booking_ref,customer_name,email,status) VALUES ?',[values]);});
 const large=await req(a.path+'/recipients?event_id=2','GET',null,a.token);assert.equal(large.recipients.length,500);assert.equal(large.total,502);assert.equal(large.has_more,true);
 const allInput={...again,event_id:2,select_all:true,recipients:[],request_key:crypto.randomUUID()};
 const allPreview=await req(a.path+'/preview','POST',allInput,a.token);assert.equal(allPreview.count,502);
 await req(a.path,'POST',allInput,a.token,409);
 await db.run(a.org,()=>db.query("UPDATE orders SET status='cancelled' WHERE booking_ref='large-0'"));
 await req(a.path,'POST',{...allInput,selection_hash:allPreview.selection_hash},a.token,409);
 const freshPreview=await req(a.path+'/preview','POST',allInput,a.token);assert.equal(freshPreview.count,501);
 const allQueued=await req(a.path,'POST',{...allInput,selection_hash:freshPreview.selection_hash},a.token);
 assert.equal((await req(a.path+'/'+allQueued.id,'GET',null,a.token)).recipients.length,501);
 await req(a.path+'/'+allQueued.id+'/cancel','POST',{},a.token);
 console.log('PASS event-specific ticket filters, search, multi-ticket deduplication, ticket cancellation recheck, select all beyond 500 and stale-preview protection.');
 await db.run(a.org,()=>Studio.saveSetting('smtp',{enabled:false}));await req(a.path,'POST',{...again,request_key:crypto.randomUUID()},a.token,400);
 console.log('PASS pause on SMTP failure, explicit retry, cancel queued, disabled SMTP and separate SMTP identities. No real email sent.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));await db.end();const c=await mysql.createConnection(db.options);try{for(const name of owned.reverse())await c.query('DROP DATABASE IF EXISTS '+sqlName(name));}finally{await c.end();}});
