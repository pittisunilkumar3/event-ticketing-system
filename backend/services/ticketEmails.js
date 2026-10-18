const db=require('../config/db');
const Studio=require('../models/Studio');
const forms=require('./registrationForms');
const {fail}=require('./studioValidation');
const QRCode=require('qrcode');
const personalPattern=/{{\s*(?:attendee_name|attendee_email|attendee_phone|ticket_type|ticket_code|registration_id|ticket|ticket_qr|ticket_pdf|registration_fields|field_f_[a-zA-Z0-9_-]+|submission_url|guidelines_url)\s*}}/;
// A PDF attachment can contain every ticket in a booking; it does not by itself
// require a second, attendee-specific email.
const needsPersonal = config => personalPattern.test(JSON.stringify(config||{}).replace(/{{\s*ticket_pdf\s*}}/g,''));
async function snapshot(type,conn=db){
 const [[defaultRow]]=await conn.query("SELECT * FROM design_templates WHERE kind='email' AND event_key='booking_confirmed'");
 const defaultTemplate=defaultRow?{id:defaultRow.id,name:defaultRow.name,active:!!defaultRow.active,config:JSON.parse(defaultRow.config_json)}:null;
 const assigned=type.email_template_id?await Studio.template(type.email_template_id,conn):null;
 const chosen=assigned?.active&&assigned.kind==='email'&&!assigned.event_key?assigned:defaultTemplate;
 return {template:chosen,default_template:defaultTemplate,personal:!!(assigned?.active&&assigned.kind==='email'&&!assigned.event_key)||needsPersonal(chosen?.config),submission_url:type.submission_url||'',guidelines_url:type.guidelines_url||''};
}
function answerText(a){return a.type==='file'?a.value?.name||'':Array.isArray(a.value)?a.value.join(', '):typeof a.value==='boolean'?(a.value?'Yes':'No'):String(a.value??'');}
function values(ticket,answers=[],snapshot={}){
 const result={attendee_name:ticket.attendee_name||'',attendee_email:ticket.attendee_email||'',attendee_phone:ticket.attendee_phone||'',ticket_type:ticket.type_name||'',ticket_code:ticket.ticket_code||'',registration_id:ticket.ticket_code||'',submission_url:snapshot.submission_url||'',guidelines_url:snapshot.guidelines_url||'',registration_answers:answers,ticket_id:ticket.id,ticket_status:ticket.status,ticket_price:ticket.price,ticket_design:ticket.design_snapshot?JSON.parse(ticket.design_snapshot):ticket.design};
 for(const a of answers)result['field_'+a.id]=answerText(a);
 return result;
}
async function qr(ticketCode,preview=false){
 if(!ticketCode)return {};
 const content=await QRCode.toBuffer(ticketCode,{type:'png',width:280,margin:4,errorCorrectionLevel:'M'});
 return {ticket_qr_src:preview?'data:image/png;base64,'+content.toString('base64'):'cid:ticket-qr@ticketflow',attachments:preview?[]:[{filename:'ticket-'+ticketCode+'.png',content,contentType:'image/png',cid:'ticket-qr@ticketflow',contentDisposition:'inline'}]};
}
async function context(typeId){
 const [[type]]=await db.query('SELECT t.*,e.title event_title,e.start_datetime event_date,e.venue,e.city FROM ticket_types t JOIN events e ON e.id=t.event_id WHERE t.id=?',[typeId]);
 if(!type)fail('Ticket type not found.',404);
 const {config}=await forms.ticket(type.event_id,type.id);
 return {type,fields:config.enabled?config.fields.filter(f=>f.type!=='section'):[]};
}
async function preview(typeId){
 const {type,fields}=await context(typeId);
 const answers=fields.map(f=>({id:f.id,label:f.label,type:f.type,value:f.type==='name'?'Alex Morgan':f.type==='email'?'alex@example.test':f.type==='tel'?'+91 9876543210':f.type==='checkboxes'?f.options.slice(0,1):['select','radio'].includes(f.type)?f.options[0]:f.type==='consent'?true:f.type==='file'?{name:'sample.pdf'}:'Sample '+f.label}));
 const selectedDesign=type.template_id?await Studio.template(type.template_id):null;
 const design={...(selectedDesign?.active&&selectedDesign.kind==='ticket'?selectedDesign.config:require('./studioDefaults').ticket),type_name:type.name,price:type.price,currency:'INR'};
 const ticket={design,attendee_name:'Alex Morgan',attendee_email:'alex@example.test',attendee_phone:'+91 9876543210',type_name:type.name,ticket_code:'TCK-PREVIEW-NOT-VALID'};
 return {...values(ticket,answers,type),event_title:type.event_title,event_date:type.event_date,venue:type.venue,city:type.city,...await qr(ticket.ticket_code,true)};
}
module.exports={snapshot,values,answerText,qr,context,preview,personalPattern,needsPersonal};
