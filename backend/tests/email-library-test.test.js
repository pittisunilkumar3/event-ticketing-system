const test=require('node:test');
const assert=require('node:assert/strict');
test('email library test resolves subject fields and labels the message as a test',async t=>{
 const Studio=require('../models/Studio'),Template=require('../models/EmailTemplate'),mailer=require('../services/mailer'),renderer=require('../services/emailTemplateRenderer');
 t.mock.method(Studio,'getSetting',async()=>({enabled:true,host:'smtp.example.test',from_email:'sender@example.test'}));
 t.mock.method(Template,'getById',async()=>({id:1,status:1,title:'Tomorrow: {{event_title}}!\nPreview'}));
 t.mock.method(renderer,'generateTemplateHTML',async()=>'<p>Test body</p>');
 const send=t.mock.method(mailer,'send',async()=>'<test-message>');
 const {sendTest}=require('../controllers/emailTemplateController');
 const call=to=>new Promise(resolve=>sendTest({body:{to,templateId:1}},{statusCode:200,status(s){this.statusCode=s;return this;},json(body){resolve({status:this.statusCode,...body});}},e=>resolve({status:e.statusCode||500})));
 const result=await call('receiver@example.test');
 assert.equal(result.status,200);assert.match(result.message,/accepted.*inbox and spam/);
 const [smtp,to,rendered]=send.mock.calls[0].arguments;
 assert.equal(to,'receiver@example.test');assert.equal(smtp.host,'smtp.example.test');
 assert.equal(rendered.subject,'[TEST] Tomorrow: Neon Nights Music Festival! Preview');assert.doesNotMatch(rendered.subject,/{{|\n/);
 assert.equal((await call('invalid')).status,400);assert.equal(send.mock.callCount(),1);
});
test.after(()=>require('../config/db').end());
