// Disposable database; no real payments, emails, or existing accounts changed.
require('dotenv').config();
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const mysql=require('mysql2/promise');
process.env.DB_NAME=`tf_adjust_test_${Date.now()}_${process.pid}`;
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
delete process.env.BASE_DOMAIN;
const db=require('../config/db');
const {migrateTenant,migratePlatform,sqlName}=require('../saas/provision');
let server;
(async()=>{
 await migrateTenant(db.database);await migratePlatform();
 await require('../models/Admin').create({name:'Test owner',email:'credits@test.invalid',passwordHash:await require('bcryptjs').hash('CreditTestPassword!123',4),role:'super_admin'});
 const [[org]]=await db.platform.query('SELECT id FROM organizations WHERE is_legacy=TRUE');
 server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 let token;
 async function request(path,method='GET',body,status=200){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data;
 }
 token=(await request('/auth/login','POST',{email:'credits@test.invalid',password:'CreditTestPassword!123'})).token;
 const account=()=>request('/admin/saas/account');
 const event=(title,status='draft')=>({title,status,start_datetime:'2030-10-14 10:00:00',end_datetime:'2030-10-14 12:00:00',venue:'Test venue',city:'Chennai'});
 await request('/admin/events','POST',event('No credits'),402);
 await require('../saas/credits').adjust(org.id,3,'Superadmin grants three events',null,crypto.randomUUID());
 const granted=await account();
 assert.equal(granted.subscription.can_create,true);assert.equal(granted.subscription.can_publish,true);
 assert.equal(granted.subscription.latest_purchase,null);assert.equal(granted.purchases.length,0);
 assert.equal(Number(granted.subscription.adjusted_events),3);
 const draft=(await request('/admin/events','POST',event('Manual credit draft'),201)).event;
 assert.equal((await account()).organization.event_balance,3);
 await request(`/admin/events/${draft.id}/status`,'PATCH',{status:'published'});
 await request(`/admin/events/${draft.id}/status`,'PATCH',{status:'draft'});
 await request(`/admin/events/${draft.id}/status`,'PATCH',{status:'published'});
 assert.equal((await account()).organization.event_balance,2);
 await request('/admin/events','POST',event('Direct publication','published'),201);
 assert.equal((await account()).organization.event_balance,1);
 const d2=(await request('/admin/events','POST',event('Last credit A'),201)).event;
 const d3=(await request('/admin/events','POST',event('Last credit B'),201)).event;
 const statuses=await Promise.all([d2,d3].map(e=>fetch(base+`/admin/events/${e.id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({status:'published'})}).then(r=>r.status)));
 assert.deepEqual(statuses.sort(),[200,402]);
 const exhausted=await account();assert.equal(exhausted.organization.event_balance,0);assert.equal(exhausted.subscription.can_create,false);assert.equal(exhausted.subscription.can_publish,false);
 assert.equal(Number(exhausted.subscription.used_events),3);assert.equal(exhausted.purchases.length,0);
 await request('/admin/events','POST',event('Exhausted'),402);
 await require('../saas/credits').adjust(org.id,1,'Restore one credit for suspension check',null,crypto.randomUUID());
 await db.platform.query("UPDATE organizations SET status='suspended' WHERE id=?",[org.id]);
 assert.equal((await account()).subscription.can_create,false);
 await request('/admin/events','POST',event('Suspended'),403);
 console.log('PASS adjusted credits: drafts, direct publication, republishing, last-credit race, exhaustion, suspension, and unchanged payment history.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 if(server)await new Promise(r=>server.close(r));
 await db.end();const connection=await mysql.createConnection(db.options);
 try{await connection.query('DROP DATABASE IF EXISTS '+sqlName(db.database));}finally{await connection.end();}
});
