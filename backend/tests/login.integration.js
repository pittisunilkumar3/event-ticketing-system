// Real local HTTP/DB checks, isolated from existing accounts. No email or payments.
require('dotenv').config();
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const mysql=require('mysql2/promise');
process.env.DB_NAME=`tf_login_test_${Date.now()}_${process.pid}`;
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
delete process.env.BASE_DOMAIN;
const db=require('../config/db');
const {migrateTenant,sqlName}=require('../saas/provision');
const Admin=require('../models/Admin');
let server,connection;
const ownedDatabases=[db.database];
async function run(){
 await migrateTenant(db.database);
 connection=await mysql.createConnection({...db.options,database:db.database,multipleStatements:true});
 await connection.query(await fs.readFile(path.join(__dirname,'../saas/migrations/001_platform.sql'),'utf8'));
 await connection.query("INSERT INTO organizations(name,slug,db_name,owner_email,status,is_legacy) VALUES ('Original workspace','legacy',?,'','active',TRUE)",[db.database]);
 const password='SaasTestPassword!123',hash=await require('bcryptjs').hash(password,4);
 await Admin.create({name:'Legacy owner',email:'legacy@test.invalid',passwordHash:hash,role:'super_admin'});
 const tenants=[];
 for(const slug of ['test-alpha','test-bravo']){
  const name='tf_'+crypto.randomBytes(12).toString('hex');ownedDatabases.push(name);await migrateTenant(name);
  const [result]=await connection.query("INSERT INTO organizations(name,slug,db_name,owner_email,status,is_legacy) VALUES (?,?,?,'owner@test.invalid','active',FALSE)",[slug,slug,name]);
  const org={id:result.insertId,slug,name:slug,db_name:name,is_legacy:false};
  await db.run(org,()=>Admin.create({name:'Test Owner',email:'owner@test.invalid',passwordHash:hash,role:'super_admin'}));
  tenants.push({org,path:`/api/o/${slug}`});
 }
 server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function request(url,method='GET',body,token,status=200){const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const json=await response.json();assert.equal(response.status,status,url+': '+JSON.stringify(json));return json.data;}
 const check=label=>console.log('PASS '+label);
 for(const tenant of tenants)tenant.token=(await request(tenant.path+'/auth/login','POST',{email:'owner@test.invalid',password})).token;
 const [a,b]=tenants;
 const legacy=await request('/api/auth/login','POST',{email:'legacy@test.invalid',password});assert.equal(legacy.workspace.is_legacy,true);await request('/api/admin/dashboard','GET',null,legacy.token);
 check('existing workspace still signs in and loads its dashboard');
 const credentials={email:'owner@test.invalid',password:'SaasTestPassword!123'};
 const choice=await request('/api/auth/login','POST',credentials);
 assert.equal(choice.workspaces.length,2);assert.equal(choice.token,undefined);
 const main=await request('/api/auth/login','POST',{...credentials,workspace_id:a.org.id});
 assert.equal(main.workspace.path,'/o/test-alpha/admin');
 assert.equal(require('jsonwebtoken').decode(main.token).organization_id,a.org.id);
 await request(b.path+'/admin/dashboard','GET',null,main.token,403);
 await request('/api/auth/login','POST',{...credentials,password:'wrong-password'},null,401);
 await request('/api/auth/login','POST',{email:{bad:true},password:123},null,400);
 await request('/api/auth/login','POST',{...credentials,workspace_id:999999},null,401);
 check('main login verifies credentials before showing workspace choices and issues tenant-scoped sessions');
 const manager=(await request(a.path+'/admin/saas/team','POST',{name:'Login manager',email:'manager@test.invalid',password:'ManagerTestPass!123',role:'staff'},a.token)).member;
 const managerLogin=await request('/api/auth/login','POST',{email:'manager@test.invalid',password:'ManagerTestPass!123'});
 assert.equal(managerLogin.workspace.id,a.org.id);
 assert.equal(managerLogin.admin.role,'staff');
 await request(a.path+'/admin/dashboard','GET',null,managerLogin.token);
 await request(a.path+'/admin/saas/team','GET',null,managerLogin.token,403);
 await request(a.path+'/admin/studio/bootstrap','GET',null,managerLogin.token,403);
 await request(b.path+'/admin/dashboard','GET',null,managerLogin.token,403);
 await request(a.path+'/auth/profile','PATCH',{name:'Login manager',email:'updated-manager@test.invalid'},managerLogin.token);
 await request('/api/auth/login','POST',{email:'manager@test.invalid',password:'ManagerTestPass!123'},null,401);
 await request('/api/auth/login','POST',{email:'updated-manager@test.invalid',password:'ManagerTestPass!123'});
 await request(b.path+'/auth/login','POST',{email:'updated-manager@test.invalid',password:'ManagerTestPass!123'},null,401);
 await request(a.path+'/admin/saas/team/'+manager.id,'DELETE',null,a.token);
 await request(a.path+'/admin/dashboard','GET',null,managerLogin.token,401);
 await request('/api/auth/login','POST',{email:'updated-manager@test.invalid',password:'ManagerTestPass!123'},null,401);
 // Simulate an installation whose accounts predate the directory migration.
 await db.platform.query('DELETE FROM organizer_login_directory');
 await require('../saas/loginDirectory').backfill();
 assert.equal((await request('/api/auth/login','POST',credentials)).workspaces.length,2);
 check('main login supports team members, changed email, removal and existing-account backfill');
 await db.run(b.org,()=>Admin.updatePassword(1,require('bcryptjs').hashSync('DifferentPassword!123',4)));
 const unique=await request('/api/auth/login','POST',credentials);assert.equal(unique.workspace.id,a.org.id);assert.ok(unique.token);assert.equal(unique.workspaces,undefined);
 await request(a.path+'/admin/dashboard','GET',null,unique.token);
 check('only accounts matching both email and password are returned; dashboard loads');
 await connection.query("UPDATE organizations SET status='failed' WHERE id=?",[a.org.id]);
 await request('/api/auth/login','POST',credentials,null,401);
 await connection.query("UPDATE organizations SET status='suspended' WHERE id=?",[a.org.id]);
 const suspended=await request('/api/auth/login','POST',credentials);assert.equal(suspended.workspace.id,a.org.id);
 check('unavailable accounts are excluded; suspended accounts retain permitted sign-in');
 console.log('Organizer login integration passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 if(server)await new Promise(r=>server.close(r));
 await db.end();
 if(!connection)connection=await mysql.createConnection(db.options);
 for(const name of ownedDatabases)await connection.query('DROP DATABASE IF EXISTS '+sqlName(name));
 await connection.end();
});
