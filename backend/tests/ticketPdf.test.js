const test=require('node:test'),assert=require('node:assert/strict');
const {renderTicketDocument}=require('../generated/ticketDocument.cjs');
const layouts=require('../services/ticketLayouts'),defaults=require('../services/studioDefaults').ticket;
const ticket={id:42,attendee_name:'Alexandra Catherine Morgan Patel',ticket_code:'TCK-ACTUAL-1234',status:'valid'};
const order={event_title:'Cinematica Expo 2026',event_start:'2026-12-12 09:00:00',venue:'Main Hall',city:'Hyderabad',booking_ref:'TKT-1234',currency:'INR'};
test('component layouts retain order, spacing, actual data and escaped custom content in PDFs',()=>{
 const v=require('../services/studioValidation');
 const blocks=require('../../shared/ticketBlocks.json').defaults;
 const design=v.template('ticket',{...defaults.ticket,logos:['/uploads/partner.png'],logo:'/uploads/main.png',layout_blocks:[{id:'custom',type:'text',text:'<script>Custom welcome</script>',width:50,align:'right',margin_top:18,padding:20},...blocks]});
 const html=renderTicketDocument({design:{...design,price:999,type_name:'Explorer Pass'},ticket,order});
 assert.match(html,/ticket-canvas/);assert.match(html,/margin-top:18px/);assert.match(html,/text-align:right/);
 assert.match(html,/&lt;script&gt;Custom welcome&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.ok(html.indexOf('Custom welcome')<html.indexOf('src="/uploads/main.png"'));
 for(const value of ['Alexandra Catherine Morgan Patel','TCK-ACTUAL-1234','Explorer Pass','Main Hall','₹999.00'])assert.ok(html.includes(value));
 assert.match(html,/class="ticket-logo-group"/);assert.match(html,/src="\/uploads\/partner.png"/);
 assert.doesNotMatch(html,/<button/);
 const removed=renderTicketDocument({design:{...design,layout_blocks:design.layout_blocks.filter(b=>b.type!=='qr'&&b.type!=='attendee_name')},ticket,order});
 assert.doesNotMatch(removed,/<svg|Alexandra Catherine Morgan Patel/);
 const preview=renderTicketDocument({design,ticket,order,preview:true});assert.match(preview,/PREVIEW ONLY/);assert.doesNotMatch(preview,/TCK-ACTUAL-1234/);
});
test('every selected design is rendered with the shared issued-ticket component',()=>{
 for(const item of layouts){
  const html=renderTicketDocument({design:{...defaults,...item.config,type_name:'Selected pass',price:1999},ticket,order});
  assert.match(html,new RegExp('ticket-layout-'+item.id));
  assert.match(html,/Alexandra Catherine Morgan Patel/);
  assert.match(html,/TCK-ACTUAL-1234/);
  assert.match(html,/Selected pass/i);
  assert.doesNotMatch(html,/PREVIEW ONLY/);
 }
});
test('preview QR is invalid and hidden attendee/price settings are respected',()=>{
 const html=renderTicketDocument({design:{...defaults,show_attendee:false,show_price:false},ticket,order,preview:true});
 assert.match(html,/PREVIEW ONLY/);assert.doesNotMatch(html,/TCK-ACTUAL-1234|Alexandra Catherine|TICKET PRICE/);
});
test('all ticket PDF layouts preserve the full banner and six additional logos',()=>{
 for(const item of layouts){
  const logos=Array.from({length:6},(_,i)=>`/uploads/expo/partner-${i}.png`);
  const html=renderTicketDocument({design:{...defaults,...item.config,full_banner:true,banner_image:'/uploads/expo/banner.webp',logo:'/uploads/expo/logo.png',logos},ticket,order});
  assert.match(html,/class="ticket-full-banner"/);
  assert.match(html,/src="\/uploads\/expo\/banner.webp"/);
  for(const src of [...logos,'/uploads/expo/logo.png'])assert.ok(html.includes(`src="${src}"`),item.id+' renders '+src);
  assert.match(html,/TCK-ACTUAL-1234/);
 }
});
test('ticket content and branding are escaped in the PDF document',()=>{
 const html=renderTicketDocument({design:{...defaults,brand:'<script>bad</script>'},ticket:{...ticket,attendee_name:'<img src=x onerror=bad>'},order});
 assert.doesNotMatch(html,/<script>|<img src="x"/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);
});
test('all designs and PDFs use edited labels and actual per-ticket values without editor controls',()=>{
 for(const item of [...layouts,...require('../services/legacyTicketLayouts')]){
  const design={...defaults,...item.config,text:{attendee_label:'ATTENDEE',attendee_name:'Welcome {{attendee_name}}',booking_ref:'Reference: {{booking_ref}}',ticket_type:'Pass: {{ticket_type}}',venue_label:'LOCATION'},type_name:'Explorer Pass'};
  const html=renderTicketDocument({design,ticket,order});
  assert.match(html,/ATTENDEE/);assert.match(html,/Welcome Alexandra Catherine Morgan Patel/);
  assert.match(html,/Reference: TKT-1234/);assert.match(html,/Pass: Explorer Pass/);assert.match(html,/LOCATION/);
  assert.doesNotMatch(html,/<[^>]+(?:contenteditable|aria-label="Edit|role="button")/);
  const other=renderTicketDocument({design,ticket:{...ticket,attendee_name:'Guest Two'},order});
  assert.match(other,/Welcome Guest Two/);assert.doesNotMatch(other,/Alexandra Catherine/);
 }
 const html=renderTicketDocument({design:{...defaults,text:{attendee_label:'<script>bad()</script>'}},ticket,order});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('free canvas PDF retains positions, individual logos and no editor controls',()=>{
 const config=require('../services/studioValidation').template('ticket',{...defaults,logo:'/uploads/main.png',logos:['/uploads/partner.png'],canvas:{height:1100},layout_blocks:[
  {id:'logo',type:'main_logo',frame:{x:20,y:30,w:100,h:70}},
  {id:'partner',type:'partner_logo',partner_index:0,frame:{x:140,y:30,w:100,h:70}},
  {id:'guest',type:'attendee_name',font_size:24,frame:{x:40,y:200,w:500,h:120}},
  {id:'qr',type:'qr',frame:{x:500,y:700,w:180,h:200}},
 ]});
 const html=renderTicketDocument({design:config,ticket,order});
 assert.match(html,/ticket-freeform/);assert.match(html,/height:1100px/);assert.match(html,/left:500px;top:700px;width:180px;height:200px/);
 assert.match(html,/Alexandra Catherine Morgan Patel/);assert.match(html,/src="\/uploads\/partner.png"/);assert.match(html,/<svg/);
 assert.doesNotMatch(html,/<button/);
 const blank=require('../services/studioValidation').template('ticket',{...defaults,canvas:{height:800},layout_blocks:[]});
 const empty=renderTicketDocument({design:blank,ticket,order});assert.doesNotMatch(empty,/Alexandra Catherine|TCK-ACTUAL|canvas-qr"/);
});

test('original-layout edits survive PDF rendering with real attendee values',()=>{
 const config=require('../services/studioValidation').template('ticket',{...defaults,element_adjustments:{text_attendee_name:{x:25,y:10,sx:1.3,sy:1.3},text_venue:{hidden:true}},extra_elements:[{id:'extra_note',type:'text',text:'Welcome <guest>',x:5,y:10,w:30,h:20}]});
 const html=renderTicketDocument({design:config,ticket,order});
 assert.match(html,/ticket-layout-classic/);assert.doesNotMatch(html,/class="[^"]*ticket-canvas/);
 assert.match(html,/translate\(25cqw,10cqw\) scale\(1.3,1.3\)/);assert.match(html,/visibility:hidden!important/);
 assert.match(html,/Welcome &lt;guest&gt;/);assert.match(html,/Alexandra Catherine Morgan Patel/);assert.doesNotMatch(html,/<button/);
});
test('added booking fields render each attendee and do not become fixed preview text',()=>{
 const config=require('../services/studioValidation').template('ticket',{...defaults,extra_elements:[{id:'extra_guest',type:'field',field:'attendee_name',x:5,y:10,w:30,h:20}]});
 const first=renderTicketDocument({design:config,ticket,order});
 const second=renderTicketDocument({design:config,ticket:{...ticket,attendee_name:'Second Guest'},order});
 assert.match(first,/ticket-extra-field/);assert.match(second,/Second Guest/);assert.doesNotMatch(second,/Alexandra Catherine Morgan Patel/);
});

test('section movement keeps original flex layouts and dividers in issued PDFs',()=>{
 const design={...defaults,layout:'luxe',element_adjustments:{section_qr:{x:-8,y:0,sx:.8,sy:.8},divider:{x:0,y:4,sx:1,sy:1}},extra_elements:[{id:'extra_line',type:'divider',x:10,y:70,w:40,h:2,color:'#c79d56',font_size:18}]};
 const html=renderTicketDocument({design,ticket,order});
 assert.match(html,/data-ticket-part="section_qr" class="ticket-stub"/);
 assert.match(html,/data-ticket-part="divider" class="ticket-content-divider"/);
 assert.match(html,/ticket-extra-line/);
 assert.match(html,/translate\(-8cqw,0cqw\) scale\(0.8,0.8\)/);
 assert.doesNotMatch(html,/\[data-ticket-part="section_qr"\][^{]+\{display:inline-block/);
 assert.match(html,/TCK-ACTUAL-1234/);
 assert.doesNotMatch(html,/Add component|Select section/);
});

test('ticket size, independent QR divider and text styling render in PDF markup',()=>{
 const html=renderTicketDocument({design:{...defaults,ticket_size:{width:1000,height:700},element_adjustments:{divider_qr:{x:-5,y:0,sx:1,sy:.8},text_attendee_name:{font_size:24,color:'#c79d56',rotation:5,opacity:.8}}},ticket,order});
 assert.match(html,/ticket-pdf-root\{width:1000px/);assert.match(html,/width:1000px/);assert.match(html,/height:70cqw/);
 assert.match(html,/data-ticket-part="divider_qr"/);assert.match(html,/translate\(-5cqw,0cqw\) scale\(1,0.8\)/);assert.match(html,/font-size:24px/);assert.match(html,/rotate\(5deg\)/);assert.match(html,/color:#c79d56/);assert.match(html,/TCK-ACTUAL-1234/);
});

test('scaled tickets preserve artwork and resolve custom variables for each attendee',()=>{
 const v=require('../services/studioValidation');
 const design=v.template('ticket',{...defaults,layout:'classic',ticket_size:{width:380,height:300,contentWidth:760,contentHeight:600},card_background:'#112233',extra_elements:[{id:'extra_welcome',type:'text',text:'Hello {{attendee_name}} — {{booking_ref}}',color:'#ffffff'}],element_adjustments:{section_pass:{hidden:true},section_footer:{box_height:12}}});
 for(const name of ['Guest One','Guest <Two>']){
  const html=renderTicketDocument({design,ticket:{...ticket,attendee_name:name},order});
  assert.match(html,/ticket-scale-surface/);assert.match(html,/zoom:0.5/);assert.match(html,/background:#112233/);assert.match(html,/height:12cqw/);assert.ok(html.includes(name.replace('<','&lt;').replace('>','&gt;')+' — TKT-1234'));assert.doesNotMatch(html,/Hello {{attendee_name}}/);
 }
});

test('button badges resolve guest variables and keep custom styling in PDFs',()=>{
 const v=require('../services/studioValidation');
 const design=v.template('ticket',{...defaults,extra_elements:[{id:'extra_badge',type:'badge',text:'Welcome {{attendee_name}}'}],element_adjustments:{extra_badge:{background:'#223344',color:'#ffffff',border_radius:30,x:4,y:3,sx:1.2,sy:1.2}}});
 const html=renderTicketDocument({design,ticket,order});
 assert.match(html,/ticket-extra-badge/);assert.ok(html.includes('Welcome Alexandra Catherine Morgan Patel'));assert.match(html,/border-radius:30px/);assert.match(html,/background:#223344/);assert.doesNotMatch(html,/Welcome {{attendee_name}}/);
});

test('custom colors, exact paper dimensions and draft variables use the same PDF renderer',()=>{
 const design=require('../services/studioValidation').template('ticket',{...defaults,ticket_size:{width:520,height:340,contentWidth:780,contentHeight:510,referenceWidth:760},card_background:'#102030',element_adjustments:{section_pass:{color:'#00cc88',background:'#234567'},text_attendee_name:{color:'#1122ff',x:3,y:-2},extra_note:{color:'#ffffff',x:5,y:8}},extra_elements:[{id:'extra_note',type:'text',text:'Hello {{attendee_name}}',color:'#f97316',font_size:18}]});
 const html=renderTicketDocument({design,ticket,order,preview:true});
 assert.match(html,/html,body\{[^}]*width:520px/);
 assert.match(html,/ticket-pdf-root\{width:520px;margin:0\}/);
 assert.doesNotMatch(html,/<p class="pdf-preview-note"/);
 assert.match(html,/\[data-ticket-part="section_pass"\] ticket-text\{color:#00cc88!important/);
 assert.match(html,/color:#1122ff!important/);assert.match(html,/color:#ffffff!important/);
 assert.match(html,/background:#102030!important/);assert.match(html,/height:340px/);
 assert.match(html,/Hello Alexandra Catherine Morgan Patel/);
 assert.match(html,/@container ticket-layout/);
});

test('QR movement and removal include its white frame in every original layout and PDF',()=>{
 for(const layout of [...layouts,...require('../services/legacyTicketLayouts')]){
  const html=renderTicketDocument({design:{...defaults,...layout.config,element_adjustments:{qr:{x:-20,y:4,sx:1.2,sy:1.2}}},ticket,order});
  assert.match(html,/<div data-ticket-part="qr"[^>]*><svg/,layout.id);
  assert.doesNotMatch(html,/<svg[^>]+data-ticket-part="qr"/,layout.id);
  assert.match(html,/translate\(-20cqw,4cqw\) scale\(1.2,1.2\)/);
  assert.doesNotMatch(html,/\[data-ticket-part="qr"\][^{]+\{display:inline-block/);
 }
 const hidden=renderTicketDocument({design:{...defaults,element_adjustments:{qr:{hidden:true}}},ticket,order});
 assert.match(hidden,/\[data-ticket-part="qr"\][^{]+\{visibility:hidden!important/);
});

test('added ticket QR is an image while ticket code is text, including blank designs and previews',()=>{
 const v=require('../services/studioValidation');
 const design=v.template('ticket',{...defaults,canvas:{height:600},layout_blocks:[],extra_elements:[{id:'extra_scan',type:'qr',x:10,y:10,w:20,h:30},{id:'extra_id',type:'field',field:'ticket_code',x:10,y:50,w:50,h:10}]});
 const render=(code,preview=false)=>renderTicketDocument({design,ticket:{...ticket,ticket_code:code},order,preview});
 const first=render('TCK-ONE-123'),second=render('TCK-TWO-456'),preview=render('TCK-ONE-123',true);
 assert.equal((first.match(/<svg/g)||[]).length,1);
 assert.match(first,/class="ticket-extra ticket-extra-qr"[^>]*><svg/);
 assert.match(first,/<ticket-text data-ticket-part="text_ticket_code">TCK-ONE-123<\/ticket-text>/);
 assert.notEqual(first.match(/<svg[\s\S]*?<\/svg>/)[0],second.match(/<svg[\s\S]*?<\/svg>/)[0]);
 assert.match(preview,/TCK-PREVIEW-000042/);assert.doesNotMatch(preview,/TCK-ONE-123/);
 assert.equal(require('../../shared/ticketText.json').ticket_code.label,'Ticket code (text)');
 assert.equal(require('../../shared/ticketElements.json').qr,'Ticket QR code');
});

test('custom registration variables resolve per attendee and never leak preview data',()=>{
 const v=require('../services/studioValidation');
 const design=v.template('ticket',{...defaults,element_adjustments:{text_event_title:{hidden:true}},extra_elements:[{id:'extra_personal',type:'text',text:'{{field_f_name_123}} | {{field_f_profession}} | {{attendee_email}} | {{field_f_missing}}',x:10,y:10,w:70,h:20}]});
 for(const [name,profession,email] of [['Person One','Filmmaker','one@example.test'],['Person Two','Artist','two@example.test']]){
  const html=renderTicketDocument({design:JSON.parse(JSON.stringify(design)),ticket:{...ticket,attendee_email:email,registration_answers:[{id:'f_name_123',type:'name',value:name},{id:'f_profession',type:'checkboxes',value:[profession,'Creator']}]},order});
  assert.ok(html.includes(name+' | '+profession+', Creator | '+email+' | '));
  assert.doesNotMatch(html,/{{field_|Sample |alex@example.test/);
  assert.match(html,/<ticket-text aria-hidden="true" style="visibility:hidden" data-ticket-part="text_event_title"/);
 }
 assert.throws(()=>v.template('ticket',{...design,extra_elements:[{...design.extra_elements[0],text:'{{password}}'}]}),/Unknown ticket variable/);
});

test('a cleared title survives validation and rendering without a fallback title',()=>{
 const design=require('../services/studioValidation').template('ticket',{...defaults,text:{event_title:''}});
 const html=renderTicketDocument({design:JSON.parse(JSON.stringify(design)),ticket,order});
 assert.ok(html.includes('data-ticket-part="text_event_title"></ticket-text>'));
 assert.ok(!html.includes('Cinematica Expo 2026'));
});

test('issued tickets receive only their matching attendee answers',async()=>{
 const Ticket=require('../models/Ticket');
 const answers=[{id:'f_name',type:'name',value:'Person One'}];
 const rows=await Ticket.findByOrderId(11,{query:async(sql,params)=>{
  assert.match(sql,/a.id=t.attendee_id AND a.order_id=t.order_id/);assert.deepEqual(params,[11]);
  return [[{id:1,attendee_answers_json:JSON.stringify(answers),design_snapshot:JSON.stringify(defaults)},{id:2,attendee_answers_json:null}]];
 }});
 assert.deepEqual(rows[0].attendee_answers,answers);assert.deepEqual(rows[1].attendee_answers,[]);assert.equal(rows[0].attendee_answers_json,undefined);
 await require('../config/db').end();
});

test('pasted components keep typography, transforms and live variables in the shared PDF renderer',()=>{
 const item={id:'extra_pasted',type:'text',text:'Welcome {{attendee_name}}',x:0,y:0,w:40,h:10,color:'#22cc88',font_size:26,appearance:{font:'display',weight:650,line_height:1.45,letter_spacing:2,font_style:'italic',text_transform:'uppercase',align:'center'}};
 const design=require('../services/studioValidation').template('ticket',{...defaults,extra_elements:[item],element_adjustments:{extra_pasted:{x:5,y:7,sx:1.2,sy:1.2,rotation:8,font_size:26,color:'#22cc88'}}});
 const html=renderTicketDocument({design,ticket,order});
 assert.match(html,/Welcome Alexandra Catherine Morgan Patel/);assert.match(html,/translate\(5cqw,7cqw\) scale\(1.2,1.2\) rotate\(8deg\)/);
 assert.match(html,/font-weight:650;line-height:1.45;letter-spacing:2px;font-style:italic;text-transform:uppercase;text-align:center/);
 assert.match(html,/font-size:26px!important/);assert.match(html,/color:#22cc88!important/);
});

test('resized freeform tickets share one sizing system with existing ticket layouts',()=>{
 const size={width:720,height:480,contentWidth:900,contentHeight:600,referenceWidth:760};
 const design=require('../services/studioValidation').template('ticket',{...defaults,canvas:{height:1000},layout_blocks:[],ticket_size:size,extra_elements:[{id:'extra_qr',type:'qr',label:'QR',x:10,y:10,w:20,h:30,font_size:18,color:'#ffffff'}]});
 const html=renderTicketDocument({design,ticket,order});
 assert.ok(html.includes('width:900px;max-width:none;margin:0;height:600px;'));
 assert.match(html,/zoom:0.8/);assert.match(html,/class="ticket-presentation" style="height:480px;overflow:clip"/);
 assert.doesNotMatch(html,/class="ticket-freeform-wrap"|transform:scale\(/);
 assert.match(html,/ticket-extra-qr/);
});
