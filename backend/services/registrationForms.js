const db=require('../config/db');
const {fail}=require('./studioValidation');
const types=['name','text','textarea','email','tel','number','date','time','url','select','radio','checkboxes','consent','file','section'];
const choiceTypes=['select','radio','checkboxes'];
const blank=()=>({title:'Registration details',description:'',enabled:false,attendee_mode:'fields',fields:[]});
function text(value,label,max=200,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(`Enter a valid ${label} (up to ${max} characters).`);return value.trim();}
function validate(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.fields)||input.fields.length>43)fail('Use up to 43 registration fields.');
 const out={title:text(input.title,'form title',120,true),description:text(input.description||'','description',1000),enabled:input.enabled===true,fields:[]};
 if(input.attendee_mode!==undefined&&input.attendee_mode!=='fields')fail('Choose a supported attendee form.');
 if(input.attendee_mode==='fields')out.attendee_mode='fields';
 const seen=new Map();
 for(const f of input.fields){
  if(!f||typeof f!=='object'||typeof f.id!=='string'||!/^f_[a-zA-Z0-9_-]{1,45}$/.test(f.id)||seen.has(f.id))fail('Each field needs a unique identifier.');
  if(!types.includes(f.type))fail('Choose a supported field type.');
  const field={id:f.id,type:f.type,label:text(f.label,'field label',180,true),help:text(f.help||'','help text',500),placeholder:text(f.placeholder||'','placeholder',180),required:f.type!=='section'&&f.required===true,width:[4,6,8,12].includes(Number(f.width))?Number(f.width):12,options:[],condition:null,min:null,max:null,maxLength:f.type==='textarea'?5000:500};
  if(choiceTypes.includes(f.type)){
   if(!Array.isArray(f.options)||f.options.length<2||f.options.length>50)fail(`Add 2–50 choices for “${field.label}”.`);
   field.options=f.options.map(o=>text(o,'choice',160,true));if(new Set(field.options).size!==field.options.length)fail(`Remove duplicate choices in “${field.label}”.`);
  }
  if(f.type==='number'){for(const k of ['min','max'])if(f[k]!==''&&f[k]!=null){if(!['number','string'].includes(typeof f[k])||!Number.isFinite(Number(f[k])))fail('Enter a valid numeric limit.');field[k]=Number(f[k]);}if(field.min!==null&&field.max!==null&&field.min>field.max)fail('Minimum cannot exceed maximum.');}
  if(['name','text','textarea','email','tel','url'].includes(f.type)&&f.maxLength!=null){if(!Number.isInteger(Number(f.maxLength))||f.maxLength<1||f.maxLength>(f.type==='textarea'?5000:500))fail('Choose a valid character limit.');field.maxLength=Number(f.maxLength);}
  if(out.attendee_mode==='fields'&&['name','email','tel'].includes(f.type))field.maxLength=Math.min(field.maxLength,{name:150,email:254,tel:40}[f.type]);
  if(f.condition?.field_id){const parent=seen.get(f.condition.field_id);if(!parent||!['select','radio','checkboxes','consent'].includes(parent.type))fail('Conditional questions must refer to an earlier choice or consent field.');const value=text(f.condition.value,'condition value',160,true);if(parent.type==='consent'?!['true','false'].includes(value):!parent.options.includes(value))fail('Choose an existing answer for the condition.');field.condition={field_id:parent.id,value};}
  seen.set(field.id,field);out.fields.push(field);
 }
 if(out.fields.filter(f=>f.type==='file').length>3)fail('Use up to 3 upload fields per form.');
 return out;
}
async function get(eventId,conn=db){const [[row]]=await conn.query('SELECT config_json,revision FROM event_registration_forms WHERE event_id=?',[eventId]);return {config:row?JSON.parse(row.config_json):blank(),revision:row?.revision||0};}
async function forTickets(eventId,conn=db){
 const fallback=await get(eventId,conn);
 const [rows]=await conn.query('SELECT t.id,r.config_json,r.revision FROM ticket_types t LEFT JOIN ticket_registration_forms r ON r.ticket_type_id=t.id WHERE t.event_id=?',[eventId]);
 return new Map(rows.map(row=>{const custom=row.config_json!==null;const revision=row.revision||0;return [row.id,{config:custom?JSON.parse(row.config_json):fallback.config,revision,source:custom?'ticket':'event',version:custom?`ticket:${revision}`:`event:${fallback.revision}:ticket:${revision}`}];}));
}
async function ticket(eventId,typeId,conn=db){const form=(await forTickets(eventId,conn)).get(Number(typeId));if(!form)fail('Ticket type not found for this event.',404);return form;}
async function saveTicket(eventId,typeId,input){
 if(typeof input.inherit!=='boolean')fail('Choose event questions or separate ticket questions.');
 const config=input.inherit?null:validate(input.config),conn=await db.getConnection();
 try{
  await conn.beginTransaction();
  const [[event]]=await conn.query('SELECT id,archived_at FROM events WHERE id=? FOR UPDATE',[eventId]);
  if(!event)fail('Event not found.',404);if(event.archived_at)fail('Restore the event before editing its form.',409);
  const [[type]]=await conn.query('SELECT id,archived_at FROM ticket_types WHERE id=? AND event_id=? FOR UPDATE',[typeId,eventId]);
  if(!type)fail('Ticket type not found for this event.',404);if(type.archived_at)fail('Archived ticket types cannot be edited.',409);
  const current=await ticket(eventId,typeId,conn);
  if(input.version!==current.version)fail('This registration form changed in another window. Reload before saving.',409);
  await conn.query('INSERT INTO ticket_registration_forms(ticket_type_id,config_json,revision) VALUES (?,?,?) ON DUPLICATE KEY UPDATE config_json=VALUES(config_json),revision=VALUES(revision)',[typeId,config?JSON.stringify(config):null,current.revision+1]);
  const result=await ticket(eventId,typeId,conn);await conn.commit();return result;
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
function checkVersions(items,ticketForms,eventForm,legacyRevision){
 for(const item of items){
  const form=ticketForms.get(Number(item.ticket_type_id));if(!form)fail('Ticket type not found for this event.');
  const legacy= item.form_version===undefined&&form.source==='event'&&form.revision===0;
  if(legacy?(eventForm.config.enabled||eventForm.config.attendee_mode==='fields')&&(legacyRevision??0)!==eventForm.revision:item.form_version!==form.version)fail('The registration form changed. Reload checkout and review your answers.',409);
 }
}
function visible(field,answers,shown){if(!field.condition)return true;const {field_id,value}=field.condition;if(!shown.has(field_id))return false;const answer=answers[field_id];return Array.isArray(answer)?answer.includes(value):String(answer??'')===value;}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
function fileInfo(file){
 const b=file.buffer;let mime='';
 if(b.subarray(0,5).toString()==='%PDF-')mime='application/pdf';
 else if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
 else if(b[0]===255&&b[1]===216&&b[2]===255)mime='image/jpeg';
 else if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')mime='image/webp';
 if(!mime||b.length>2*1024*1024)fail('Upload a PDF, PNG, JPEG or WebP file up to 2 MB.');
 const name=String(file.originalname||'attachment').replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,180);
 return {name,mime,size:b.length};
}
function answersFor(config,input={},files=[]){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid registration answers.');
 if(!config.enabled){if(files.length)fail('This event is not accepting uploads.');return [];}
 const fields=new Map(config.fields.map(f=>[f.id,f])),uploads=new Map();
 for(const key of Object.keys(input))if(!fields.has(key))fail('The registration form changed. Refresh the page and try again.',409);
 for(const file of files){const id=file.fieldname.replace(/^registration_file_/,'');if(file.fieldname!=='registration_file_'+id||fields.get(id)?.type!=='file'||uploads.has(id))fail('Unexpected registration attachment.');uploads.set(id,file);}
 const result=[],shown=new Set(),normalized={};
 for(const field of config.fields){
  if(!visible(field,normalized,shown)){if(uploads.has(field.id))fail('Remove attachments from hidden questions.');continue;}
  shown.add(field.id);if(field.type==='section')continue;
  let value=Object.hasOwn(input,field.id)?input[field.id]:undefined;
  const invalid=message=>fail(`${field.label}: ${message}`);
  if(field.type==='file'){const file=uploads.get(field.id);value=file?fileInfo(file):null;}
  else if(field.type==='consent'){if(value!=null&&typeof value!=='boolean')invalid('choose yes or no.');value=value===true;}
  else if(field.type==='checkboxes'){if(value==null)value=[];if(!Array.isArray(value)||value.length>50||value.some(v=>typeof v!=='string'||!field.options.includes(v))||new Set(value).size!==value.length)invalid('choose valid options.');}
  else {if(value==null)value='';if(!['string','number'].includes(typeof value))invalid('enter a valid answer.');value=String(value).trim();if(value.length>field.maxLength)invalid(`use up to ${field.maxLength} characters.`);}
  const empty=value==null||value===''||value===false||(Array.isArray(value)&&!value.length);
  if(field.required&&empty)invalid(field.type==='consent'?'confirmation is required.':'this field is required.');
  if(!empty){
   if(choiceTypes.includes(field.type)&&field.type!=='checkboxes'&&!field.options.includes(value))invalid('choose a valid option.');
   if(field.type==='email'&&!/^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(value))invalid('enter a valid email address.');
   if(field.type==='tel'&&(!/^\+?[0-9 ()\-.]{6,40}$/.test(value)||value.replace(/\D/g,'').length<6))invalid('enter a valid phone number.');
   if(field.type==='url'){try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error();}catch{invalid('enter a complete HTTP or HTTPS URL.');}}
   if(field.type==='date'&&!validDate(value))invalid('enter a valid date.');
   if(field.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))invalid('enter a valid time.');
   if(field.type==='number'){if(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)||!Number.isFinite(Number(value)))invalid('enter a number.');value=Number(value);if((field.min!==null&&value<field.min)||(field.max!==null&&value>field.max))invalid('the number is outside the allowed range.');}
  }
  normalized[field.id]=value;result.push({id:field.id,label:field.label,type:field.type,value});
 }
 return result;
}
async function save(eventId,input){
 const config=validate(input.config),conn=await db.getConnection();
 try{await conn.beginTransaction();const [[event]]=await conn.query('SELECT id,archived_at FROM events WHERE id=? FOR UPDATE',[eventId]);if(!event)fail('Event not found.',404);if(event.archived_at)fail('Restore the event before editing its form.',409);const current=await get(eventId,conn);if(input.revision!==current.revision)fail('This form changed in another window. Reload before saving.',409);await conn.query('INSERT INTO event_registration_forms(event_id,config_json,revision) VALUES (?,?,?) ON DUPLICATE KEY UPDATE config_json=VALUES(config_json),revision=VALUES(revision)',[eventId,JSON.stringify(config),current.revision+1]);await conn.commit();return {config,revision:current.revision+1};}catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function snapshot(conn,orderId,form,answers,files){
 if(!form.config.enabled)return;
 await conn.query('INSERT INTO order_registration_answers(order_id,form_json,answers_json) VALUES (?,?,?)',[orderId,JSON.stringify(form),JSON.stringify(answers)]);
 for(const answer of answers.filter(a=>a.type==='file'&&a.value)){const file=files.find(f=>f.fieldname==='registration_file_'+answer.id);await conn.query('INSERT INTO registration_answer_files(order_id,field_id,file_name,mime_type,file_data) VALUES (?,?,?,?,?)',[orderId,answer.id,answer.value.name,answer.value.mime,file.buffer]);}
}
async function forOrder(id){const [[row]]=await db.query('SELECT form_json,answers_json FROM order_registration_answers WHERE order_id=?',[id]);return row?{form:JSON.parse(row.form_json),answers:JSON.parse(row.answers_json)}:null;}
module.exports={types,blank,validate,get,forTickets,ticket,saveTicket,checkVersions,visible,answersFor,save,snapshot,forOrder};
