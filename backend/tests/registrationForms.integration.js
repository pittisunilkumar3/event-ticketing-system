// Disposable databases only; no real email or payment provider is contacted.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
process.env.DB_NAME=`tf_forms_test_${Date.now()}_${process.pid}`;process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.SETTINGS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');delete process.env.BASE_DOMAIN;
const db=require('../config/db'),{migrateTenant,migratePlatform,sqlName}=require('../saas/provision');let server,connection,total=0;const pass=message=>{total++;console.log('PASS '+message);};
(async()=>{
 await migrateTenant(db.database);await migratePlatform();server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function req(path,method='GET',body,token,status=200){if(method==='POST'&&path.endsWith('/orders')){if(body instanceof FormData){const booking=JSON.parse(body.get('booking'));Object.assign(booking,withAttendee(booking));booking.request_key=crypto.randomUUID();body.set('booking',JSON.stringify(booking));}else body={...withAttendee(body),request_key:crypto.randomUUID()};}const r=await fetch(base+path,{method,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});const json=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(json));return json.data;}
 const tenants=[];
 for(const slug of ['forms-alpha','forms-bravo']){const org=(await req('/api/saas/signup','POST',{company_name:slug,slug,name:'Form Owner',email:'owner@forms.test',password:'FormsTestPassword!123'},null,201)).organization;await db.platform.query('UPDATE organizations SET event_balance=10 WHERE id=?',[org.id]);await require('./helpers/paidPackage')(db.platform,org.id,10);const token=(await req(`/api/o/${slug}/auth/login`,'POST',{email:'owner@forms.test',password:'FormsTestPassword!123'})).token;tenants.push({org,token,path:`/api/o/${slug}`});}
 const [a,b]=tenants;
 async function event(t,title){return (await req(t.path+'/admin/events','POST',{title,venue:'Hall',city:'City',start_datetime:'2035-01-01 12:00:00',end_datetime:'2035-01-01 18:00:00',status:'published'},t.token,201)).event;}
 const e=await event(a,'Registration Showcase'),other=await event(a,'Other Event'),be=await event(b,'Other Organization');
 const type=(await req(a.path+'/admin/ticket-types','POST',{event_id:e.id,name:'General',price:0,quantity:50},a.token,201)).ticketType;
 const root=a.path+'/admin/registration-forms',path=root+'/events/'+e.id;
 const blank=(await req(path,'GET',null,a.token)).form;assert.equal(blank.revision,0);assert.equal(blank.config.enabled,false);
 const field=(id,type,rest={})=>({id:'f_'+id,type,label:id,required:false,width:12,options:[],...rest});
 let config={title:'Guest information',description:'Help us prepare your visit.',enabled:true,fields:[field('company','text',{label:'Company',required:true}),field('meal','radio',{label:'Meal preference',options:['Standard','Special']}),field('diet','textarea',{label:'Dietary requirements',required:true,condition:{field_id:'f_meal',value:'Special'}}),field('age','number',{label:'Age',min:18,max:100}),field('interests','checkboxes',{label:'Interests',options:['Workshops','Networking'],required:true}),field('terms','consent',{label:'I agree',required:true}),field('document','file',{label:'Supporting document',required:true})]};
 await req(path,'PUT',{config,revision:0},null,401);await req(b.path+'/admin/registration-forms/events/'+be.id,'PUT',{config,revision:0},a.token,403);
 let form=(await req(path,'PUT',{config,revision:0},a.token)).form;assert.equal(form.revision,1);
 await req(path,'PUT',{config,revision:0},a.token,409);
 assert.equal((await req(a.path+'/events/'+e.slug)).registrationForm.config.fields.length,7);
 assert.equal((await req(a.path+'/events/'+other.slug)).registrationForm.config.fields.length,0);
 assert.equal((await req(b.path+'/events/'+be.slug)).registrationForm.config.fields.length,0);
 const tmpl=await req(root+'/templates','POST',{name:'Conference guests',config},a.token,201);assert.ok(tmpl.template.id);assert.equal((await req(b.path+'/admin/registration-forms/templates','GET',null,b.token)).templates.length,0);
 pass('forms, public checkout definitions and reusable templates stay scoped to their event and organization');
 function withAttendee(data){return {...data,phone:'9876543210',items:data.items.map(item=>({...item,attendees:item.attendees||[{name:data.customer_name,email:data.email,phone:'9876543210',registration_answers:data.registration_answers||{}}]}))};}
 const payload={event_id:e.id,customer_name:'Test Guest',email:'guest@forms.test',items:[{ticket_type_id:type.id,qty:1}],form_revision:1,registration_answers:{f_company:'Example Company',f_meal:'Special',f_diet:'Vegan',f_age:'24',f_interests:['Workshops'],f_terms:true}};
 function multipart(data=payload,content='%PDF-1.7\nfixture'){const f=new FormData();f.append('booking',JSON.stringify(data));f.append(`attendee_file_${type.id}_0_f_document`,new Blob([content],{type:'application/pdf'}),'support.pdf');return f;}
 await req(a.path+'/orders','POST',{...payload,form_revision:0},null,409);
 await req(a.path+'/orders','POST',multipart({...payload,registration_answers:{...payload.registration_answers,f_company:''}}),null,400);
 await req(a.path+'/orders','POST',multipart({...payload,registration_answers:{...payload.registration_answers,f_diet:''}}),null,400);
 await req(a.path+'/orders','POST',multipart({...payload,registration_answers:{...payload.registration_answers,f_age:10}}),null,400);
 await req(a.path+'/orders','POST',multipart(payload,'<script>alert(1)</script>'),null,400);
 await req(a.path+'/orders','POST',payload,null,400);
 assert.equal((await req(a.path+'/admin/events/'+e.id,'GET',null,a.token)).ticketTypes[0].sold,0);
 assert.equal((await req(a.path+'/admin/orders','GET',null,a.token)).pagination.total,0);
 pass('stale forms, missing required answers, invalid ranges and forged files cannot create orders or reserve inventory');
 const booking=await req(a.path+'/orders','POST',multipart(),null,201);
 assert.equal(booking.registration,undefined);
 const detail=await req(a.path+'/admin/orders/'+booking.order.id,'GET',null,a.token);assert.equal(detail.attendees[0].answers.find(f=>f.id==='f_company').value,'Example Company');assert.equal(detail.attendees[0].answers.find(f=>f.id==='f_document').value.name,'support.pdf');
 const publicBooking=await req(a.path+'/bookings/'+booking.order.booking_ref);assert.equal(publicBooking.registration,undefined);assert.equal(publicBooking.order.registration_answers,undefined);
 const filePath=a.path+'/admin/orders/'+booking.order.id+'/attendees/'+detail.attendees[0].id+'/files/f_document';await req(filePath,'GET',null,null,401);await req(filePath,'GET',null,b.token,403);
 const file=await fetch(base+filePath,{headers:{Authorization:'Bearer '+a.token}});assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'application/pdf');assert.match(file.headers.get('content-disposition'),/attachment/);assert.equal(await file.text(),'%PDF-1.7\nfixture');
 const responses=await req(path+'/responses','GET',null,a.token);assert.equal(responses.total,1);
 pass('answers and files persist with the booking; only authorized organizer admins can download attachments');
 form=(await req(path,'PUT',{config:{...config,fields:[]},revision:1},a.token)).form;
 const preserved=await req(a.path+'/admin/orders/'+booking.order.id,'GET',null,a.token);assert.equal(preserved.attendees[0].answers.length,7);assert.equal(preserved.attendees[0].answers[0].label,'Company');
 await req(path,'PUT',{config:{...config,fields:config.fields.filter(f=>f.id!=='f_document')},revision:2},a.token);
 const hidden={...payload,form_revision:3,registration_answers:{...payload.registration_answers,f_meal:'Standard',f_diet:''}};
 const second=await req(a.path+'/orders','POST',hidden,null,201);const secondDetail=await req(a.path+'/admin/orders/'+second.order.id,'GET',null,a.token);assert.ok(!secondDetail.attendees[0].answers.some(a=>a.id==='f_diet'));
 await req(path,'PUT',{config:{...config,enabled:false},revision:3},a.token);
 await req(a.path+'/orders','POST',{event_id:e.id,customer_name:'No extra questions',email:'guest@forms.test',items:[{ticket_type_id:type.id,qty:1}]},null,201);
 pass('editing or removing fields preserves historic answers; hidden required fields and disabled forms do not block bookings');
 // Different ticket questions are enforced and snapshotted for every attendee.
 const vip=(await req(a.path+'/admin/ticket-types','POST',{event_id:e.id,name:'VIP',price:0,quantity:50},a.token,201)).ticketType;
 const typePath=path+'/tickets/'+type.id,vipPath=path+'/tickets/'+vip.id;
 const common=(await req(typePath,'GET',null,a.token)).form;
 assert.equal(common.source,'event');
 const generalConfig={title:'General questions',enabled:true,fields:[field('company','text',{label:'Company',required:true})]};
 const vipConfig={title:'VIP questions',enabled:true,fields:[field('meal','select',{label:'VIP meal',options:['Vegan','Standard'],required:true}),field('document','file',{label:'VIP document',required:true})]};
 const general=(await req(typePath,'PUT',{config:generalConfig,inherit:false,version:common.version},a.token)).form;
 const initialVip=(await req(vipPath,'GET',null,a.token)).form;
 let vipForm=(await req(vipPath,'PUT',{config:vipConfig,inherit:false,version:initialVip.version},a.token)).form;
 await req(typePath,'PUT',{config:generalConfig,inherit:false,version:common.version},a.token,409);
 await req(b.path+'/admin/registration-forms/events/'+be.id+'/tickets/'+type.id,'GET',null,a.token,403);
 await req(root+'/events/'+other.id+'/tickets/'+type.id,'GET',null,a.token,404);
 const checkout=await req(a.path+'/events/'+e.slug);
 assert.equal(checkout.ticketTypes.find(t=>t.id===type.id).registrationForm.config.title,'General questions');
 assert.equal(checkout.ticketTypes.find(t=>t.id===vip.id).registrationForm.config.title,'VIP questions');
 const person=(name,answers)=>({name,email:'guest@forms.test',phone:'9876543210',registration_answers:answers});
 const mixed={event_id:e.id,customer_name:'Mixed booking',email:'guest@forms.test',form_revision:4,items:[{ticket_type_id:type.id,qty:2,form_version:general.version,attendees:[person('General One',{f_company:'Company A'}),person('General Two',{f_company:'Company B'})]},{ticket_type_id:vip.id,qty:1,form_version:vipForm.version,attendees:[person('VIP Guest',{f_meal:'Vegan'})]}]};
 function mixedFiles(data){const f=new FormData();f.append('booking',JSON.stringify(data));f.append(`attendee_file_${vip.id}_0_f_document`,new Blob(['%PDF-1.7\nVIP attachment'],{type:'application/pdf'}),'vip.pdf');return f;}
 const noVersion=structuredClone(mixed);delete noVersion.items[1].form_version;
 await req(a.path+'/orders','POST',mixedFiles(noVersion),null,409);
 const missing=structuredClone(mixed);missing.items[0].attendees[1].registration_answers={};
 await req(a.path+'/orders','POST',mixedFiles(missing),null,400);
 const wrongQuestion=structuredClone(mixed);wrongQuestion.items[1].attendees[0].registration_answers={f_company:'Not a VIP field'};
 await req(a.path+'/orders','POST',mixedFiles(wrongQuestion),null,409);
 await req(a.path+'/orders','POST',mixed,null,400);
 const mixedBooking=await req(a.path+'/orders','POST',mixedFiles(mixed),null,201);
 const mixedDetail=await req(a.path+'/admin/orders/'+mixedBooking.order.id,'GET',null,a.token);
 assert.equal(mixedDetail.attendees.length,3);
 assert.deepEqual(mixedDetail.attendees.filter(a=>a.ticket_type_id===type.id).map(a=>a.answers[0].value),['Company A','Company B']);
 const vipAnswers=mixedDetail.attendees.find(a=>a.ticket_type_id===vip.id).answers;
 assert.equal(vipAnswers[0].label,'VIP meal');assert.equal(vipAnswers[1].value.name,'vip.pdf');
 vipForm=(await req(vipPath,'PUT',{inherit:true,version:vipForm.version},a.token)).form;
 assert.equal(vipForm.source,'event');assert.equal(vipForm.config.enabled,false);
 await req(a.path+'/orders','POST',mixedFiles(mixed),null,409);
 const inherited={...mixed,items:[{ticket_type_id:vip.id,qty:1,form_version:vipForm.version,attendees:[person('Default Guest',{})]}]};
 await req(a.path+'/orders','POST',inherited,null,201);
 const history=await req(a.path+'/admin/orders/'+mixedBooking.order.id,'GET',null,a.token);
 assert.equal(history.attendees.find(a=>a.ticket_type_id===vip.id).answers[0].label,'VIP meal');
 const [[snapshot]]=await db.run(await db.platform.query('SELECT * FROM organizations WHERE id=?',[a.org.id]).then(([rows])=>rows[0]),()=>db.query('SELECT form_json FROM order_attendees WHERE order_id=? AND ticket_type_id=?',[mixedBooking.order.id,vip.id]));
 assert.equal(JSON.parse(snapshot.form_json).source,'ticket');
 pass('mixed-ticket bookings enforce separate questions, per-attendee answers and uploads; stale versions fail and historical answers survive inheritance changes');
 // All attendee fields, including contacts, are organizer-defined per pass.
 const editableConfig={title:'VIP attendee',enabled:true,attendee_mode:'fields',fields:[field('name','name',{label:'Full name',required:true}),field('email','email',{label:'Personal email',required:true}),field('phone','tel',{label:'Mobile',required:false})]};
 const editableForm=(await req(vipPath,'PUT',{inherit:false,version:vipForm.version,config:editableConfig},a.token)).form;
 const minimal=(await req(typePath,'PUT',{inherit:false,version:general.version,config:{title:'No questions',enabled:true,attendee_mode:'fields',fields:[]}},a.token)).form;
 const customBooking={event_id:e.id,customer_name:'Booking Contact',email:'booker@forms.test',items:[{ticket_type_id:vip.id,qty:2,form_version:editableForm.version,attendees:[{registration_answers:{f_name:'First VIP',f_email:'first@forms.test'}},{registration_answers:{f_name:'Second VIP',f_email:'second@forms.test',f_phone:'+91 9876543210'}}]},{ticket_type_id:type.id,qty:1,form_version:minimal.version,attendees:[{}]}]};
 const missingRequired=structuredClone(customBooking);delete missingRequired.items[0].attendees[1].registration_answers.f_email;
 await req(a.path+'/orders','POST',missingRequired,null,400);
 const badContact=structuredClone(customBooking);badContact.items[0].attendees[0].registration_answers.f_phone='------';
 await req(a.path+'/orders','POST',badContact,null,400);
 const actual=await req(a.path+'/orders','POST',customBooking,null,201);
 const actualDetail=await req(a.path+'/admin/orders/'+actual.order.id,'GET',null,a.token);
 assert.equal(actualDetail.attendees.length,3);
 const vipPeople=actualDetail.attendees.filter(p=>p.ticket_type_id===vip.id);
 assert.deepEqual(vipPeople.map(p=>p.name),['First VIP','Second VIP']);assert.deepEqual(vipPeople.map(p=>p.email),['first@forms.test','second@forms.test']);assert.equal(vipPeople[0].phone,'');
 const uncollected=actualDetail.attendees.find(p=>p.ticket_type_id===type.id);assert.equal(uncollected.email,'');assert.equal(uncollected.phone,'');assert.equal(uncollected.name,'Attendee 1');
 assert.deepEqual(actual.tickets.filter(t=>t.ticket_type_id===vip.id).map(t=>t.attendee_name),['First VIP','Second VIP']);
 await req(vipPath,'PUT',{inherit:false,version:editableForm.version,config:{...editableConfig,fields:[]}},a.token);
 await req(a.path+'/orders','POST',customBooking,null,409);
 const unchanged=await req(a.path+'/admin/orders/'+actual.order.id,'GET',null,a.token);assert.equal(unchanged.attendees.find(p=>p.name==='First VIP').answers[0].value,'First VIP');
 pass('organizer-defined contacts enforce required fields per attendee, allow missing optional/removed contacts, print names and preserve booking snapshots');
 // Owner-only form editing, even if a staff token claims otherwise.
 const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[a.org.id]);
 await db.run(org,async()=>{const [r]=await db.query("INSERT INTO admins(name,email,password_hash,role) VALUES ('Staff','staff@forms.test','unused','staff')");const token=require('jsonwebtoken').sign({id:r.insertId,organization_id:org.id,role:'super_admin'},process.env.JWT_SECRET);await req(path,'PUT',{config,revision:4},token,403);});
 pass('live owner permissions prevent staff from modifying registration forms');
 if(process.env.FORM_UI_QA==='1'){await req(path,'PUT',{config:{...config,fields:config.fields.filter(f=>f.type!=='file')},revision:4},a.token);console.log('FORM_UI_QA_API='+base);console.log('FORM_UI_EVENT='+e.id+'; SLUG='+e.slug+'; TYPE='+type.id);await new Promise(resolve=>process.once('SIGTERM',resolve));}
 console.log(`Registration form integration passed: ${total} scenarios.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));try{const [orgs]=await db.platform.query('SELECT db_name FROM organizations WHERE is_legacy=FALSE');connection=await mysql.createConnection(db.options);for(const org of orgs)if(/^tf_[a-f0-9]{24}$/.test(org.db_name))await connection.query('DROP DATABASE '+sqlName(org.db_name));await db.end();if(/^tf_forms_test_\d+_\d+$/.test(db.database))await connection.query('DROP DATABASE '+sqlName(db.database));}finally{await connection?.end();}});
