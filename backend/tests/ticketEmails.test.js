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
test('ticket PDF checkbox makes the default confirmation attendee-specific without body tokens',async()=>{
 const config={...defaults.email,attach_ticket_pdf:true};
 const conn={query:async()=>[[{id:1,name:'Confirmation',active:1,config_json:JSON.stringify(config)}]]};
 const snapshot=await ticketEmails.snapshot({},conn);
 assert.equal(snapshot.personal,true);
 assert.equal(snapshot.template.config.attach_ticket_pdf,true);
});
