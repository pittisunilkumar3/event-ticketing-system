const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../services/studioValidation');
const defaults = require('../services/studioDefaults');
const { renderEmail, sampleData } = require('../services/emailRenderer');
const secrets = require('../services/secrets');

test('component layouts validate geometry, identity and custom text without accepting CSS', () => {
  const blocks=require('../../shared/ticketBlocks.json').defaults;
  const config=v.template('ticket',{...defaults.ticket,layout_blocks:blocks,logo_style:{align:'right',size:64,gap:12}});
  assert.equal(config.layout_blocks.length,blocks.length);
  assert.equal(config.logo_style.size,64);
  assert.equal(config.layout_blocks.find(b=>b.type==='qr').qr_size,112);
  for(const bad of [[],Array(37).fill(blocks[0]),[{id:'a',type:'script'}],[{id:'a',type:'text',padding:'position:fixed'}],[{id:'a',type:'text',width:33}],[{id:'a',type:'qr',qr_size:999}],[{id:'a',type:'text'},{id:'a',type:'text'}]]) {
    assert.throws(()=>v.template('ticket',{...defaults.ticket,layout_blocks:bad}));
  }
  assert.throws(()=>v.template('ticket',{...defaults.ticket,logo_style:{size:-1}}));
  assert.equal(v.template('ticket',defaults.ticket).layout_blocks,null);
});

test('ticket text overrides preserve booking fields and reject unsafe field substitutions', () => {
  const config = v.template('ticket', {...defaults.ticket,text:{attendee_label:'ATTENDEE',attendee_name:'Welcome {{attendee_name}}',scan_label:'Show at entry',admit_label:''}});
  assert.equal(config.text.attendee_label,'ATTENDEE');
  assert.equal(config.text.attendee_name,'Welcome {{attendee_name}}');
  assert.equal(config.text.admit_label,'');
  assert.deepEqual(v.template('ticket',defaults.ticket).text,{});
  assert.throws(()=>v.template('ticket',{...defaults.ticket,text:[]}),/Invalid ticket text/);
  assert.equal(v.template('ticket',{...defaults.ticket,text:{event_title:''}}).text.event_title,'');
  assert.equal(v.template('ticket',{...defaults.ticket,text:{attendee_name:'{{field_f_full_name}}'}}).text.attendee_name,'{{field_f_full_name}}');
  assert.equal(v.template('ticket',{...defaults.ticket,text:{price:'{{price}} {{attendee_name}}'}}).text.price,'{{price}} {{attendee_name}}');
  assert.throws(()=>v.template('ticket',{...defaults.ticket,text:{price:'{{price}} {{password}}'}}),/variable/);
  assert.throws(()=>v.template('ticket',{...defaults.ticket,text:{unknown:'value'}}),/Unknown/);
  assert.throws(()=>v.template('ticket',{...defaults.ticket,text:{venue_label:'x'.repeat(501)}}),/invalid/);
});

test('ticket branding validates, deduplicates and preserves multiple logos', () => {
  const config = v.template('ticket', {...defaults.ticket, full_banner:true, logos:['/uploads/expo/logo.png', '', '/uploads/expo/partner.webp', '/uploads/expo/logo.png']});
  assert.deepEqual(config.logos, ['/uploads/expo/logo.png', '/uploads/expo/partner.webp']);
  assert.equal(config.full_banner, true);
  assert.deepEqual(v.template('ticket', {layout:'classic'}).logos, []);
  assert.throws(() => v.template('ticket', {...defaults.ticket, logos:'bad'}), /six/);
  assert.throws(() => v.template('ticket', {...defaults.ticket, logos:Array(7).fill('/uploads/a.png')}), /six/);
  assert.throws(() => v.template('ticket', {...defaults.ticket, logos:['javascript:alert(1)']}), /HTTP/);
  assert.equal(v.template('ticket', {...defaults.ticket, full_banner:'false'}).full_banner, false);
});

test('built-in collection has 100 distinct structures without repetitive editions', () => {
  const layouts = require('../services/ticketLayouts');
  assert.equal(layouts.length, 100);
  assert.ok(layouts.every(l => !l.id.includes('--')));
  assert.equal(new Set(layouts.map(l => l.id.split('--')[0])).size, layouts.length);
  assert.equal(new Set(layouts.map(l => l.id)).size, 100);
  assert.deepEqual(new Set(layouts.map(l => l.category)), new Set(['Horizontal', 'Portrait', 'Compact']));
  for (const layout of layouts) {
    const config = v.template('ticket', { ...defaults.ticket, ...layout.config });
    assert.equal(config.layout, layout.id);
    assert.equal(config.accent, layout.config.accent);
    assert.equal(config.show_attendee, true);
    assert.equal(config.show_price, true);
  }
});

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
test('classic editor heading, formatted block and text direction survive policy sanitizing', () => {
  const clean=v.html('<div dir="rtl"><h1>Privacy</h1><h5>Details</h5><h6>Contact</h6><pre>Line one\nLine two</pre><iframe src="https://example.com"></iframe><form><input name="password"></form></div>');
  assert.match(clean,/<div dir="rtl">/);
  for(const tag of ['h1','h5','h6','pre']) assert.ok(clean.includes('<'+tag+'>'));
  assert.match(clean,/Line one\nLine two/);
  assert.doesNotMatch(clean,/iframe|form|input|password/);
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
  // Formats 5 and 6 now share the message-only layout after removing the
  // automatic order table; keep both saved format IDs compatible.
  assert.equal(htmls.size,10);
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

test('retired edition layouts remain valid for existing customized designs', () => {
  const legacy = require('../services/legacyTicketLayouts');
  assert.equal(legacy.length, 80);
  for (const layout of legacy) assert.equal(v.template('ticket', {...defaults.ticket, ...layout.config}).layout, layout.id);
});

test('all 80 new compositions have different section arrangements, valid rectangles and complete ticket fields', () => {
  const recipes = require('../../shared/ticketCompositions.json');
  assert.equal(recipes.length,80);
  assert.equal(new Set(recipes.map(r=>r.areas)).size,80, 'Color, font and naming changes cannot count as new layouts');
  for (const recipe of recipes) {
    const rows = recipe.areas.split('/').map(row=>row.split(' '));
    assert.ok(rows.every(row=>row.length===rows[0].length), recipe.id);
    for (const region of ['b','h','m','q','d','t','f']) assert.ok(rows.flat().includes(region),recipe.id+' missing '+region);
    for (const region of new Set(rows.flat())) {
      const cells=rows.flatMap((row,y)=>row.flatMap((r,x)=>r===region?[[x,y]]:[]));
      const xs=cells.map(c=>c[0]), ys=cells.map(c=>c[1]);
      assert.equal(cells.length,(Math.max(...xs)-Math.min(...xs)+1)*(Math.max(...ys)-Math.min(...ys)+1),recipe.id+' invalid '+region);
    }
  }
});


test('site settings validate input, preserve omitted fields and expose only public branding', () => {
  const {validateSiteSettings,publicSiteSettings}=require('../services/siteSettings');
  const current={...defaults.brand,site_title:'Tickets by Example',favicon:'/uploads/icon.png',phone:'+91 12345'};
  const saved=validateSiteSettings({company_name:'Example Events'},current);
  assert.equal(saved.site_title,current.site_title);
  assert.equal(saved.favicon,current.favicon);
  assert.equal(saved.phone,current.phone);
  assert.throws(()=>validateSiteSettings({site_title:''},current),/site title/i);
  assert.throws(()=>validateSiteSettings({favicon:'javascript:alert(1)'},current),/HTTP/);
  assert.throws(()=>validateSiteSettings({site_url:'https://example.com/something'},current),/origin/);
  assert.throws(()=>validateSiteSettings({support_email:'invalid'},current),/email/i);
  const safe=publicSiteSettings({...saved,password_encrypted:'private',smtp:{password:'secret'},admin_token:'private'});
  assert.deepEqual(Object.keys(safe).sort(),Object.keys(defaults.brand).sort());
  assert.doesNotMatch(JSON.stringify(safe),/private|secret|password|admin_token/);
  assert.equal(validateSiteSettings({favicon:'',support_email:''},current).favicon,'');
});

test('removing an email logo stays removed even when the website has a logo',()=>{
 const brand={...defaults.brand,logo:'https://example.com/website-logo.png'};
 const removed=v.template('email',{...defaults.email,format:8,logo:'',show_logo:false,banner_image:'https://example.com/banner.jpg'});
 assert.equal(removed.show_logo,false);
 assert.doesNotMatch(renderEmail(removed,brand,sampleData).html,/Company logo|website-logo/);
 assert.match(renderEmail(removed,brand,sampleData).html,/banner.jpg/);
 const legacy=v.template('email',{...defaults.email,format:8});
 assert.match(renderEmail(legacy,brand,sampleData).html,/website-logo/);
 const uploaded=v.template('email',{...removed,show_logo:true,logo:'https://example.com/new-logo.png'});
 assert.match(renderEmail(uploaded,brand,sampleData).html,/new-logo/);
});
test('free canvas validates geometry and allows a truly blank design',()=>{
 const base={...require('../services/studioDefaults').ticket,canvas:{height:1000},layout_blocks:[{id:'qr',type:'qr',frame:{x:20,y:30,w:150,h:170}}]};
 const validate=require('../services/studioValidation').template;
 assert.equal(validate('ticket',base).layout_blocks[0].frame.y,30);
 assert.equal(validate('ticket',{...base,layout_blocks:[]}).layout_blocks.length,0);
 for(const frame of [{x:-1,y:0,w:100,h:150},{x:700,y:0,w:100,h:150},{x:0,y:950,w:100,h:150},{x:0,y:0,w:20,h:150},{x:0,y:0,w:100,h:10},{x:NaN,y:0,w:100,h:150}])assert.throws(()=>validate('ticket',{...base,layout_blocks:[{...base.layout_blocks[0],frame}]}));
 assert.throws(()=>validate('ticket',{...base,canvas:{height:6001}}));
 assert.throws(()=>validate('ticket',{...base,layout_blocks:[{id:'a',type:'text'}]}));
});

test('original-layout adjustments and additions validate without changing the layout',()=>{
 const input={...defaults.ticket,element_adjustments:{text_attendee_name:{x:20,y:30,sx:1.5,sy:1.5},qr:{sx:1.2,sy:1.2},text_venue:{hidden:true}},extra_elements:[{id:'extra_test',type:'text',text:'Welcome',x:5,y:10,w:30,h:20}]};
 const saved=v.template('ticket',input);assert.equal(saved.layout,'classic');assert.equal(saved.layout_blocks,null);assert.equal(saved.element_adjustments.text_attendee_name.sx,1.5);assert.equal(saved.extra_elements[0].text,'Welcome');
 for(const patch of [{element_adjustments:{'bad]{}':{}}},{element_adjustments:{qr:{sx:2,sy:1}}},{element_adjustments:{text_brand:{x:Infinity}}},{extra_elements:[{id:'extra_x',type:'image',src:'javascript:alert(1)'}]},{extra_elements:[{id:'extra_x',type:'text',x:90,w:30}]},{extra_elements:Array(37).fill({id:'extra_x',type:'text'})}])assert.throws(()=>v.template('ticket',{...defaults.ticket,...patch}));
});

test('movable ticket sections and added dividers survive validation without distorting QR groups',()=>{
 const input={...defaults.ticket,element_adjustments:{section_qr:{x:-10,y:2,sx:.8,sy:.8},divider:{x:0,y:4,sx:1.2,sy:1}},extra_elements:[{id:'extra_divider',type:'divider',x:10,y:50,w:50,h:2,color:'#c79d56'}]};
 const saved=v.template('ticket',input);
 assert.equal(saved.element_adjustments.section_qr.x,-10);
 assert.equal(saved.extra_elements[0].type,'divider');
 assert.throws(()=>v.template('ticket',{...input,element_adjustments:{section_qr:{sx:2,sy:1}}}),/square/);
});

test('ticket dimensions and element appearance validate and round trip',()=>{
 const input={...defaults.ticket,ticket_size:{width:1000,height:700},element_adjustments:{divider_qr:{x:-5,y:3,sx:1,sy:.7},text_attendee_name:{font_size:24,color:'#c79d56',rotation:5,opacity:.8,weight:700,align:'center',layer:4}}};
 const saved=v.template('ticket',input);assert.deepEqual(saved.ticket_size,{width:1000,height:700});assert.equal(saved.element_adjustments.text_attendee_name.font_size,24);assert.equal(saved.element_adjustments.divider_qr.x,-5);
 for(const ticket_size of [{width:0,height:500},{width:1601,height:500},{width:700,height:4001},{width:NaN,height:500},'bad',{}])assert.throws(()=>v.template('ticket',{...defaults.ticket,ticket_size}));
 for(const patch of [{rotation:181},{font_size:151},{opacity:2},{layer:99},{color:'red;display:none'},{align:'bad'}])assert.throws(()=>v.template('ticket',{...defaults.ticket,element_adjustments:{text_brand:patch}}));
});

test('whole-ticket scaling and footer geometry persist with bounded values',()=>{
 const ticket_size={width:380,height:300,contentWidth:760,contentHeight:600};
 const saved=v.template('ticket',{...defaults.ticket,ticket_size,card_background:'#112233',element_adjustments:{section_pass:{hidden:true},section_footer:{box_width:80,box_height:12,background:'#334455',color:'#ffffff'}}});
 assert.deepEqual(saved.ticket_size,ticket_size);assert.equal(saved.card_background,'#112233');assert.equal(saved.element_adjustments.section_footer.box_height,12);assert.equal(saved.element_adjustments.section_pass.hidden,true);
 for(const size of [{...ticket_size,contentWidth:0},{...ticket_size,contentHeight:NaN},{...ticket_size,height:700}])assert.throws(()=>v.template('ticket',{...defaults.ticket,ticket_size:size}));
 assert.throws(()=>v.template('ticket',{...defaults.ticket,extra_elements:[{id:'extra_bad',type:'text',text:'{{password}}'}]}),/variable/);
});

test('added button badges validate editable text, color and rounded corners',()=>{
 const extra={id:'extra_badge',type:'badge',text:'Admit {{attendee_name}}',x:10,y:10,w:25,h:8,color:'#ffffff'};
 const c=v.template('ticket',{...defaults.ticket,extra_elements:[extra],element_adjustments:{extra_badge:{background:'#334455',border_radius:20}}});
 assert.equal(c.extra_elements[0].type,'badge');assert.equal(c.extra_elements[0].text,extra.text);assert.equal(c.element_adjustments.extra_badge.border_radius,20);
 assert.throws(()=>v.template('ticket',{...defaults.ticket,extra_elements:[{...extra,text:'{{secret}}'}]}),/variable/);
 assert.throws(()=>v.template('ticket',{...defaults.ticket,extra_elements:[extra],element_adjustments:{extra_badge:{border_radius:101}}}));
});

test('copied component typography survives validation without accepting arbitrary CSS',()=>{
  const item={id:'extra_copy',type:'text',text:'{{attendee_name}} {{field_f_profession}}',x:0,y:0,w:30,h:10,font_size:26,color:'#22cc88',appearance:{font:'display',weight:650,line_height:1.45,letter_spacing:2,font_style:'italic',text_transform:'uppercase',align:'center'}};
  const config={...defaults.ticket,extra_elements:[item],element_adjustments:{extra_copy:{x:3,y:4,sx:1.2,sy:1.2,rotation:8,color:'#22cc88',font_size:26}}};
  const saved=v.template('ticket',config);
  assert.deepEqual(saved.extra_elements[0].appearance,item.appearance);assert.equal(saved.element_adjustments.extra_copy.rotation,8);
  for(const appearance of [{font:'url(https://example.com)'},{weight:2000},{line_height:-1},{letter_spacing:Infinity},{text_transform:'unset;display:none'}])assert.throws(()=>v.template('ticket',{...config,extra_elements:[{...item,appearance}]}));
});
