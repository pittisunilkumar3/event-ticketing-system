const test=require('node:test');
const assert=require('node:assert/strict');
process.env.SETTINGS_ENCRYPTION_KEY='b'.repeat(64);
const mail=require('../saas/platformMail');
const smtpSettings=require('../services/smtpSettings');
const defaults=require('../services/studioDefaults');
test('all six platform designs render sample values, safe text and distinct layouts',()=>{
 for(const d of mail.definitions){
  const config=mail.validate(d,d.key),rendered=mail.render(config,{from_name:'Example Platform',from_email:'help@example.test'},mail.sample);
  assert.ok(rendered.html.includes('Northstar Experiences'));
  assert.ok(!rendered.html.includes('{{'));
  const unsafe=mail.render(config,{}, {...mail.sample,owner_name:'<img src=x onerror=alert(1)>',organization_name:'<script>alert(1)</script>'});
  assert.doesNotMatch(unsafe.html,/<script|<img src=x/);
  assert.ok(unsafe.html.includes('&lt;script&gt;'));
 }
 assert.equal(new Set(mail.definitions.map(d=>d.layout)).size,3);
});
test('platform designs reject unsafe destinations, unknown placeholders and empty content',()=>{
 const d=mail.definitions[0];
 for(const change of [{button_url:'javascript:alert(1)'},{logo:'javascript:alert(1)'},{subject:'{{unknown-field}}'},{body:'<script>alert(1)</script>'},{button_url:''}])assert.throws(()=>mail.validate({...d,...change},d.key));
 assert.equal(mail.validate({...d,button_url:'{{workspace_url}}/event-packages'},d.key).button_url,'{{workspace_url}}/event-packages');
});
test('SMTP edits preserve encrypted passwords, mask all secrets and allow disabling empty setup',()=>{
 const empty=smtpSettings.validate({enabled:false},defaults.smtp);assert.equal(empty.enabled,false);
 const original=smtpSettings.validate({enabled:true,host:'smtp.example.test',port:465,encryption:'tls',username:'sender',password:' secret with spaces ',from_name:'Sender',from_email:'sender@example.test'},defaults.smtp);
 const edited=smtpSettings.validate({password:'',from_name:'Updated',password_encrypted:'attacker value'},original);
 assert.equal(edited.password_encrypted,original.password_encrypted);
 assert.equal(require('../services/secrets').decrypt(edited.password_encrypted),' secret with spaces ');
 assert.equal(smtpSettings.safe({...edited,password:'hidden'}).password,undefined);
 assert.equal(smtpSettings.safe(edited).password_encrypted,undefined);
 assert.throws(()=>smtpSettings.validate({clear_password:true},original));
 assert.equal(smtpSettings.validate({clear_password:true,enabled:false},original).password_encrypted,'');
});
test('organization image URLs use the public origin rather than a tenant route prefix',()=>{
 const {renderEmail}=require('../services/emailRenderer');
 const result=renderEmail({...defaults.email,logo:'/uploads/alpha/logo.png',body:'<p>Hello</p><img src="/uploads/alpha/body.png">'}, {...defaults.brand,site_url:'https://example.test/o/alpha'});
 assert.ok(result.html.includes('https://example.test/uploads/alpha/logo.png'));
 assert.ok(result.html.includes('https://example.test/uploads/alpha/body.png'));
 assert.ok(!result.html.includes('/o/alpha/uploads/'));
});

test.after(()=>require('../config/db').end());

test('reference email imagery and selected footer links render only published platform content',()=>{
 const d=mail.definitions[0],config=mail.validate({...d,icon:'/uploads/platform/icon.png',banner_image:'/uploads/platform/banner.png',page_links:['privacy-policy','refund-policy'],social_channels:['instagram','facebook'],copyright_text:'© {{year}} {{platform_name}}'},d.key);
 const website={brand:{company_name:'Central Brand'},pages:[{slug:'privacy-policy',title:'Privacy',published:true},{slug:'refund-policy',title:'Refund',published:false}],social:{instagram:'https://instagram.com/central'}};
 const result=mail.render(config,{},mail.sample,website);
 assert.match(result.html,/Central Brand/);assert.match(result.html,/\/uploads\/platform\/icon.png/);assert.match(result.html,/\/uploads\/platform\/banner.png/);
 assert.match(result.html,/\/pages\/privacy-policy/);assert.doesNotMatch(result.html,/\/pages\/refund-policy/);assert.match(result.html,/https:\/\/instagram.com\/central/);assert.doesNotMatch(result.html,/>Facebook<|{{year}}/);
 for(const change of [{page_links:['unknown']},{social_channels:['unknown']},{banner_image:'javascript:alert(1)'}])assert.throws(()=>mail.validate({...d,...change},d.key));
});
