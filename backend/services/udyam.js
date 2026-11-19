const db = require('../config/db');
const money = require('./eventWallet');
const {fail} = require('./studioValidation');
const defaults = {enabled:false,mode:'manual',per_ticket_minor:10000,placeholder:'UDYAM-TS-09-02.......',certificate_required:false,revision:0};
const key = id => 'udyam_discount:'+Number(id);

function normalize(value) {
  if (typeof value !== 'string' || !/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(value.trim().toUpperCase())) {
    fail('Enter a Udyam number in the format UDYAM-TS-09-0216688.');
  }
  return value.trim().toUpperCase();
}
async function publicConfig(eventId,conn=db) {
  const [[row]]=await conn.query('SELECT value_json FROM system_settings WHERE setting_key=?',[key(eventId)]);
  const value=row?JSON.parse(row.value_json):defaults;
  return {enabled:value.enabled===true,mode:'manual',per_ticket_minor:value.per_ticket_minor,placeholder:value.placeholder,certificate_required:value.certificate_required===true,revision:value.revision};
}
async function settings(eventId) {
  if(!await require('../models/Event').findById(eventId))fail('Event not found.',404);
  return publicConfig(eventId);
}
async function saveSettings(eventId,input,adminId) {
  if(typeof input.enabled!=='boolean'||input.mode!=='manual')fail('Choose the manual Udyam discount setting.');
  if(!Number.isSafeInteger(input.per_ticket_minor)||input.per_ticket_minor<100||input.per_ticket_minor>10000000)fail('Enter a discount between ₹1 and ₹100,000.');
  if(typeof input.placeholder!=='string'||!input.placeholder.trim()||input.placeholder.length>180)fail('Enter a hint up to 180 characters.');
  if(input.certificate_required!==undefined&&typeof input.certificate_required!=='boolean')fail('Choose whether an Udyam certificate is required.');
  const conn=await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[event]]=await conn.query('SELECT id,archived_at FROM events WHERE id=? FOR UPDATE',[eventId]);
    if(!event)fail('Event not found.',404);if(event.archived_at)fail('Restore the event before changing its discount.',409);
    const current=await publicConfig(eventId,conn);
    if(input.revision!==current.revision)fail('Udyam settings changed in another window. Reload before saving.',409);
    const value={enabled:input.enabled,mode:'manual',per_ticket_minor:input.per_ticket_minor,placeholder:input.placeholder.trim(),certificate_required:input.certificate_required??current.certificate_required,revision:current.revision+1,updated_by:adminId,updated_at:new Date().toISOString()};
    await conn.query('INSERT INTO system_settings(setting_key,value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)',[key(eventId),JSON.stringify(value)]);
    // Keep the ordinary optional collection field's hint consistent when the offer is off.
    const [forms]=await conn.query('SELECT r.ticket_type_id,r.config_json FROM ticket_registration_forms r JOIN ticket_types t ON t.id=r.ticket_type_id WHERE t.event_id=? AND r.config_json IS NOT NULL',[eventId]);
    const [[eventForm]]=await conn.query('SELECT config_json FROM event_registration_forms WHERE event_id=?',[eventId]);
    if(eventForm)forms.push({...eventForm,event_default:true});
    for(const row of forms){
      const config=JSON.parse(row.config_json),field=config.fields?.find(f=>f.id==='f_udyam_number');
      if(!field||field.placeholder===value.placeholder)continue;
      field.placeholder=value.placeholder;
      await conn.query(row.event_default?'UPDATE event_registration_forms SET config_json=?,revision=revision+1 WHERE event_id=?':'UPDATE ticket_registration_forms SET config_json=?,revision=revision+1 WHERE ticket_type_id=?',[JSON.stringify(config),row.event_default?eventId:row.ticket_type_id]);
    }
    await conn.commit();return {enabled:value.enabled,mode:value.mode,per_ticket_minor:value.per_ticket_minor,placeholder:value.placeholder,certificate_required:value.certificate_required,revision:value.revision};
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
const entered = person => {const direct=person?.udyam_number;return direct!=null&&!(typeof direct==='string'&&!direct.trim())?direct:person?.registration_answers?.f_udyam_number;};
const hasNumber = person => {const value=entered(person);return value!=null&&value!==''&&(typeof value!=='string'||value.trim()!=='');};
function attendeeForm(form,person,policy) {
  if(!policy?.enabled||!policy.certificate_required||!hasNumber(person))return form;
  normalize(entered(person));
  const certificate={id:'f_udyam_certificate',type:'file',label:'Udyam certificate',required:true,condition:null};
  const fields=form.config.enabled?form.config.fields.filter(f=>f.id!==certificate.id):[];
  return {...form,config:{...form.config,enabled:true,fields:[...fields,certificate]}};
}
function numbersFor(input,items) {
  const entries=[],seen=new Set();
  for(const {ticketType,qty} of items){
    const people=(input.items||[]).find(i=>Number(i.ticket_type_id)===ticketType.id)?.attendees||[];
    if(!Array.isArray(people)||(people.some(hasNumber)&&people.length!==qty))fail('Enter one Udyam field for each selected attendee.');
    people.forEach((person,position)=>{
      if(!hasNumber(person))return;
      const number=normalize(entered(person));
      const answer=person?.registration_answers?.f_udyam_number;
      if(person?.udyam_number&&answer&&normalize(answer)!==number)fail('Enter the same Udyam number for this attendee.');
      if(seen.has(number))fail('Each Udyam number can be used for only one ticket for this event. Remove the duplicate number.',409);
      seen.add(number);entries.push({ticket_type_id:ticketType.id,position,number});
    });
  }
  return entries;
}
async function checkAvailable(conn,input,items,options={}) {
  const entries=numbersFor(input,items);if(!entries.length)return;
  const [used]=await conn.query('SELECT r.udyam_number,o.checkout_request_hash FROM event_udyam_registrations r JOIN orders o ON o.id=r.order_id WHERE r.event_id=? AND r.udyam_number IN (?)',[input.event_id,entries.map(e=>e.number)]);
  // Concurrent retries of one checkout must reach the existing order's unique
  // request hash. They still cannot create a second registration or payment.
  const hash=options.lock&&typeof input.request_key==='string'&&/^[a-zA-Z0-9-]{32,80}$/.test(input.request_key)?require('node:crypto').createHash('sha256').update(input.request_key).digest('hex'):null;
  if(used.some(row=>!hash||row.checkout_request_hash!==hash))fail('This Udyam number has already been used for this event. Use a different number or clear it to continue without the discount.',409);
}
async function reserve(conn,eventId,orderId,entries) {
  for(const entry of entries){
    try{
      await conn.query('INSERT INTO event_udyam_registrations(event_id,udyam_number,order_id,ticket_type_id,attendee_position) VALUES (?,?,?,?,?)',[eventId,entry.number,orderId,entry.ticket_type_id,entry.position]);
    }catch(e){if(e.code==='ER_DUP_ENTRY')fail('This Udyam number has already been used for this event. Use a different number or clear it to continue without the discount.',409);throw e;}
  }
}
function calculate(input,items,policy=defaults) {
  const entries=numbersFor(input,items);
  const requested=input.items||[];
  if(!policy.enabled){
    if(requested.some(i=>Array.isArray(i.attendees)&&i.attendees.some(p=>p?.udyam_number)))fail('The Udyam offer is off. Reload checkout to see current prices.',409);
    return null;
  }
  if(!entries.length)return null;
  if(input.coupon_code)fail('Use either a coupon or the Udyam discount.');
  const accepted=[];
  const lines=items.map(({ticketType,qty})=>{
    const people=requested.find(i=>Number(i.ticket_type_id)===ticketType.id)?.attendees||[];
    if(!Array.isArray(people)||(people.some(hasNumber)&&people.length!==qty))fail('Enter one Udyam field for each selected attendee.');
    const unit=money.minorUnits(ticketType.price),overrideRaw=ticketType.udyam_discount_minor,offerMinor=(overrideRaw===null||overrideRaw===undefined)?policy.per_ticket_minor:Number(overrideRaw),discountPerTicket=Math.min(unit,offerMinor);
    let count=0;
    people.forEach((person,position)=>{
      if(!hasNumber(person))return;
      const number=normalize(entered(person));
      if(!discountPerTicket)return;
      count++;
      accepted.push({ticket_type_id:ticketType.id,position,number,mode:'manual',discount_minor:discountPerTicket});
    });
    const subtotal=unit*qty,discount=count*discountPerTicket;
    return {ticket_type_id:ticketType.id,eligible:count>0,accepted_count:count,subtotal_minor:subtotal,discount_minor:discount,total_minor:subtotal-discount};
  });
  const subtotal=lines.reduce((s,l)=>s+l.subtotal_minor,0),discount=lines.reduce((s,l)=>s+l.discount_minor,0);
  money.decimal(subtotal);
  return {subtotal_minor:subtotal,discount_minor:discount,total_minor:subtotal-discount,coupon:null,breakdown:{scope:'attendees',eligible_subtotal_minor:lines.reduce((s,l)=>s+l.accepted_count*money.minorUnits(items.find(i=>i.ticketType.id===l.ticket_type_id).ticketType.price),0),lines,udyam:{mode:'manual',policy_revision:policy.revision,per_ticket_minor:policy.per_ticket_minor,accepted_count:accepted.length,attendees:accepted}}};
}
function saveAnswers(attendees,quote) {
  for(const accepted of quote.breakdown?.udyam?.attendees||[]){
    const person=attendees?.get(accepted.ticket_type_id)?.[accepted.position];
    if(!person)fail('Enter attendee details for the discounted ticket.');
    person.answers=person.answers.filter(a=>a.id!=='f_udyam_number');
    person.answers.push({id:'f_udyam_number',type:'text',label:'Udyam number (self-declared)',value:accepted.number});
  }
}
module.exports={normalize,publicConfig,settings,saveSettings,numbersFor,checkAvailable,reserve,calculate,saveAnswers,attendeeForm};
