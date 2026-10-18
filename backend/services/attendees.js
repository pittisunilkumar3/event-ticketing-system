const db=require('../config/db');
const {fail,string,emailAddress}=require('./studioValidation');
const forms=require('./registrationForms');
function validate(items,form,files=[]) {
 const usedFiles=new Set();
 const result=new Map();
 for(const item of items){
  const id=Number(item.ticket_type_id),qty=Number(item.qty);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(qty)||qty<1||!Array.isArray(item.attendees)||item.attendees.length!==qty)fail('Enter one attendee for every selected ticket.');
  if(result.has(id))fail('Select each ticket type once.');
  const ticketForm=form instanceof Map?form.get(id):form;
  if(!ticketForm)fail('Ticket type not found for this event.');
  const people=item.attendees.map((person,index)=>{
   if(!person||typeof person!=='object'||Array.isArray(person))fail('Enter valid attendee details.');
   const custom=ticketForm.config.attendee_mode==='fields';
   let name='',email='',phone='';
   if(!custom){
    name=string(person.name,`Attendee ${index+1} name`,150,true);
    email=emailAddress(person.email,true).toLowerCase();
    phone=string(person.phone,`${name}: phone number`,40,true);
    if(!/^\+?[0-9 ()\-.]{6,40}$/.test(phone)||phone.replace(/\D/g,'').length<6)fail(`${name}: enter a valid phone number.`);
   }
   const prefix=`attendee_file_${id}_${index}_`;
   const ownFiles=files.filter(file=>file.fieldname.startsWith(prefix)).map(file=>{usedFiles.add(file);return {...file,fieldname:'registration_file_'+file.fieldname.slice(prefix.length)};});
   let answers;
   try{answers=forms.answersFor(ticketForm.config,person.registration_answers,ownFiles);}catch(e){e.message=`${name||`Attendee ${index+1}`}: ${e.message}`;throw e;}
   if(custom){
    const value=type=>answers.find(a=>a.type===type&&a.value)?.value||'';
    name=string(value('name'),`Attendee ${index+1} name`,150)||`Attendee ${index+1}`;
    email=emailAddress(value('email')).toLowerCase();
    phone=string(value('tel'),'Phone number',40);
   }
   return {name,email,phone,position:index,answers,files:ownFiles};
  });
  result.set(id,people);
 }
 if(files.some(file=>!usedFiles.has(file)))fail('Unexpected attendee attachment.');
 return result;
}
async function save(conn,orderId,typeId,people,form){
 const saved=[];
 for(const p of people){
  const [row]=await conn.query('INSERT INTO order_attendees(order_id,ticket_type_id,position,name,email,phone,form_json,answers_json) VALUES (?,?,?,?,?,?,?,?)',[orderId,typeId,p.position,p.name,p.email,p.phone,form.config.enabled?JSON.stringify(form):null,form.config.enabled?JSON.stringify(p.answers):null]);
  for(const answer of p.answers.filter(a=>a.type==='file'&&a.value)){
   const file=p.files.find(f=>f.fieldname==='registration_file_'+answer.id);
   await conn.query('INSERT INTO attendee_registration_files(attendee_id,field_id,file_name,mime_type,file_data) VALUES (?,?,?,?,?)',[row.insertId,answer.id,answer.value.name,answer.value.mime,file.buffer]);
  }
  saved.push({...p,id:row.insertId});
 }
 return saved;
}
async function forOrder(orderId,conn=db){
 const [rows]=await conn.query('SELECT a.id,a.ticket_type_id,a.position,a.name,a.email,a.phone,a.answers_json,tt.name type_name FROM order_attendees a JOIN ticket_types tt ON tt.id=a.ticket_type_id WHERE a.order_id=? ORDER BY a.ticket_type_id,a.position',[orderId]);
 return rows.map(({answers_json,...row})=>({...row,answers:answers_json?JSON.parse(answers_json):[]}));
}
module.exports={validate,save,forOrder};
