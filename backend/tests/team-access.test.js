const test=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const db=require('../config/db');
const Admin=require('../models/Admin');
const auth=require('../middleware/auth');
const routes=require('../saas/routes').organizer;
const studio=require('../routes/studioRoutes');
const wallet=require('../routes/walletRoutes');
const directory=require('../saas/loginDirectory');
function request(handler,{token,organization={id:7,is_legacy:false},url='/team',method='GET',body={}}={}) {
 return new Promise(resolve=>{
  const req={headers:token?{authorization:`Bearer ${token}`}:{},organization,url,path:url,method,body,query:{},ip:'team-test'};
  const res={statusCode:200,status(code){this.statusCode=code;return this;},set(){return this;},json(value){resolve({status:this.statusCode,...value});}};
  const next=err=>resolve(err?{status:err.statusCode||500,message:err.message}:{status:200,admin:req.admin});
  if(handler.handle)handler.handle(req,res,next);else handler(req,res,next);
 });
}
function token(id=1,organization_id=7,extra={}){return jwt.sign({id,organization_id,...extra},process.env.JWT_SECRET);}
test.before(()=>{process.env.JWT_SECRET='team-access-test-only';});
test('dashboard authentication accepts current roles and rejects cross-organization, platform and deleted accounts',async t=>{
 const find=t.mock.method(Admin,'findById',async()=>({id:1,role:'staff'}));
 assert.equal((await request(auth.verifyToken)).status,401);
 assert.equal((await request(auth.verifyToken,{token:token()})).status,200);
 assert.equal((await request(auth.verifyToken,{token:token(),organization:{id:8}})).status,403);
 assert.equal((await request(auth.verifyToken,{token:token(1,7,{type:'platform'})})).status,403);
 find.mock.mockImplementation(async()=>({id:1,role:'super_admin'}));
 assert.equal((await request(auth.verifyToken,{token:token()})).status,200);
 find.mock.mockImplementation(async()=>({id:1,role:'unknown'}));
 assert.equal((await request(auth.verifyToken,{token:token()})).status,403);
 find.mock.mockImplementation(async()=>null);
 assert.equal((await request(auth.verifyToken,{token:token()})).status,401);
});
test('managers cannot access team, wallet, studio or purchase actions even with a stale owner token',async t=>{
 t.mock.method(Admin,'findById',async()=>({id:1,role:'staff'}));
 const query=t.mock.method(db,'query',async()=>assert.fail('Restricted query must not run'));
 const stale=token(1,7,{role:'super_admin'});
 for(const [router,url,method] of [[routes,'/team','GET'],[routes,'/team','POST'],[routes,'/team/2','DELETE'],[routes,'/purchases','POST'],[routes,'/purchases/2/reconcile','POST'],[studio,'/bootstrap','GET'],[wallet,'/','GET']]) {
  assert.equal((await request(router,{token:stale,url,method})).status,403,`${method} ${url}`);
 }
 assert.equal(query.mock.callCount(),0);
});
test('owners can list only the team selected by the tenant database context',async t=>{
 t.mock.method(Admin,'findById',async()=>({id:1,role:'super_admin'}));
 t.mock.method(db,'query',async()=>[[{id:1,name:`Organization ${db.current().id}`,role:'super_admin'}]]);
 for(const id of [7,8]) {
  const result=await db.run({id,db_name:`test_${id}`},()=>request(routes,{token:token(1,id),organization:{id},url:'/team'}));
  assert.equal(result.status,200);assert.equal(result.data.members[0].name,`Organization ${id}`);
 }
});
test('team creation rejects unsupported roles and invalid fields before creating an account',async t=>{
 t.mock.method(Admin,'findById',async()=>({id:1,role:'super_admin'}));
 const create=t.mock.method(Admin,'create',async()=>assert.fail('Invalid account must not be created'));
 const valid={name:'Team member',email:'member@example.test',password:'long-test-password',role:'staff'};
 for(const change of [{role:'platform'},{role:'check_in'},{name:''},{email:'invalid'},{password:'short'},{password:'😀'.repeat(20)}]) {
  assert.equal((await request(routes,{token:token(),url:'/team',method:'POST',body:{...valid,...change}})).status,400);
 }
 assert.equal(create.mock.callCount(),0);
});
test('removal checks current owner under lock, protects self and atomically removes the login directory entry',async t=>{
 let members=[{id:1,role:'super_admin'},{id:2,role:'staff'}];
 const operations=[];
 const conn={beginTransaction:async()=>operations.push('begin'),commit:async()=>operations.push('commit'),rollback:async()=>operations.push('rollback'),release:()=>operations.push('release'),query:async sql=>{operations.push(sql);return sql.startsWith('SELECT')?[members]:[{affectedRows:1}];}};
 t.mock.method(db,'getConnection',async()=>conn);
 const removeDirectory=t.mock.method(directory,'remove',async(c,id)=>{assert.equal(c,conn);assert.equal(id,2);operations.push('directory');});
 await assert.rejects(Admin.remove(1,1),/own account/);
 assert.equal(removeDirectory.mock.callCount(),0);
 members=[{id:1,role:'staff'},{id:2,role:'super_admin'}];
 await assert.rejects(Admin.remove(2,1),/Owner access/);
 members=[{id:1,role:'super_admin'}];
 await assert.rejects(Admin.remove(2,1),/not found/);
 members=[{id:1,role:'super_admin'},{id:2,role:'staff'}];operations.length=0;
 await Admin.remove(2,1);
 assert.deepEqual(operations,['begin','SELECT id,role FROM admins ORDER BY id FOR UPDATE','DELETE FROM admins WHERE id=?','directory','commit','release']);
});
test('scanner role cannot regain management access with a stale owner token',async t=>{
 t.mock.method(Admin,'findById',async()=>({id:5,role:'scanner'}));
 const stale=token(5,7,{role:'super_admin'});
 assert.equal((await request(auth.verifyToken,{token:stale})).status,403);
 assert.equal((await request(auth.verifyScannerToken,{token:stale})).status,200);
 assert.equal((await request(auth.verifyScannerToken,{token:stale,organization:{id:8}})).status,403);
 for(const router of [routes,studio,wallet]) assert.equal((await request(router,{token:stale})).status,403);
});
test.after(()=>db.end());
