// Disposable databases; no email or payment provider calls.
require('dotenv').config();
const assert=require('node:assert/strict'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
process.env.DB_NAME=`ticketflow_test_${Date.now()}_${process.pid}`;
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.SETTINGS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');delete process.env.BASE_DOMAIN;
const db=require('../config/db'),{migrateTenant,migratePlatform,sqlName}=require('../saas/provision');let server,connection;
(async()=>{
 await migrateTenant(db.database);await migratePlatform();await migrateTenant(db.database);
 server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function req(path,method='GET',body,token,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(json));return json.data;}
 const tenants=[];
 for(const slug of ['theme-alpha','theme-bravo']){
  const org=(await req('/api/saas/signup','POST',{company_name:slug,slug,name:'Theme Owner',email:'owner@theme.test',password:'ThemeTestPassword!123'},null,201)).organization;
  await db.platform.query('UPDATE organizations SET event_balance=5 WHERE id=?',[org.id]);await require('./helpers/paidPackage')(db.platform,org.id,5);
  const token=(await req(`/api/o/${slug}/auth/login`,'POST',{email:'owner@theme.test',password:'ThemeTestPassword!123'})).token;
  tenants.push({org,token,path:`/api/o/${slug}`});
 }
 const [a,b]=tenants;
 const input={title:'Theme showcase',start_datetime:'2035-01-01 12:00:00',end_datetime:'2035-01-01 18:00:00',status:'published'};
 const event=(await req(a.path+'/admin/events','POST',input,a.token,201)).event;assert.equal(event.page_theme,'classic');
 const second=(await req(a.path+'/admin/events','POST',{...input,title:'Second theme',page_theme:'poster'},a.token,201)).event;
 const other=(await req(b.path+'/admin/events','POST',{...input,title:'Other organizer'},b.token,201)).event;
 const type=(await req(a.path+'/admin/ticket-types','POST',{event_id:event.id,name:'General',price:100,quantity:50},a.token,201)).ticketType;
 const before=(await req(a.path+'/events/'+event.slug)).ticketTypes;
 for(const theme of require('../../shared/eventThemes.json')){
  const updated=(await req(a.path+'/admin/events/'+event.id,'PUT',{page_theme:theme.id},a.token)).event;assert.equal(updated.page_theme,theme.id);
  assert.equal((await req(a.path+'/admin/events/'+event.id,'GET',null,a.token)).event.page_theme,theme.id);
  const publicData=await req(a.path+'/events/'+event.slug);assert.equal(publicData.event.page_theme,theme.id);assert.deepEqual(publicData.ticketTypes,before);
  assert.equal((await req('/api/events/'+event.slug)).event.page_theme,theme.id);
 }
 await req(a.path+'/admin/events/'+event.id,'PUT',{page_theme:'untrusted-theme'},a.token,400);
 await req(a.path+'/admin/events/'+event.id,'PUT',{page_theme:{}},a.token,400);
 await req(a.path+'/admin/events/'+event.id,'PUT',{page_theme:'cinema'},null,401);
 await req(a.path+'/admin/events/'+event.id,'PUT',{page_theme:'cinema'},b.token,403);
 const retained=(await req(a.path+'/admin/events/'+event.id,'PUT',{summary:'Changed summary'},a.token)).event;assert.equal(retained.page_theme,require('../../shared/eventThemes.json').at(-1).id);
 assert.equal((await req(a.path+'/admin/events/'+second.id,'GET',null,a.token)).event.page_theme,'poster');
 assert.equal((await req(b.path+'/admin/events/'+other.id,'GET',null,b.token)).event.page_theme,'classic');
 const admin=(await req(a.path+'/admin/events/'+event.id,'GET',null,a.token)).ticketTypes.find(t=>t.id===type.id);assert.equal(admin.is_on_sale,true);assert.equal(admin.available,50);
 async function submitForm(path,method,values,status){const form=new FormData();for(const [key,value] of Object.entries(values))form.append(key,value);const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+a.token},body:form});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data;}
 const schedule={title:'Schedule roundtrip',start_datetime:'2035-12-12T09:00',end_datetime:'2035-12-13T18:00',status:'published'};
 const scheduled=(await submitForm(a.path+'/admin/events','POST',schedule,201)).event;
 assert.equal(scheduled.start_datetime,'2035-12-12 09:00:00');assert.equal(scheduled.end_datetime,'2035-12-13 18:00:00');
 const edited=(await submitForm(a.path+'/admin/events/'+scheduled.id,'PUT',{start_datetime:'2035-12-14T09:30',end_datetime:'2035-12-15T19:00'},200)).event;
 assert.equal(edited.start_datetime,'2035-12-14 09:30:00');assert.equal(edited.end_datetime,'2035-12-15 19:00:00');
 for(const path of [a.path+'/admin/events/'+scheduled.id,a.path+'/events/'+scheduled.slug,'/api/events/'+scheduled.slug]){const saved=(await req(path,'GET',null,a.token)).event;assert.equal(saved.start_datetime,edited.start_datetime);assert.equal(saved.end_datetime,edited.end_datetime);}
 await req(a.path+'/admin/events','POST',{...schedule,end_datetime:'2035-12-11T18:00'},a.token,400);
 await req(a.path+'/admin/events/'+scheduled.id,'PUT',{end_datetime:'2035-12-14T09:30'},a.token,400);
 await req(a.path+'/admin/events/'+scheduled.id,'PUT',{start_datetime:'2035-02-30T09:00'},a.token,400);
 const cleared=(await req(a.path+'/admin/events/'+scheduled.id,'PUT',{end_datetime:''},a.token)).event;assert.equal(cleared.end_datetime,null);
 console.log('PASS schedule: create/edit/reload and organizer/platform dates retain wall-clock times, invalid ranges rejected, optional end cleared.');
 if(process.env.SCHEDULE_UI_QA==='1'){console.log('QA_API='+base);console.log('QA_EVENT='+scheduled.id);await new Promise(r=>process.once('SIGTERM',r));}
 console.log('PASS event themes: migration rerun, defaults, create/update/reload, all public/platform themes, invalid inputs, auth/isolation, partial updates and unchanged ticket availability.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 if(server)await new Promise(r=>server.close(r));
 try{connection=await mysql.createConnection(db.options);const [orgs]=await db.platform.query('SELECT db_name FROM organizations WHERE is_legacy=FALSE');for(const org of orgs)if(/^tf_[a-f0-9]{24}$/.test(org.db_name))await connection.query('DROP DATABASE '+sqlName(org.db_name));await db.end();if(/^ticketflow_test_\d+_\d+$/.test(db.database))await connection.query('DROP DATABASE '+sqlName(db.database));}finally{await connection?.end();}
});
