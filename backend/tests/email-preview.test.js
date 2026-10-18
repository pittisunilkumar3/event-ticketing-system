const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../config/db');
const Studio=require('../models/Studio');const defaults=require('../services/studioDefaults');
const attachments=require('../services/emailAttachments');
test('draft preview returns all eleven current layouts without changing or sending templates',async t=>{
 const brand={...defaults.brand,logo:'https://example.com/logo.png'};
 t.mock.method(Studio,'getSetting',async key=>key==='brand'?brand:{});
 t.mock.method(Studio,'pages',async()=>[]);
 t.mock.method(attachments,'list',async()=>[]);
 const save=t.mock.method(Studio,'saveTemplate',async()=>{throw Error('Preview must not save');});
 const send=t.mock.method(require('../services/mailer'),'send',async()=>{throw Error('Preview must not send');});
 const router=require('../routes/studioRoutes');
 const route=router.stack.find(layer=>layer.route?.path==='/email-preview').route;
 const handle=route.stack.at(-1).handle;
 const preview=config=>new Promise((resolve,reject)=>handle({body:{config,preview_formats:true}},{set(){return this;},json:resolve,status(){return this;}},reject));
 const config={...defaults.email,title:'First draft',show_logo:false,banner_image:'https://example.com/banner.jpg'};
 const first=await preview(config),second=await preview({...config,title:'Changed now'});
 assert.equal(Object.keys(second.data.formats).length,11);
 for(const html of Object.values(second.data.formats)){assert.match(html,/Changed now/);assert.doesNotMatch(html,/First draft|Company logo/);}
 assert.match(first.data.formats[8],/banner.jpg/);
 assert.notEqual(second.data.formats[1],second.data.formats[8]);
 assert.equal(save.mock.callCount(),0);assert.equal(send.mock.callCount(),0);
});
test.after(()=>db.end());
