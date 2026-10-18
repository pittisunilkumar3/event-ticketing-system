const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Studio = require('../models/Studio');
const Admin = require('../models/Admin');
const mailer = require('../services/mailer');
const router = require('../routes/studioRoutes');
const {sendTest} = require('../controllers/smtpController');
const smtp = Object.freeze({enabled:false, host:'smtp.example.test', from_email:'sender@example.test', from_name:'Example', port:587, encryption:'starttls', password_encrypted:'saved-secret'});

function call(body, {routed=false, token, ip='test', organization={id:7,is_legacy:false}}={}) {
  return new Promise(resolve => {
    const req={method:'POST',url:'/smtp/test',path:'/smtp/test',body,headers:token?{authorization:`Bearer ${token}`}:{},ip,organization};
    const res={statusCode:200,headers:{},status(code){this.statusCode=code;return this;},set(key,value){this.headers[key]=value;return this;},json(value){resolve({status:this.statusCode,headers:this.headers,...value});}};
    const next=err=>resolve({status:err?.statusCode||500,message:err?.message});
    if(routed)router.handle(req,res,next);else sendTest(req,res,next);
  });
}

test('test sends through saved settings while automatic delivery stays disabled', async t => {
  const get=t.mock.method(Studio,'getSetting',async()=>smtp);
  const save=t.mock.method(Studio,'saveSetting',async()=>assert.fail('Must not save settings'));
  const send=t.mock.method(mailer,'send',async()=>'<test-message>');
  const result=await call({recipient:' receiver@example.test ',host:'attacker.test',enabled:true,html:'untrusted',subject:'untrusted'});
  assert.equal(result.status,200);
  assert.equal(result.data.recipient,'receiver@example.test');
  assert.match(result.message,/accepted.*inbox and spam/);
  assert.deepEqual(get.mock.calls[0].arguments,['smtp']);
  const [settings,recipient,rendered]=send.mock.calls[0].arguments;
  assert.deepEqual(settings,{...smtp,enabled:true});
  assert.equal(smtp.enabled,false);
  assert.equal(save.mock.callCount(),0);
  assert.equal(recipient,'receiver@example.test');
  assert.match(rendered.subject,/^\[TEST\]/);
  assert.doesNotMatch(rendered.html,/untrusted|saved-secret/);
});

test('invalid recipients and missing saved configuration never send mail', async t => {
  const get=t.mock.method(Studio,'getSetting',async()=>smtp);
  const send=t.mock.method(mailer,'send',async()=>assert.fail('Must not send'));
  for(const recipient of [undefined,'','invalid','a@example.test,b@example.test','a@example.test\r\nBcc: b@example.test',[]]) {
    assert.equal((await call({recipient})).status,400);
  }
  assert.equal(get.mock.callCount(),0);
  for(const field of ['host','from_email']) {
    get.mock.mockImplementation(async()=>({...smtp,[field]:''}));
    assert.equal((await call({recipient:'receiver@example.test'})).status,400);
  }
  assert.equal(send.mock.callCount(),0);
});

test('SMTP failures return a useful error without leaking provider secrets', async t => {
  t.mock.method(Studio,'getSetting',async()=>smtp);
  t.mock.method(mailer,'send',async()=>{throw new Error('private password and provider internals');});
  const result=await call({recipient:'receiver@example.test'});
  assert.equal(result.status,502);
  assert.match(result.message,/saved SMTP settings and recipient/);
  assert.doesNotMatch(JSON.stringify(result),/private password|saved-secret/);
});

test('endpoint enforces authentication, tenant ownership, current role and rate limits', async t => {
  const previousSecret=process.env.JWT_SECRET;
  process.env.JWT_SECRET='smtp-test-only-secret';
  t.after(()=>{if(previousSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previousSecret;});
  const account=t.mock.method(Admin,'findById',async()=>({id:1,role:'super_admin'}));
  t.mock.method(Studio,'getSetting',async()=>smtp);
  const send=t.mock.method(mailer,'send',async()=>'<test-message>');
  const body={recipient:'receiver@example.test'};
  const token=jwt.sign({id:1,organization_id:7},process.env.JWT_SECRET);
  assert.equal((await call(body,{routed:true})).status,401);
  assert.equal((await call(body,{routed:true,token,organization:{id:8}})).status,403);
  account.mock.mockImplementation(async()=>({id:1,role:'staff'}));
  assert.equal((await call(body,{routed:true,token})).status,403);
  assert.equal(send.mock.callCount(),0);
  account.mock.mockImplementation(async()=>({id:1,role:'super_admin'}));
  for(let i=0;i<5;i++)assert.equal((await call(body,{routed:true,token,ip:'rate-test'})).status,200);
  const limited=await call(body,{routed:true,token,ip:'rate-test'});
  assert.equal(limited.status,429);
  assert.ok(Number(limited.headers['Retry-After'])>0);
  assert.equal(send.mock.callCount(),5);
});

test.after(()=>require('../config/db').end());
