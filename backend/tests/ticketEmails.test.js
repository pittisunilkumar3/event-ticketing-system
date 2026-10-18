const test=require('node:test'),assert=require('node:assert/strict');
const {template}=require('../services/studioValidation'),{renderEmail}=require('../services/emailRenderer'),defaults=require('../services/studioDefaults'),ticketEmails=require('../services/ticketEmails');
test('dynamic registration tokens are validated and escaped; structured ticket/answer blocks stay safe',async()=>{
 const config=template('email',{...defaults.email,subject:'{{attendee_name}} {{registration_id}}',body:'<p>{{field_f_name-with-hyphen}}</p><p>{{registration_fields}}</p><p>{{ticket}}</p>',button_url:'{{submission_url}}'});
 const answers=[{id:'f_name-with-hyphen',label:'Name <script>',type:'text',value:'<img src=x onerror=alert(1)>'},{id:'f_flags',type:'checkboxes',label:'Choices',value:['A','B']},{id:'f_consent',type:'consent',label:'Consent',value:true}];
 const data={...ticketEmails.values({attendee_name:'Alex\r\nBcc: other',ticket_code:'TCK-TEST-ONE',type_name:'VIP'},answers,{submission_url:'https://forms.gle/h6sVEvBHWQJzNF7m6'}),...await ticketEmails.qr('TCK-TEST-ONE'),event_title:'Event',event_date:'Tomorrow'};
 const out=renderEmail(config,defaults.brand,data);assert.match(out.html,/&lt;img/);assert.doesNotMatch(out.html,/<script|<img src=x|{{field_|TICKETBLOCK/);assert.match(out.html,/A, B/);assert.match(out.html,/Yes/);assert.match(out.html,/cid:ticket-qr@ticketflow/);assert.equal(out.attachments.length,1);assert.doesNotMatch(out.subject,/[\r\n]/);
 assert.throws(()=>template('email',{...config,body:'{{field_bad}}'}),/Unknown placeholder/);
 assert.throws(()=>template('email',{...config,button_url:'javascript:alert(1)'}));
 const empty=renderEmail(config,defaults.brand,{attendee_name:'Guest'});assert.doesNotMatch(empty.html,/undefined|null|{{field_/);
});
test.after(()=>require('../config/db').end());
test('PDF attachments are bounded and ticket tokens request a personal PDF',()=>{
 const attachments=require('../services/emailAttachments');
 const config=template('email',{...defaults.email,attach_ticket_pdf:true,attachments:[{id:'a'.repeat(32),name:'untrusted.pdf'}]});
 assert.deepEqual(config.attachments,[{id:'a'.repeat(32)}]);
 assert.equal(attachments.needsTicket(config),true);
 assert.equal(attachments.needsTicket({...defaults.email,body:'{{ ticket_pdf }}'}),true);
 assert.equal(attachments.needsTicket(defaults.email),false);
 assert.throws(()=>template('email',{...defaults.email,attachments:[{id:'../../secret'}]}));
 assert.throws(()=>template('email',{...defaults.email,attachments:Array.from({length:4},(_,i)=>({id:String(i).repeat(32)}))}));
 assert.throws(()=>template('email',{...defaults.email,attachments:[{id:'a'.repeat(32)},{id:'a'.repeat(32)}]}));
});
test('ticket PDF option stays on the booking receipt without duplicate personal emails',async()=>{
 const config={...defaults.email,attach_ticket_pdf:true};
 const conn={query:async()=>[[{id:1,name:'Confirmation',active:1,config_json:JSON.stringify(config)}]]};
 const snapshot=await ticketEmails.snapshot({},conn);
 assert.equal(snapshot.personal,false);
 assert.equal(snapshot.template.config.attach_ticket_pdf,true);
 assert.equal(ticketEmails.needsPersonal({...config,body:'{{ticket_pdf}}'}),false);
 assert.equal(ticketEmails.needsPersonal({...config,body:'{{attendee_name}}'}),true);
});
test('delivered ticket emails match the selected preview without appended booking sections',()=>{
 const data={customer_name:'Guest',event_title:'Expo',booking_ref:'TKT-TEST',ticket_count:1,amount:'₹999.00',booking_url:'https://example.com/confirmation/TKT-TEST'};
 const delivery={...data,include_booking_details:true,tickets:[{attendee_name:'Guest',type_name:'Explorer',ticket_code:'TCK-HIDDEN'}],attachments:[{filename:'ticket.pdf',content:Buffer.from('%PDF-fixture')}]};
 for(let format=1;format<=11;format++){
  const config={...defaults.email,format,show_logo:false,body:'<p>My chosen design for {{customer_name}}</p>',attach_ticket_pdf:true};
  const preview=renderEmail(config,defaults.brand,data),sent=renderEmail(config,defaults.brand,delivery);
  assert.equal(sent.html,preview.html,`Layout ${format} must match its preview`);
  assert.doesNotMatch(sent.html,/Your entry tickets|Open your booking and QR tickets|TCK-HIDDEN/);
  assert.equal(sent.attachments[0].filename,'ticket.pdf');
  assert.doesNotMatch(sent.html,/Booking reference<\/td>|Event<\/td>|Total<\/td>/);
 }
});
test('tables explicitly authored in the email body remain intact',()=>{
 const rendered=renderEmail({...defaults.email,format:9,body:'<table><tr><td>My detail</td><td>{{booking_ref}}</td></tr></table>'},defaults.brand,{booking_ref:'TKT-CUSTOM'});
 assert.match(rendered.html,/<td[^>]*>My detail<\/td><td[^>]*>TKT-CUSTOM<\/td>/);
 assert.doesNotMatch(rendered.html,/Booking reference<\/td>/);
});
