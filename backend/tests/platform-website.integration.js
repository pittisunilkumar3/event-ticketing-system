// Disposable local databases only. No email, payment, or existing website changes.
require('dotenv').config();
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const mysql=require('mysql2/promise');
process.env.DB_NAME=`tf_website_test_${Date.now()}_${process.pid}`;
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
process.env.PUBLIC_SITE_URL='https://platform.example.test';
delete process.env.BASE_DOMAIN;
const db=require('../config/db');
const {migrateTenant,migratePlatform,sqlName}=require('../saas/provision');
const website=require('../saas/website');
const Admin=require('../models/Admin');
const Studio=require('../models/Studio');
let server,connection,uploaded;
const databases=[db.database];
async function run(){
 await migrateTenant(db.database);
 await Studio.initialize();
 await Studio.saveSetting('brand',{...require('../services/studioDefaults').brand,company_name:'Migrated platform'});
 await migratePlatform();
 connection=await mysql.createConnection({...db.options,database:db.database});
 assert.equal((await website.brand()).company_name,'Migrated platform');
 const password='WebsiteTestPassword!123',hash=await require('bcryptjs').hash(password,4);
 await Admin.create({name:'Legacy owner',email:'legacy@test.invalid',passwordHash:hash,role:'super_admin'});
 await connection.query('INSERT INTO platform_admins(name,email,password_hash) VALUES (?,?,?)',['Platform owner','platform@test.invalid',hash]);
 const name='tf_'+crypto.randomBytes(12).toString('hex');databases.push(name);await migrateTenant(name);
 const [result]=await connection.query("INSERT INTO organizations(name,slug,db_name,owner_email,status,is_legacy) VALUES ('Tenant','website-test',?,'tenant@test.invalid','active',FALSE)",[name]);
 const org={id:result.insertId,slug:'website-test',db_name:name,is_legacy:false};
 await db.run(org,async()=>{await Admin.create({name:'Tenant owner',email:'tenant@test.invalid',passwordHash:hash,role:'super_admin'});await Studio.initialize();});
 server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function request(url,method='GET',body,token,status=200){
  const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json();assert.equal(response.status,status,url+': '+JSON.stringify(json));return json.data;
 }
 const platform='/api/platform/website',tenant='/api/o/website-test';
 const platformToken=(await request('/api/platform/login','POST',{email:'platform@test.invalid',password})).token;
 const tenantToken=(await request(tenant+'/auth/login','POST',{email:'tenant@test.invalid',password})).token;
 const legacyToken=(await request('/api/auth/login','POST',{email:'legacy@test.invalid',password})).token;
 for(const suffix of ['/brand','/social-links','/pages']){
  await request(platform+suffix,'GET',null,null,401);
  await request(platform+suffix,'GET',null,tenantToken,403);
 }
 for(const suffix of ['/brand','/social-links','/pages/privacy-policy'])await request('/api/admin/studio'+suffix,'PUT',{},legacyToken,403);
 await request(platform+'/brand','PUT',{company_name:'Unauthorized'},tenantToken,403);
 await request(platform+'/upload','POST',{},tenantToken,403);
 console.log('PASS platform ownership: organizer and legacy roles cannot edit platform settings');
 const form=new FormData();form.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test-logo.png');
 const upload=await fetch(base+platform+'/upload',{method:'POST',headers:{Authorization:'Bearer '+platformToken},body:form});
 assert.equal(upload.status,200);uploaded=(await upload.json()).data.url;
 assert.match(uploaded,/^\/uploads\/platform\/banner-[a-f0-9]+\.png$/);
 assert.equal((await fetch(base+uploaded)).status,200);
 const fixture={company_name:'Central Brand',site_title:'Central Tickets',logo:uploaded,favicon:uploaded,hero_title:'Platform headline',footer_text:'Platform footer',phone:'+91 1234567890',support_email:'help@example.test'};
 await request(platform+'/brand','PUT',fixture,platformToken);
 let publicBrand=(await request('/api/site-settings')).settings;
 for(const [key,value] of Object.entries(fixture))assert.equal(publicBrand[key],value);
 assert.equal(publicBrand.site_url,process.env.PUBLIC_SITE_URL);assert.equal(publicBrand.is_organizer,false);
 await request(platform+'/brand','PUT',{logo:'javascript:alert(1)'},platformToken,400);
 await request(tenant+'/admin/studio/brand','PUT',{company_name:'Independent organizer',logo:''},tenantToken);
 assert.equal((await request('/api/site-settings')).settings.company_name,'Central Brand');
 assert.equal((await request(tenant+'/site-settings')).settings.company_name,'Independent organizer');
 await migratePlatform();assert.equal((await website.brand()).company_name,'Central Brand');
 console.log('PASS logo upload, public branding, validation, migration preservation and organizer isolation');
 await request(platform+'/social-links','PUT',{socialLinks:{instagram:'https://instagram.com/platform'}},platformToken);
 await request(tenant+'/admin/studio/social-links','PUT',{socialLinks:{instagram:'https://instagram.com/organizer'}},tenantToken);
 assert.equal((await request('/api/social-links')).socialLinks.instagram,'https://instagram.com/platform');
 assert.equal((await request(tenant+'/social-links')).socialLinks.instagram,'https://instagram.com/organizer');
 await request(platform+'/social-links','PUT',{socialLinks:{instagram:'javascript:alert(1)'}},platformToken,400);
 await request(platform+'/social-links','PUT',{socialLinks:{}},platformToken);
 assert.ok(!(await request('/api/social-links')).socialLinks.instagram);
 console.log('PASS platform social links save, clear and remain separate from organizer links');
 const page={title:'Privacy policy',body:'<p>Platform test content</p><script>alert(1)</script>',published:false};
 await request(platform+'/pages/privacy-policy','PUT',page,platformToken);
 await request('/api/pages/privacy-policy','GET',null,null,404);
 await request(platform+'/pages/privacy-policy','PUT',{...page,published:true,body:''},platformToken,400);
 await request(platform+'/pages/missing','PUT',page,platformToken,404);
 await request(platform+'/pages/privacy-policy','PUT',{...page,published:true},platformToken);
 const published=(await request('/api/pages/privacy-policy')).page;
 assert.doesNotMatch(published.body,/script|alert/);assert.equal((await request('/api/pages')).pages.length,1);
 await request(tenant+'/pages/privacy-policy','GET',null,null,404);
 await request(tenant+'/admin/studio/pages/privacy-policy','PUT',{...page,body:'<p>Organizer content</p>',published:true},tenantToken);
 assert.match((await request('/api/pages/privacy-policy')).page.body,/Platform test content/);
 assert.match((await request(tenant+'/pages/privacy-policy')).page.body,/Organizer content/);
 await request(platform+'/pages/privacy-policy','PUT',page,platformToken);
 assert.equal((await request('/api/pages')).pages.length,0);
 await request('/api/pages/privacy-policy','GET',null,null,404);
 // Existing installations have only the original five pages. New page types
 // must remain editable, preserve their old content, and start unpublished.
 const existingPages=await website.pages();
 const addedSlugs=['about-us','pricing','ticket-delivery'];
 await connection.query("UPDATE platform_settings SET value_json=? WHERE name='website_pages'",[JSON.stringify(existingPages.filter(p=>!addedSlugs.includes(p.slug)))]);
 const upgradedPages=await website.pages();
 assert.equal(upgradedPages.find(p=>p.slug==='privacy-policy').body,existingPages.find(p=>p.slug==='privacy-policy').body);
 for(const slug of addedSlugs){assert.equal(upgradedPages.find(p=>p.slug===slug).published,false);await request('/api/pages/'+slug,'GET',null,null,404);}
 // Every supported policy follows the same publish/edit/unpublish path.
 for(const [slug,title] of require('../services/studioDefaults').pages) {
  const fixture={title,body:`<p>Published ${slug}</p>`,published:true};
  await request(platform+'/pages/'+slug,'PUT',fixture,platformToken);
  assert.ok((await request('/api/pages')).pages.some(p=>p.slug===slug));
  assert.match((await request('/api/pages/'+slug)).page.body,/Published/);
  await request(platform+'/pages/'+slug,'PUT',{...fixture,body:'<p>Updated policy content</p>'},platformToken);
  assert.match((await request('/api/pages/'+slug)).page.body,/Updated policy content/);
  assert.equal((await fetch(base+'/api/pages/'+slug)).headers.get('cache-control'),'no-store');
  await request(platform+'/pages/'+slug,'PUT',{...fixture,published:false},platformToken);
  await request('/api/pages/'+slug,'GET',null,null,404);
 }
 const [[audit]]=await connection.query("SELECT COUNT(*) n FROM platform_audit WHERE action LIKE 'website_%'");assert.ok(audit.n>=6);
 console.log('PASS policy draft / publish / unpublish, sanitization, isolation and audit');
 console.log('Platform website integration passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 if(server)await new Promise(r=>server.close(r));
 await db.end();
 if(uploaded)await fs.unlink(path.join(__dirname,'..',uploaded));
 if(!connection)connection=await mysql.createConnection(db.options);
 for(const name of databases)await connection.query('DROP DATABASE IF EXISTS '+sqlName(name));
 await connection.end();
});
