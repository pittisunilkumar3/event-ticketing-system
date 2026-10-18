import RegistrationFields,{visibleFields,fieldPlaceholder} from '../components/RegistrationFields';
import AttendeeAnswers from '../components/AttendeeAnswers';
import './checkoutAttendees.css';
export function attendeePayload(items,people,config) {
 const attachments=[];
 const bookedItems=items.map(item=>({ticket_type_id:item.id,qty:item.qty,form_version:item.type?.registrationForm?.version,attendees:Array.from({length:item.qty},(_,index)=>{
  const key=item.id+'_'+index,p=people[key]||{},answers=p.answers||{},files=p.files||{};
  const ownConfig=item.type?.registrationForm?.config??config;
  const fields=ownConfig?.enabled?visibleFields(ownConfig.fields,answers):[];
  fields.filter(f=>f.type==='file'&&files[f.id]).forEach(f=>attachments.push({name:'attendee_file_'+key+'_'+f.id,file:files[f.id]}));
  return {...(ownConfig?.attendee_mode==='fields'?{}:{name:(p.name||'').trim(),email:(p.email||'').trim(),phone:(p.phone||'').trim()}),registration_answers:Object.fromEntries(fields.filter(f=>!['file','section'].includes(f.type)&&answers[f.id]!==undefined).map(f=>[f.id,answers[f.id]]))};
 })}));
 return {items:bookedItems,attachments};
}
export default function CheckoutAttendees({items,people,onChange,config,contact,disabled,saved}) {
 if(!saved?.length&&items.every(item=>{const c=item.type?.registrationForm?.config??config;return c?.attendee_mode==='fields'&&(!c.enabled||!c.fields.length);}))return null;
 return <section className="checkout-attendees" aria-labelledby="attendees-heading">
  <div className="checkout-section-title"><span>02</span><div><h2 id="attendees-heading">Who is each ticket for?</h2><p>Complete the registration fields for each selected pass.</p></div></div>
  {saved?.length?saved.map(p=><article className="checkout-person" key={p.id}><h3>{p.name||`Attendee ${p.position+1}`}</h3><p>{p.type_name} · Ticket {p.position+1}</p>{p.email&&<p>{p.email}</p>}{p.phone&&<p>{p.phone}</p>}<AttendeeAnswers answers={p.answers}/></article>):items.flatMap((item,itemIndex)=>Array.from({length:item.qty},(_,index)=>{
   const key=item.id+'_'+index,p=people[key]||{},ticketConfig=item.type?.registrationForm?.config??config;
   if(ticketConfig?.attendee_mode==='fields'&&(!ticketConfig.enabled||!ticketConfig.fields.length))return null;
   return <fieldset className="checkout-person" key={key} disabled={disabled}>
    <legend>{item.type.name} <span>Attendee {index+1} of {item.qty}</span></legend>
    {ticketConfig?.attendee_mode!=='fields'&&itemIndex===0&&index===0&&<button type="button" className="attendee-copy" disabled={disabled||!contact.customer_name.trim()} onClick={()=>onChange(key,{...p,name:contact.customer_name,email:contact.email,phone:contact.phone})}>Use booking contact details</button>}
    {ticketConfig?.attendee_mode!=='fields'&&<div className="attendee-contact-fields">{[['name','Full name','text',150],['email','Email address','email',254],['phone','Phone number','tel',40]].map(([field,label,type,maxLength])=><label key={field} htmlFor={'person_'+key+'_'+field}>{label}<input id={'person_'+key+'_'+field} name={'person_'+key+'_'+field} type={type} placeholder={fieldPlaceholder({type,label,required:true})} autoComplete={'section-attendee'+key+' '+(field==='phone'?'tel':field)} required maxLength={maxLength} value={p[field]||''} onChange={e=>onChange(key,{...p,[field]:e.target.value})}/></label>)}</div>}
    {ticketConfig?.enabled&&ticketConfig.fields.length>0&&<div className="attendee-custom"><h3>{ticketConfig.title}</h3>{ticketConfig.description&&<p>{ticketConfig.description}</p>}{item.type?.guidelines_url&&<p><a href={item.type.guidelines_url} target="_blank" rel="noopener noreferrer">View / Download Challenge Guidelines ↗</a></p>}<RegistrationFields config={ticketConfig} idPrefix={'person_'+key+'_'} answers={p.answers||{}} files={p.files||{}} disabled={disabled} onChange={(field,value)=>onChange(key,{...p,answers:{...p.answers,[field]:value}})} onFile={(field,file)=>onChange(key,{...p,files:{...p.files,[field]:file}})}/></div>}
   </fieldset>;
  }))}
 </section>;
}
