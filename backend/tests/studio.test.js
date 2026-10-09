const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../services/studioValidation');
const defaults = require('../services/studioDefaults');
const { renderEmail, sampleData } = require('../services/emailRenderer');
const secrets = require('../services/secrets');

test('rich content keeps formatting but removes executable HTML and unsafe links', () => {
  const value=v.html('<h2>Hello</h2><script>alert(1)</script><p onclick="alert(1)">Safe <strong>text</strong><a href="javascript:alert(1)">link</a><img src=x onerror=alert(1)></p>');
  assert.match(value,/<strong>text<\/strong>/); assert.doesNotMatch(value,/script|onclick|onerror|javascript|<img/);
});
test('template validation rejects unknown placeholders, invalid layouts and unsafe URLs',()=>{
  assert.throws(()=>v.template('email',{...defaults.email,subject:'Hello {{password}}'}),/Unknown placeholder/);
  assert.throws(()=>v.template('ticket',{...defaults.ticket,layout:'bad'}),/layout/);
  assert.throws(()=>v.template('email',{...defaults.email,button_url:'javascript:alert(1)'}),/HTTP|URL/);
  assert.throws(()=>v.template('email',{...defaults.email,logo:'//evil.test/a.png'}),/URL/);
  assert.throws(()=>v.template('ticket',{...defaults.ticket,accent:'red;display:none'}),/color/);
  assert.throws(()=>v.template('email',{...defaults.email,body:'<p></p>'}),/message/);
  assert.equal(v.url('/uploads/banner-test.png',{image:true}),'/uploads/banner-test.png');
});
test('reference toolbar content retains images and sub/superscripts safely in pages and emails', () => {
  const body='<p>H<sub>2</sub>O and x<sup>2</sup></p><figure class="image image_resized" style="width:50%"><img src="/uploads/policy-image.png" alt="Event hall" onerror="alert(1)"><figcaption>Our venue</figcaption></figure><img src="javascript:alert(1)"><img src="data:text/html,unsafe">';
  const clean=v.html(body);
  assert.match(clean,/<sub>2<\/sub>/);
  assert.match(clean,/<sup>2<\/sup>/);
  assert.match(clean,/src="\/uploads\/policy-image.png"/);
  assert.match(clean,/<figcaption>Our venue<\/figcaption>/);
  assert.doesNotMatch(clean,/onerror|javascript:|data:text/);
  const rendered=renderEmail(v.template('email',{...defaults.email,body}),{...defaults.brand,site_url:'https://tickets.example.com'},sampleData);
  assert.match(rendered.html,/src="https:\/\/tickets.example.com\/uploads\/policy-image.png"/);
});
test('CKEditor formatting survives sanitizing and email rendering without unsafe CSS', () => {
  const body='<p style="text-align:center;position:fixed"><span style="font-family:Georgia,serif;font-size:24px;color:hsl(30, 75%, 60%);background-image:url(https://evil.test)"><u>Hello {{customer_name}}</u></span></p><figure class="table"><table><tbody><tr><td colspan="2">Ticket details</td></tr></tbody></table></figure>';
  const config=v.template('email',{...defaults.email,body});
  const rendered=renderEmail(config,defaults.brand,sampleData);
  assert.match(rendered.html,/text-align:center/);
  assert.match(rendered.html,/font-size:24px/);
  assert.match(rendered.html,/color:hsl\(30, 75%, 60%\)/);
  assert.match(rendered.html,/<u>Hello Alex Morgan<\/u>/);
  assert.match(rendered.html,/colspan="2"/);
  assert.match(rendered.html,/border-collapse:collapse/);
  assert.doesNotMatch(rendered.html,/position:fixed|background-image|evil.test/);
});
test('all eleven email layouts render safe placeholders and only published policy links',()=>{
  const htmls=new Set();
  for(let format=1;format<=11;format++){
    const config=v.template('email',{...defaults.email,format,logo:'https://example.com/logo.png',banner_image:'https://example.com/banner.png',icon:'https://example.com/icon.png'});
    const rendered=renderEmail(config,defaults.brand,{...sampleData,customer_name:'<img src=x onerror=alert(1)>',booking_url:'https://example.com/confirmation/TKT-TEST'},[{slug:'privacy-policy',title:'Privacy Policy'}]);
    assert.match(rendered.html,/&lt;img/); assert.doesNotMatch(rendered.html,/<img src=x/);
    assert.match(rendered.html,/\/pages\/privacy-policy/); assert.doesNotMatch(rendered.html,/\/pages\/refund-policy/);
    assert.doesNotMatch(rendered.html,/\{\{/); htmls.add(rendered.html);
    if(format===7) assert.doesNotMatch(rendered.html,/>View my tickets</);
  }
  assert.equal(htmls.size,11);
});
test('SMTP secrets round trip, preserve whitespace, and fail closed on tampering',()=>{
  process.env.SETTINGS_ENCRYPTION_KEY='a'.repeat(64);
  const encrypted=secrets.encrypt(' leading and trailing ');
  assert.doesNotMatch(encrypted,/leading/); assert.equal(secrets.decrypt(encrypted),' leading and trailing ');
  const parts=encrypted.split('.');parts[1]=Buffer.alloc(16).toString('base64');assert.throws(()=>secrets.decrypt(parts.join('.')));
  process.env.SETTINGS_ENCRYPTION_KEY='';assert.throws(()=>secrets.encrypt('test'),/SETTINGS_ENCRYPTION_KEY/);
});
test('social links inherit brand defaults while preserving legacy overrides and hide mode', () => {
  const links=v.socialLinks({instagram:' https://instagram.com/brand ',youtube:'https://youtube.com/@brand'});
  assert.equal(links.instagram,'https://instagram.com/brand');
  assert.equal(links.facebook,'');
  assert.throws(()=>v.socialLinks({facebook:'javascript:alert(1)'}),/HTTP|URL/);
  assert.throws(()=>v.socialLinks({facebook:'https://user:secret@example.com'}),/credentials/);
  const render=config=>renderEmail(config,defaults.brand,sampleData,[],links).html;
  assert.match(render(defaults.email),/https:\/\/instagram.com\/brand/);
  assert.doesNotMatch(render({...defaults.email,social_mode:'hidden'}),/instagram.com|youtube.com/);
  const legacy={...defaults.email,social_links:{facebook:'https://facebook.com/custom'}};
  delete legacy.social_mode;
  const sanitized=v.template('email',legacy);
  assert.equal(sanitized.social_mode,'custom');
  assert.match(render(sanitized),/https:\/\/facebook.com\/custom/);
  assert.doesNotMatch(render(sanitized),/instagram.com\/brand/);
  assert.doesNotMatch(render({...defaults.email,social_mode:'custom',social_links:{}}),/instagram.com|youtube.com/);
});
