import RegistrationFields,{visibleFields,fieldPlaceholder} from '../components/RegistrationFields';
import AttendeeAnswers from '../components/AttendeeAnswers';
import UdyamField from '../components/UdyamField';
import {certificateError} from './useUdyam';
import './checkoutAttendees.css';
function registrationConfig(config,udyamEnabled) {
 return udyamEnabled&&config?.fields?{...config,fields:config.fields.filter(f=>f.id!=='f_udyam_number')}:config;
}
function udyamRequired(config,answers={}) {
 return Boolean(config?.enabled&&visibleFields(config.fields||[],answers).some(f=>f.id==='f_udyam_number'&&f.required));
}
export function attendeePayload(items,people,config,udyamRecords={},udyamEnabled=false,udyamPolicy={},student=null,couponApplied=false) {
 const attachments=[];
 const bookedItems=items.map(item=>({ticket_type_id:item.id,qty:item.qty,form_version:item.type?.registrationForm?.version,attendees:Array.from({length:item.qty},(_,index)=>{
  const key=item.id+'_'+index,p=people[key]||{},answers=p.answers||{},files=p.files||{};
  const originalConfig=item.type?.registrationForm?.config??config;
  const ownConfig=registrationConfig(originalConfig,udyamEnabled||couponApplied);
  const fields=ownConfig?.enabled?visibleFields(ownConfig.fields,answers):[];
  fields.filter(f=>f.type==='file'&&files[f.id]).forEach(f=>attachments.push({name:'attendee_file_'+key+'_'+f.id,file:files[f.id]}));
  const allowUdyam=!couponApplied&&udyamEnabled&&Boolean(originalConfig?.fields?.some(f=>f.id==='f_udyam_number'));
  const udyam=allowUdyam?udyamRecords[key]:undefined;
  const required=allowUdyam&&udyamRequired(originalConfig,answers);
  if(required&&!udyam?.number?.trim())throw new Error(`${item.type.name} · Attendee ${index+1}: Enter your Udyam Registration Number.`);
  if(udyamEnabled&&udyamPolicy.certificate_required&&udyam?.number){
   const error=certificateError(udyam.certificate);
   if(error)throw new Error(`${item.type.name} · Attendee ${index+1}: ${error}`);
   attachments.push({name:'attendee_file_'+key+'_f_udyam_certificate',file:udyam.certificate});
  }
  const studentPass=student?.eligible?.has(item.id);
  const collegeName=String(p.college_name||'').trim(),studentId=String(p.student_id||'').trim();
  if(studentPass&&(!collegeName||!studentId))throw new Error(`${item.type.name} · Attendee ${index+1}: Enter your college name and student ID.`);
  const registrationAnswers=Object.fromEntries(fields.filter(f=>!['file','section'].includes(f.type)&&answers[f.id]!==undefined).map(f=>[f.id,answers[f.id]]));
  // Retain required questions in the payload so server-side form validation
  // enforces the pass requirement as well as the separate discount checks.
  if(required)registrationAnswers.f_udyam_number=udyam.number;
  return {...(studentPass?{college_name:collegeName,student_id:studentId}:{}),...(udyam?.number?{udyam_number:udyam.number}:{}),...(ownConfig?.attendee_mode==='fields'?{}:{name:(p.name||'').trim(),email:(p.email||'').trim(),phone:(p.phone||'').trim()}),registration_answers:registrationAnswers};
 })}));
 return {items:bookedItems,attachments};
}
export default function CheckoutAttendees({items,people,onChange,config,disabled,saved,udyam,couponApplied=false,student=null}) {
 if(!udyam?.enabled&&!saved?.length&&items.every(item=>{const c=item.type?.registrationForm?.config??config;return !student?.eligible?.has(item.id)&&c?.attendee_mode==='fields'&&(!c.enabled||!c.fields.length);}))return null;
 return <section className="checkout-attendees" aria-labelledby="attendees-heading">
  <div className="checkout-section-title"><span>01</span><div><h2 id="attendees-heading">Who is each ticket for?</h2><p>Complete the registration fields for each selected pass.</p></div></div>
  {saved?.length?saved.map(p=><article className="checkout-person" key={p.id}><h3>{p.name||`Attendee ${p.position+1}`}</h3><p>{p.type_name} · Ticket {p.position+1}</p>{p.email&&<p>{p.email}</p>}{p.phone&&<p>{p.phone}</p>}<AttendeeAnswers answers={p.answers}/></article>):items.flatMap(item=>Array.from({length:item.qty},(_,index)=>{
   const key=item.id+'_'+index,p=people[key]||{},ticketConfig=registrationConfig(item.type?.registrationForm?.config??config,udyam?.enabled||couponApplied);
   if(!udyam?.enabled&&ticketConfig?.attendee_mode==='fields'&&(!ticketConfig.enabled||!ticketConfig.fields.length)&&!student?.eligible?.has(item.id))return null;
   return <fieldset className="checkout-person" key={key} disabled={disabled}>
    <legend>{item.type.name} <span>Attendee {index+1} of {item.qty}</span></legend>

    {ticketConfig?.attendee_mode!=='fields'&&<div className="attendee-contact-fields">{[['name','Full name','text',150],['email','Email address','email',254],['phone','Phone number','tel',40]].map(([field,label,type,maxLength])=><label key={field} htmlFor={'person_'+key+'_'+field}>{label}<input id={'person_'+key+'_'+field} name={'person_'+key+'_'+field} type={type} placeholder={fieldPlaceholder({type,label,required:true})} autoComplete={'section-attendee'+key+' '+(field==='phone'?'tel':field)} required maxLength={maxLength} value={p[field]||''} onChange={e=>onChange(key,{...p,[field]:e.target.value})}/></label>)}</div>}
    {ticketConfig?.enabled&&ticketConfig.fields.length>0&&<div className="attendee-custom"><h3>{ticketConfig.title}</h3>{ticketConfig.description&&<p>{ticketConfig.description}</p>}{item.type?.guidelines_url&&<p><a href={item.type.guidelines_url} target="_blank" rel="noopener noreferrer">View / Download Challenge Guidelines ↗</a></p>}<RegistrationFields config={ticketConfig} idPrefix={'person_'+key+'_'} answers={p.answers||{}} files={p.files||{}} disabled={disabled} onChange={(field,value)=>onChange(key,{...p,answers:{...p.answers,[field]:value}})} onFile={(field,file)=>onChange(key,{...p,files:{...p.files,[field]:file}})}/></div>}
    {student?.eligible?.has(item.id)&&<div className="attendee-custom"><h3>Student discount details</h3><p>Required for this discounted pass. Each student ID can be used only once for this event.</p><div className="attendee-contact-fields">{[['college_name','College name','text',150],['student_id','Student ID','text',40]].map(([field,label,type,maxLength])=><label key={field} htmlFor={'person_'+key+'_'+field}>{label} <span>(required)</span><input id={'person_'+key+'_'+field} name={'person_'+key+'_'+field} type={type} placeholder={fieldPlaceholder({type,label,required:true})} autoComplete="off" required pattern={'.*\\S.*'} minLength={field==='student_id'?2:undefined} maxLength={maxLength} value={p[field]||''} onChange={e=>onChange(key,{...p,[field]:e.target.value})}/></label>)}</div></div>}
    {udyam?.enabled&&Number(item.type.price)>0&&(item.type?.registrationForm?.config??config)?.fields?.some(f=>f.id==='f_udyam_number')&&<UdyamField id={'person_'+key+'_udyam'} value={udyam.records[key]} disabled={disabled} couponApplied={couponApplied} onChange={number=>udyam.change(key,number)} onUpload={file=>udyam.upload(key,file)} policy={udyam.policy} discountMinor={item.type.udyam_discount_minor} ticketPrice={item.type.price} required={udyamRequired(item.type?.registrationForm?.config??config,p.answers||{})}/>}
   </fieldset>;
  }))}
 </section>;
}
