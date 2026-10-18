// Disposable databases, simulated gateway, no real mail or payment.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
process.env.DB_NAME=`tf_attendees_test_${Date.now()}_${process.pid}`;process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.SETTINGS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');delete process.env.BASE_DOMAIN;
const db=require('../config/db'),{migrateTenant,migratePlatform,sqlName}=require('../saas/provision');
const nativeFetch=global.fetch,owned=[db.database];let server,provider;
const deliveries=[];let failedRecipient;
require('nodemailer').createTransport=options=>({close(){},sendMail:async message=>{if(message.to.address===failedRecipient){failedRecipient=null;throw new Error('Simulated delivery failure');}deliveries.push({options,message});return {accepted:[message.to.address],rejected:[],messageId:'fixture-'+deliveries.length};}});
(async()=>{
 await migrateTenant(db.database);await migratePlatform();server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function req(path,method='GET',body,token,status=200){const r=await nativeFetch(base+path,{method,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});const json=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(json));return json.data;}
 const tenants=[];
 for(const slug of ['attendees-alpha','attendees-bravo']){
  const created=(await req('/api/saas/signup','POST',{company_name:slug,slug,name:'Test Owner',email:'owner@attendees.test',password:'AttendeeTestPassword!123'},null,201)).organization;
  const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[created.id]);owned.push(org.db_name);await require('../saas/credits').adjust(org.id,3,'Attendee integration test',null,crypto.randomUUID());
  const token=(await req(`/api/o/${slug}/auth/login`,'POST',{email:'owner@attendees.test',password:'AttendeeTestPassword!123'})).token;tenants.push({org,token,path:`/api/o/${slug}`});
 }
 const [a,b]=tenants,event=(await req(a.path+'/admin/events','POST',{title:'Personal tickets',venue:'Hall',city:'City',start_datetime:'2035-01-01 12:00:00',end_datetime:'2035-01-01 18:00:00',status:'published'},a.token,201)).event;
 const types=[];for(const name of ['VIP','General'])types.push((await req(a.path+'/admin/ticket-types','POST',{event_id:event.id,name,price:0,quantity:100},a.token,201)).ticketType);
 const config={title:'Your visit',description:'',enabled:true,fields:[{id:'f_meal',type:'text',label:'Meal preference',required:true},{id:'f_document',type:'file',label:'Attachment'}]};
 await req(a.path+'/admin/registration-forms/events/'+event.id,'PUT',{config,revision:0},a.token);
 const items=types.map((t,i)=>({ticket_type_id:t.id,qty:i?3:2,attendees:Array.from({length:i?3:2},(_,j)=>({name:`${t.name} guest ${j+1}`,email:`guest${i}${j}@attendees.test`,phone:'+91 9876543210',registration_answers:{f_meal:`Meal ${i}-${j}`}}))}));
 const payload=()=>({event_id:event.id,customer_name:'Booking Contact',phone:'9876543210',email:'booker@attendees.test',items:structuredClone(items),form_revision:1,request_key:crypto.randomUUID()});
 const invalid=payload();delete invalid.items[0].attendees;await req(a.path+'/orders','POST',invalid,null,400);
 const short=payload();short.items[0].attendees.pop();await req(a.path+'/orders','POST',short,null,400);
 const missing=payload();missing.items[1].attendees[2].registration_answers={};await req(a.path+'/orders','POST',missing,null,400);
 const invalidName=payload();invalidName.items[0].attendees[0].name='  ';await req(a.path+'/orders','POST',invalidName,null,400);
 for(const field of ['name','email','phone']){const missingContact=payload();missingContact.items[0].attendees[0][field]='';await req(a.path+'/orders','POST',missingContact,null,400);}
 const badPhone=payload();badPhone.items[0].attendees[0].phone='------';await req(a.path+'/orders','POST',badPhone,null,400);
 const wrongEmail=payload();wrongEmail.items[0].attendees[0].email='bad';await req(a.path+'/orders','POST',wrongEmail,null,400);
 await req(a.path+'/orders','POST',{...payload(),form_revision:0},null,409);
 await db.run(a.org,async()=>{const [[row]]=await db.query('SELECT SUM(sold) sold FROM ticket_types WHERE event_id=?',[event.id]);assert.equal(Number(row.sold),0);});
 const freePayload=payload(),multipart=new FormData();multipart.append('booking',JSON.stringify(freePayload));
 multipart.append(`attendee_file_${types[0].id}_0_f_document`,new Blob(['%PDF-1.7\nVIP attachment'],{type:'application/pdf'}),'vip.pdf');
 multipart.append(`attendee_file_${types[1].id}_2_f_document`,new Blob(['%PDF-1.7\nGeneral attachment'],{type:'application/pdf'}),'general.pdf');
 const free=await req(a.path+'/orders','POST',multipart,null,201),expected=items.flatMap(i=>i.attendees);
 assert.equal(free.tickets.length,5);assert.equal(new Set(free.tickets.map(t=>t.ticket_code)).size,5);assert.equal(new Set(free.tickets.map(t=>t.attendee_id)).size,5);assert.deepEqual(free.tickets.map(t=>t.attendee_name),expected.map(p=>p.name));
 assert.equal((await req(a.path+'/orders','POST',freePayload,null,201)).order.id,free.order.id);
 for(let i=0;i<free.tickets.length;i++){const t=free.tickets[i],lookup=(await req(a.path+'/admin/tickets/'+t.ticket_code,'GET',null,a.token)).ticket;assert.equal(lookup.attendee_name,expected[i].name);assert.equal(lookup.attendee_email,expected[i].email);assert.equal(lookup.attendee_answers.find(x=>x.id==='f_meal').value,expected[i].registration_answers.f_meal);await req(b.path+'/admin/tickets/'+t.ticket_code,'GET',null,b.token,404);}
 const ticket=free.tickets[0];await req(a.path+'/admin/tickets/'+ticket.ticket_code,'GET',null,null,401);
 const checked=await req(a.path+'/admin/tickets/checkin','POST',{ticket_code:ticket.ticket_code},a.token);assert.equal(checked.ticket.attendee_name,expected[0].name);await req(a.path+'/admin/tickets/checkin','POST',{ticket_code:ticket.ticket_code},a.token,409);assert.equal((await req(a.path+'/admin/tickets/'+free.tickets[1].ticket_code,'GET',null,a.token)).ticket.status,'valid');
 const detail=await req(a.path+'/admin/orders/'+free.order.id,'GET',null,a.token);assert.equal(detail.attendees.length,5);assert.equal(detail.registration,null);
 for(const [t,content] of [[free.tickets[0],'VIP attachment'],[free.tickets[4],'General attachment']]){const path=`/admin/orders/${free.order.id}/attendees/${t.attendee_id}/files/f_document`;const r=await nativeFetch(base+a.path+path,{headers:{Authorization:'Bearer '+a.token}});assert.equal(r.status,200);assert.ok((await r.text()).includes(content));await req(b.path+path,'GET',null,b.token,404);await req(a.path+path,'GET',null,null,401);}
 assert.equal((await req(a.path+'/admin/registration-forms/events/'+event.id+'/responses','GET',null,a.token)).total,5);
 console.log('PASS 2 VIP + 3 General: separate names, answers, uploads, unique QR tickets, authorized lookup, correct check-in, duplicate rejection.');
 await req(a.path+'/admin/registration-forms/events/'+event.id,'PUT',{config:{...config,fields:[{id:'f_new',type:'text',label:'New question',required:true}]},revision:1},a.token);
 assert.equal((await req(a.path+'/admin/tickets/'+ticket.ticket_code,'GET',null,a.token)).ticket.attendee_answers[0].label,'Meal preference');
 await req(a.path+'/admin/registration-forms/events/'+event.id,'PUT',{config,revision:2},a.token);
 await db.run(a.org,()=>db.query('UPDATE ticket_types SET price=10 WHERE event_id=?',[event.id]));
 await db.platform.query("INSERT INTO platform_admins(name,email,password_hash) VALUES ('Fixture','fixture@attendees.test','unused')");
 await require('../saas/paymentSettings').save({mode:'test',key_id:'rzp_test_attendees',key_secret:'fixture-secret',webhook_secret:'fixture-webhook'},1);
 global.fetch=async(url,options)=>{if(!String(url).startsWith('https://api.razorpay.com/v1/'))return nativeFetch(url,options);const path=String(url).split('/v1/')[1];if(path==='orders'){provider={...JSON.parse(options.body),id:'order_attendees',status:'created'};return Response.json(provider);}if(path==='orders/order_attendees')return Response.json(provider);throw Error('Unexpected provider operation '+path);};
 await db.run(a.org,async()=>{
  const Studio=require('../models/Studio');await Studio.saveSetting('smtp',{enabled:true,host:'attendee.smtp.test',port:587,encryption:'none',from_name:'Event Team',from_email:'tickets@example.test'});
  const defaults=require('../services/studioDefaults');await db.query("UPDATE design_templates SET active=1,config_json=? WHERE event_key='booking_confirmed'",[JSON.stringify({...defaults.email,subject:'Your personal confirmation {{booking_ref}}',body:'<p>Hello {{customer_name}}, your confirmed event is {{event_title}}.</p>'})]);
 });
 const paidPayload={...payload(),form_revision:3};
 paidPayload.items[1].attendees[0].email=paidPayload.items[0].attendees[0].email;
 const pending=await req(a.path+'/orders','POST',paidPayload,null,201);assert.equal(pending.tickets.length,0);assert.equal(pending.attendees.length,5);assert.deepEqual(pending.attendees.map(p=>p.name),expected.map(p=>p.name));
 await db.run(a.org,async()=>{const [[count]]=await db.query('SELECT COUNT(*) n FROM mail_outbox WHERE order_id=?',[pending.order.id]);assert.equal(count.n,0);});
 assert.equal(deliveries.length,0);
 const retry=structuredClone(paidPayload);retry.items[0].attendees[0].name='Attempted overwrite';assert.equal((await req(a.path+'/orders','POST',retry,null,201)).attendees[0].name,expected[0].name);
 provider.status='paid';const payment={id:'pay_attendees',order_id:provider.id,amount:5000,currency:'INR',status:'captured',captured:true},settings=await require('../saas/paymentSettings').get();
 await Promise.all([1,2].map(()=>require('../services/bookingPayments').fulfill(payment,settings)));
 const paid=await req(a.path+'/admin/orders/'+pending.order.id,'GET',null,a.token);assert.equal(paid.tickets.length,5);assert.deepEqual(paid.tickets.map(t=>t.attendee_name),expected.map(p=>p.name));assert.equal(new Set(paid.tickets.map(t=>t.attendee_id)).size,5);
 await db.run(a.org,async()=>{
  const mailer=require('../services/mailer');
  const [jobs]=await db.query('SELECT * FROM mail_outbox WHERE order_id=?',[pending.order.id]);assert.equal(jobs.length,5);assert.ok(jobs.every(j=>j.status==='pending'));
  failedRecipient=paidPayload.items[0].attendees[1].email;
  await mailer.processOutbox();assert.equal(deliveries.length,4);
  await mailer.processOutbox();assert.equal(deliveries.length,4);
  const [[failed]]=await db.query("SELECT * FROM mail_outbox WHERE order_id=? AND status='failed'",[pending.order.id]);assert.ok(failed);
  await req(a.path+'/admin/studio/mail-log/'+failed.id+'/retry','POST',{},a.token);
  await mailer.processOutbox();assert.equal(deliveries.length,5);
  const expectedEmails=new Set([paidPayload.email,...paidPayload.items.flatMap(i=>i.attendees.map(p=>p.email))]);assert.deepEqual(new Set(deliveries.map(d=>d.message.to.address)),expectedEmails);
  for(const d of deliveries){assert.equal(d.options.host,'attendee.smtp.test');assert.match(d.message.subject,/Your personal confirmation/);assert.ok(d.message.html.includes(pending.order.booking_ref));assert.match(d.message.html,/Personal tickets/);assert.match(d.message.html,/Open your booking and QR tickets/);assert.match(d.message.html,/TCK-/);}
  const logs=(await req(a.path+'/admin/studio/mail-log','GET',null,a.token)).logs.filter(j=>j.order_id===pending.order.id);assert.deepEqual(new Set(logs.map(j=>j.email)),expectedEmails);
  const [[count]]=await db.query("SELECT COUNT(*) n FROM mail_outbox WHERE order_id=? AND status='sent'",[pending.order.id]);assert.equal(count.n,5);
 });
 console.log('PASS mandatory contact details and template emails to every distinct address only after payment; failed delivery retries individually.');
 console.log('PASS payment snapshots, saved answers after form edits, immutable retries and exactly one ticket per attendee after duplicate captures.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{global.fetch=nativeFetch;if(server)await new Promise(r=>server.close(r));await db.end();const conn=await mysql.createConnection(db.options);try{for(const name of owned.reverse())await conn.query('DROP DATABASE IF EXISTS '+sqlName(name));}finally{await conn.end();}});
