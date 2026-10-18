// Disposable tenant databases, in-memory mail transport and simulated payments only.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
process.env.DB_NAME=`tf_ticketmail_test_${Date.now()}_${process.pid}`;process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.SETTINGS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');delete process.env.BASE_DOMAIN;
const attachmentTestDir=require('node:fs').mkdtempSync('/tmp/ticket-email-attachments-');process.env.EMAIL_ATTACHMENT_DIR=attachmentTestDir;
const pdfRequests=[],realTicketPdf=require('../services/ticketPdf');
require.cache[require.resolve('../services/ticketPdf')].exports=async(...args)=>{pdfRequests.push(structuredClone(args[0]));return realTicketPdf(...args);};
const deliveries=[];let failNext=false;
require('nodemailer').createTransport=()=>({close(){},sendMail:async message=>{if(failNext){failNext=false;throw Error('Simulated failure');}deliveries.push(message);return {accepted:[message.to.address],rejected:[],messageId:'fixture-'+deliveries.length};}});
const db=require('../config/db'),{migrateTenant,migratePlatform,sqlName}=require('../saas/provision'),defaults=require('../services/studioDefaults');
let server,provider;const nativeFetch=global.fetch,owned=[db.database];
(async()=>{
 await migrateTenant(db.database);await migratePlatform();server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function req(path,method='GET',body,token,status=200){const r=await nativeFetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(json));return json.data;}
 const tenants=[];
 for(const slug of ['ticketmail-alpha','ticketmail-bravo']){
  const created=(await req('/api/saas/signup','POST',{company_name:slug,slug,name:'Email Owner',email:'owner@ticketmail.test',password:'TicketMailTest!123'},null,201)).organization;
  const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[created.id]);owned.push(org.db_name);await require('../saas/credits').adjust(org.id,3,'Isolated mail test',null,crypto.randomUUID());
  const token=(await req(`/api/o/${slug}/auth/login`,'POST',{email:'owner@ticketmail.test',password:'TicketMailTest!123'})).token;tenants.push({org,token,path:`/api/o/${slug}`});
 }
 const [a,b]=tenants;
 const event=(await req(a.path+'/admin/events','POST',{title:'Email ticket test',venue:'Hall',city:'Hyderabad',start_datetime:'2035-01-01 12:00:00',status:'published'},a.token,201)).event;
 const types=[];for(const name of ['Challenge','VIP','Standard'])types.push((await req(a.path+'/admin/ticket-types','POST',{event_id:event.id,name,price:0,quantity:100},a.token,201)).ticketType);
 const versions=[];
 for(const t of types){const path=a.path+'/admin/registration-forms/events/'+event.id+'/tickets/'+t.id,original=(await req(path,'GET',null,a.token)).form;versions.push((await req(path,'PUT',{inherit:false,version:original.version,config:{title:'Guest details',enabled:true,attendee_mode:'fields',fields:[{id:'f_name',type:'name',label:'Full name',required:true},{id:'f_email',type:'email',label:'Email',required:false},{id:'f_challenge-uuid',type:'select',label:'Challenge',options:['Mobilematica','Scriptmatica'],required:true}]}},a.token)).form.version);}
 const samplePdf=await require('../services/ticketPdf')({event_title:'Attachment fixture',attendee_name:'Preview Guest',ticket_code:'TCK-PREVIEW-NOT-VALID'},{company_name:'Fixture'});
 const pdfForm=new FormData();pdfForm.append('file',new Blob([samplePdf],{type:'application/pdf'}),'Guidelines.pdf');
 const uploadResponse=await nativeFetch(base+a.path+'/admin/studio/email-attachment',{method:'POST',headers:{Authorization:'Bearer '+a.token},body:pdfForm});assert.equal(uploadResponse.status,200);const uploaded=(await uploadResponse.json()).data.attachment;
 const download=await nativeFetch(base+a.path+'/admin/studio/email-attachments/'+uploaded.id,{headers:{Authorization:'Bearer '+a.token}});assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),samplePdf);
 await req(b.path+'/admin/studio/email-attachments/'+uploaded.id,'GET',null,b.token,400);
 await req(b.path+'/admin/studio/templates','POST',{kind:'email',name:'Not owned',config:{...defaults.email,attachments:[uploaded]}},b.token,400);
 const badForm=new FormData();badForm.append('file',new Blob(['not a PDF'],{type:'application/pdf'}),'invalid.pdf');assert.equal((await nativeFetch(base+a.path+'/admin/studio/email-attachment',{method:'POST',headers:{Authorization:'Bearer '+a.token},body:badForm})).status,400);
 const custom={...defaults.email,attach_ticket_pdf:true,attachments:[uploaded],subject:'Challenge {{field_f_challenge-uuid}} / {{attendee_name}} / {{registration_id}}',body:'<p>Hello {{attendee_name}} — {{field_f_challenge-uuid}}</p><p>{{ticket}}</p><p>{{registration_fields}}</p>',button_name:'SUBMIT YOUR WORK',button_url:'{{submission_url}}'};
 const tmpl=(await req(a.path+'/admin/studio/templates','POST',{kind:'email',name:'Challenge confirmation',active:true,config:custom},a.token,201)).template;
 const vip=(await req(a.path+'/admin/studio/templates','POST',{kind:'email',name:'VIP confirmation',active:true,config:{...custom,subject:'VIP {{attendee_name}}',body:'<p>VIP ONLY {{attendee_name}} {{ticket_qr}}</p>'}},a.token,201)).template;
 await req(a.path+'/admin/ticket-types/'+types[0].id,'PUT',{email_template_id:tmpl.id,submission_url:'https://forms.gle/h6sVEvBHWQJzNF7m6'},a.token);
 await req(a.path+'/admin/ticket-types/'+types[1].id,'PUT',{email_template_id:vip.id},a.token);
 await req(b.path+'/admin/studio/email-fields/'+types[0].id,'GET',null,a.token,403);
 await req(a.path+'/admin/ticket-types/'+types[0].id,'PUT',{email_template_id:999999},a.token,400);
 const bootstrap=await req(a.path+'/admin/studio/bootstrap','GET',null,a.token);
 const ticketDesign=bootstrap.ticketTemplates[0];await req(a.path+'/admin/ticket-types/'+types[0].id,'PUT',{email_template_id:ticketDesign.id},a.token,400);
 const boarding=bootstrap.ticketTemplates.find(t=>t.config.layout==='boarding'),badge=bootstrap.ticketTemplates.find(t=>t.config.layout==='badge');
 await req(a.path+'/admin/ticket-types/'+types[0].id,'PUT',{template_id:boarding.id},a.token);
 await req(a.path+'/admin/ticket-types/'+types[1].id,'PUT',{template_id:badge.id},a.token);
 const fields=await req(a.path+'/admin/studio/email-fields/'+types[0].id,'GET',null,a.token);assert.equal(fields.fields[2].key,'field_f_challenge-uuid');
 const preview=await req(a.path+'/admin/studio/email-preview','POST',{config:custom,ticket_type_id:types[0].id},a.token);assert.match(preview.html,/data:image\/png;base64,/);assert.match(preview.html,/Mobilematica/);assert.match(preview.html,/forms.gle\/h6sVEvBHWQJzNF7m6/);assert.equal(preview.ticket_pdf,true);assert.equal(preview.file_attachments[0].name,'Guidelines.pdf');assert.equal(deliveries.length,0);
 const pdfPreview=await nativeFetch(base+a.path+'/admin/studio/email-ticket-preview',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify({config:custom,ticket_type_id:types[0].id})});assert.equal(pdfPreview.status,200);assert.equal(Buffer.from(await pdfPreview.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 assert.equal(pdfRequests.at(-1).ticket_design.layout,'boarding');
 console.log('PASS assignment validation, tenant isolation, dynamic field tokens, and sample QR preview without sending.');
 await db.run(a.org,()=>require('../models/Studio').saveSetting('smtp',{enabled:true,host:'fixture.smtp.test',port:587,encryption:'none',from_email:'tickets@fixture.test',from_name:'Fixture'}));
 const guest=(name,email,challenge)=>({registration_answers:{f_name:name,f_email:email,'f_challenge-uuid':challenge}});
 function booking(){return {event_id:event.id,customer_name:'Buyer',email:'buyer@fixture.test',phone:'9876543210',request_key:crypto.randomUUID(),items:[{ticket_type_id:types[0].id,qty:2,form_version:versions[0],attendees:[guest('Guest One','shared@fixture.test','Mobilematica'),guest('Guest Two','shared@fixture.test','Scriptmatica')]},{ticket_type_id:types[1].id,qty:1,form_version:versions[1],attendees:[guest('VIP Guest','','Scriptmatica')]},{ticket_type_id:types[2].id,qty:1,form_version:versions[2],attendees:[guest('Default Guest','default@fixture.test','Mobilematica')]}]};}
 const payload=booking(),booked=await req(a.path+'/orders','POST',payload,null,201);
 await req(a.path+'/admin/ticket-types/'+types[0].id,'PUT',{template_id:badge.id},a.token);assert.equal(booked.tickets.length,4);assert.ok(booked.tickets.every(t=>t.email_snapshot===undefined));
 await req(a.path+'/orders','POST',payload,null,201);
 await req(a.path+'/admin/studio/templates/'+tmpl.id,'PUT',{name:tmpl.name,active:true,config:{...custom,subject:'CHANGED AFTER BOOKING'}},a.token);
 await db.run(a.org,async()=>{const [[n]]=await db.query('SELECT COUNT(*) n FROM mail_outbox WHERE order_id=?',[booked.order.id]);assert.equal(n.n,5);failNext=true;await require('../services/mailer').processOutbox();});
 assert.equal(deliveries.length,4);
 const log=await req(a.path+'/admin/studio/mail-log','GET',null,a.token);const failed=log.logs.find(l=>l.status==='failed');assert.ok(failed.ticket_id);assert.ok(log.logs.every(l=>l.template_snapshot===undefined));
 await req(a.path+'/admin/studio/mail-log/'+failed.id+'/retry','POST',{},a.token);
 await db.run(a.org,()=>require('../services/mailer').processOutbox());assert.equal(deliveries.length,5);
 const personal=deliveries.filter(m=>m.attachments?.length);assert.equal(personal.length,3);
 const first=personal.find(m=>m.subject.includes('Guest One')),second=personal.find(m=>m.subject.includes('Guest Two')),v=personal.find(m=>m.subject.startsWith('VIP'));
 assert.ok(first&&second&&v);assert.match(first.subject,/Mobilematica/);assert.match(second.subject,/Scriptmatica/);assert.doesNotMatch(first.html,/Guest Two|VIP Guest/);assert.doesNotMatch(second.html,/Guest One/);assert.equal(v.to.address,'buyer@fixture.test');assert.match(v.html,/VIP ONLY/);
 for(const m of personal){assert.equal(m.attachments.filter(f=>f.contentType==='application/pdf').length,2);assert(m.attachments.some(f=>f.filename==='Guidelines.pdf'&&f.content.equals(samplePdf)));assert(m.attachments.some(f=>/^ticket-TCK-.*\.pdf$/.test(f.filename)&&f.content.subarray(0,5).toString()==='%PDF-'));assert.match(m.html,/cid:ticket-qr@ticketflow/);assert.equal(m.attachments[0].content.subarray(1,4).toString(),'PNG');assert.match(m.attachments[0].filename,/^ticket-TCK-/);assert.doesNotMatch(m.html,/{{[^}]+}}/);}
 assert.ok(deliveries.some(m=>m.to.address==='default@fixture.test'&&!m.attachments));assert.ok(deliveries.some(m=>m.to.address==='buyer@fixture.test'&&!m.attachments));
 assert.equal(pdfRequests.find(p=>p.attendee_name==='Guest One'&&!p.ticket_code.includes('PREVIEW')).ticket_design.layout,'boarding');
 assert.equal(pdfRequests.find(p=>p.attendee_name==='VIP Guest').ticket_design.layout,'badge');
 console.log('PASS selected ticket designs and immutable issued-design snapshots.');
 console.log('PASS mixed pass routing, separate messages to shared addresses, buyer fallback, default receipt, real QR PNGs, immutable snapshots, and retry without duplicate jobs.');
 // Paid reservation freezes the selected template before capture.
 await db.run(a.org,()=>db.query('UPDATE ticket_types SET price=10 WHERE id=?',[types[0].id]));
 await db.platform.query("INSERT INTO platform_admins(name,email,password_hash) VALUES ('Fixture','fixture@ticketmail.test','unused')");
 await require('../saas/paymentSettings').save({mode:'test',key_id:'rzp_test_ticketmail',key_secret:'fixture-secret',webhook_secret:'fixture-webhook'},1);
 global.fetch=async(url,options)=>{if(!String(url).startsWith('https://api.razorpay.com/v1/'))return nativeFetch(url,options);const path=String(url).split('/v1/')[1];if(path==='orders'){provider={...JSON.parse(options.body),id:'order_ticketmail',status:'created'};return Response.json(provider);}if(path==='orders/order_ticketmail')return Response.json(provider);throw Error('Unexpected gateway operation '+path);};
 const paid=booking();paid.items=paid.items.slice(0,1);const reserved=await req(a.path+'/orders','POST',paid,null,201);assert.equal(reserved.tickets.length,0);
 await db.run(a.org,async()=>{const [[n]]=await db.query('SELECT COUNT(*) n FROM mail_outbox WHERE order_id=?',[reserved.order.id]);assert.equal(n.n,0);});
 await req(a.path+'/admin/ticket-types/'+types[0].id,'PUT',{email_template_id:null},a.token);
 await req(a.path+'/admin/studio/templates/'+tmpl.id,'PUT',{name:tmpl.name,active:true,config:{...custom,subject:'CHANGED WHILE PENDING'}},a.token);
 provider.status='paid';const payment={id:'pay_ticketmail',order_id:provider.id,amount:2000,currency:'INR',status:'captured',captured:true};const settings=await require('../saas/paymentSettings').get();
 await Promise.all([1,2].map(()=>require('../services/bookingPayments').fulfill(payment,settings)));
 const before=deliveries.length;await db.run(a.org,()=>require('../services/mailer').processOutbox());assert.equal(deliveries.length,before+3);
 assert.equal(deliveries.slice(before).filter(m=>m.subject==='CHANGED AFTER BOOKING').length,2);
 console.log('PASS no tickets or emails before payment, reservation template snapshot survives edits, duplicate captures issue/send only once.');
 // Disabled custom assignments fall back to the default for new bookings.
 await req(a.path+'/admin/studio/templates/'+vip.id,'PUT',{name:vip.name,active:false,config:vip.config},a.token);
 const fallback=booking();fallback.items=fallback.items.slice(1,2);const f=await req(a.path+'/orders','POST',fallback,null,201);
 await db.run(a.org,async()=>{const [jobs]=await db.query('SELECT * FROM mail_outbox WHERE order_id=?',[f.order.id]);assert.equal(jobs.length,1);assert.equal(jobs[0].ticket_id,null);await require('../services/mailer').processOutbox();});
 const defaultTemplate=bootstrap.emailTemplates.find(t=>t.event_key==='booking_confirmed');
 await req(a.path+'/admin/studio/templates/'+defaultTemplate.id,'PUT',{name:defaultTemplate.name,active:true,config:{...defaultTemplate.config,body:'<p>DEFAULT PERSONAL {{attendee_name}} {{ticket}}</p>'}},a.token);
 const defaultPersonal=booking();defaultPersonal.items=defaultPersonal.items.slice(2);const dp=await req(a.path+'/orders','POST',defaultPersonal,null,201);const count=deliveries.length;
 await db.run(a.org,()=>require('../services/mailer').processOutbox());assert.equal(deliveries.length,count+2);assert.equal(deliveries.slice(count).filter(m=>m.attachments?.length).length,1);assert.match(deliveries.slice(count).find(m=>m.attachments?.length).html,/DEFAULT PERSONAL Default Guest/);
 await req(a.path+'/admin/studio/templates/'+defaultTemplate.id,'PUT',{name:defaultTemplate.name,active:true,config:defaultTemplate.config},a.token);
 console.log('PASS inactive custom fallback and editable default template with personal ticket tokens.');

 // All default booking emails support uploads without ticket PDFs or QR attachments.
 for(const original of bootstrap.emailTemplates.filter(t=>t.event_key)){
  const fileConfig={...original.config,attach_ticket_pdf:false,attachments:[uploaded],body:original.config.body+'<p>{{attachments}}</p>'};
  const saved=(await req(a.path+'/admin/studio/templates/'+original.id,'PUT',{name:original.name,active:true,config:fileConfig},a.token)).template;
  assert.equal(saved.config.attach_ticket_pdf,false);assert.equal(saved.config.attachments[0].id,uploaded.id);
  const filePreview=await req(a.path+'/admin/studio/email-preview','POST',{config:saved.config},a.token);
  assert.equal(filePreview.ticket_pdf,false);assert.equal(filePreview.file_attachments[0].name,'Guidelines.pdf');assert.match(filePreview.html,/Guidelines.pdf/);
  const start=deliveries.length,pdfStart=pdfRequests.length;
  await req(a.path+'/admin/studio/email-test','POST',{config:saved.config,recipient:'default-test@fixture.test'},a.token);
  const one=booking();one.items=one.items.slice(2);const order=await req(a.path+'/orders','POST',one,null,201);
  await db.run(a.org,async()=>{
   if(original.event_key!=='booking_confirmed')await require('../services/mailer').enqueue(db,order.order.id,original.event_key);
   await require('../services/mailer').processOutbox();
  });
  const matched=deliveries.slice(start).filter(m=>m.attachments?.some(f=>f.filename==='Guidelines.pdf'));
  assert.equal(matched.length,original.event_key==='booking_confirmed'?3:2);
  for(const m of matched){assert.equal(m.attachments.length,1);assert.equal(m.attachments[0].filename,'Guidelines.pdf');assert(m.attachments[0].content.equals(samplePdf));assert.doesNotMatch(m.html,/cid:ticket-qr|personalized ticket PDF/);}
  assert.equal(pdfRequests.length,pdfStart,'Default emails must not generate ticket PDFs');
  await req(a.path+'/admin/studio/templates/'+original.id,'PUT',{name:original.name,active:true,config:original.config},a.token);
 }
 console.log('PASS all three default templates: upload/save/preview/test and automatic delivery attach only the uploaded PDF, with no ticket PDF or QR file.');

 // Confirmation can opt into personal ticket PDFs while retaining uploaded documents.
 const pdfConfirmation={...defaultTemplate.config,attach_ticket_pdf:true,attachments:[uploaded]};
 await req(a.path+'/admin/studio/templates/'+defaultTemplate.id,'PUT',{name:defaultTemplate.name,active:true,config:pdfConfirmation},a.token);
 const confirmPreview=await req(a.path+'/admin/studio/email-preview','POST',{config:pdfConfirmation,ticket_type_id:types[2].id},a.token);
 assert.equal(confirmPreview.ticket_pdf,true);assert.equal(confirmPreview.file_attachments[0].name,'Guidelines.pdf');
 const confirmOrder=booking();confirmOrder.items=confirmOrder.items.slice(2);
 const confirmStart=deliveries.length,pdfStart=pdfRequests.length;
 await req(a.path+'/orders','POST',confirmOrder,null,201);
 await db.run(a.org,()=>require('../services/mailer').processOutbox());
 const confirmMessages=deliveries.slice(confirmStart);assert.equal(confirmMessages.length,2);
 const personalConfirmation=confirmMessages.find(m=>m.to.address==='default@fixture.test');
 assert.equal(personalConfirmation.attachments.length,2);
 assert(personalConfirmation.attachments.some(f=>f.filename==='Guidelines.pdf'&&f.content.equals(samplePdf)));
 assert(personalConfirmation.attachments.some(f=>/^ticket-TCK-.*\.pdf$/.test(f.filename)&&f.content.subarray(0,5).toString()==='%PDF-'));
 assert.equal(pdfRequests.length,pdfStart+1);assert.equal(pdfRequests.at(-1).attendee_name,'Default Guest');
 assert.equal(pdfRequests.at(-1).ticket_design.layout,'classic');
 assert(!confirmMessages.find(m=>m.to.address==='buyer@fixture.test').attachments);
 await req(a.path+'/admin/studio/templates/'+defaultTemplate.id,'PUT',{name:defaultTemplate.name,active:true,config:defaultTemplate.config},a.token);
 console.log('PASS default booking confirmation with selected-design ticket PDF and uploaded PDF for attendee; separate buyer receipt.');
 if(process.env.EMAIL_UI_QA==='1'){console.log('EMAIL_UI_API='+base);console.log('EMAIL_UI_EVENT='+event.id);await new Promise(r=>process.once('SIGTERM',r));}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{global.fetch=nativeFetch;if(server)await new Promise(r=>server.close(r));await db.end();require('node:fs').rmSync(attachmentTestDir,{recursive:true,force:true});const c=await mysql.createConnection(db.options);try{for(const name of owned.reverse())await c.query('DROP DATABASE IF EXISTS '+sqlName(name));}finally{await c.end();}});
