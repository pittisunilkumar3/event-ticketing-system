import {useEffect,useRef,useState} from 'react';
import api from '../api/client';
import Icon from '../components/Icon';
import TicketDesignPreview from './TicketDesignPreview';
import TicketDesignGallery from './TicketDesignGallery';
import './ticketTypeModal.css';

export default function TicketModal({values,eventId,event,onClose,onSave}) {
 const [form,setForm]=useState(values),[designs,setDesigns]=useState([]),[defaultDesign,setDefaultDesign]=useState(null),[designError,setDesignError]=useState(''),[designLoading,setDesignLoading]=useState(true),[attempt,setAttempt]=useState(0);
 const [emailTemplates,setEmailTemplates]=useState([]),[emailError,setEmailError]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[choosing,setChoosing]=useState(false);
 const [advanced,setAdvanced]=useState(Boolean(values.sales_start||values.sales_end||Number(values.min_per_order)!==1||Number(values.max_per_order)!==10||Number(values.sort_order)));
 const dialog=useRef(null),nameInput=useRef(null),designToggle=useRef(null),wasChoosing=useRef(false);
 useEffect(()=>{if(wasChoosing.current&&!choosing)designToggle.current?.focus();wasChoosing.current=choosing;},[choosing]);
 useEffect(()=>{
  const controller=new AbortController();
  api.get('/admin/ticket-types/designs',{signal:controller.signal}).then(({data})=>{if(!controller.signal.aborted){setDesigns(data.data.templates);setDefaultDesign(data.data.defaultDesign);}}).catch(()=>{if(!controller.signal.aborted)setDesignError('Unable to load ticket designs.');}).finally(()=>{if(!controller.signal.aborted)setDesignLoading(false);});
  api.get('/admin/ticket-types/email-templates',{signal:controller.signal}).then(({data})=>setEmailTemplates(data.data.templates)).catch(()=>{if(!controller.signal.aborted)setEmailError('Unable to load email templates. Close and reopen this editor to retry.');});
  return()=>controller.abort();
 },[attempt]);
 useEffect(()=>{const previous=document.activeElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';nameInput.current?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
 function onKeyDown(e){
  if(choosing&&e.key==='Enter'&&e.target.type==='search')e.preventDefault();
  if(e.key==='Escape'){e.preventDefault();if(!busy){if(choosing)setChoosing(false);else onClose();}}
  if(e.key==='Tab'){const controls=[...dialog.current.querySelectorAll('input,textarea,select,button,a[href],summary')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }
 const change=(key,value)=>setForm(previous=>({...previous,[key]:value}));
 const field=(key,label,props={})=><label className="ea-field">{label}<input name={key} value={form[key]??''} onChange={e=>change(key,e.target.value)} {...props}/></label>;
 const selected=designs.find(t=>String(t.id)===String(form.template_id));
 const previewDesign=form.template_id?selected?.config:defaultDesign;
 async function save(e){
  e.preventDefault();if(busy||choosing)return;setError('');
  if(Number(form.min_per_order)>Number(form.max_per_order)){setAdvanced(true);setError('Maximum per booking must be at least the minimum.');return;}
  if(form.sales_start&&form.sales_end&&new Date(form.sales_end)<=new Date(form.sales_start)){setAdvanced(true);setError('Sales close must be after sales open.');return;}
  setBusy(true);
  const payload={...form,event_id:Number(eventId),price:Number(form.price),quantity:Number(form.quantity),min_per_order:Number(form.min_per_order),max_per_order:Number(form.max_per_order),sort_order:Number(form.sort_order),template_id:form.template_id?Number(form.template_id):null,email_template_id:form.email_template_id?Number(form.email_template_id):null,sales_start:form.sales_start||null,sales_end:form.sales_end||null};
  delete payload.submission_url;
  delete payload.guidelines_url;
  try{await api[form.id?'put':'post']('/admin/ticket-types'+(form.id?'/'+form.id:''),payload);onSave();}catch(e){setError(e.response?.data?.message||'Unable to save ticket type.');setBusy(false);}
 }
 return <div className="ea-modal-backdrop"><form ref={dialog} className={`ea-modal ea-ticket-modal ticket-type-editor ${choosing?'is-choosing-design':''}`} onSubmit={save} onKeyDown={onKeyDown} onInvalidCapture={e=>{if(e.target.closest('details'))setAdvanced(true);}} role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title" aria-describedby="ticket-modal-description">
  <header className="ticket-editor-header"><div><span className="ea-eyebrow">TICKETS & PRICING</span><h2 id="ticket-modal-title">{choosing?'Choose ticket design':form.id?'Edit ticket type':'Add ticket type'}</h2><p id="ticket-modal-description">{choosing?'Preview your ticket and click a design to select it.':'Set the price and number of tickets available.'}</p></div><button type="button" className="ticket-editor-close" aria-label="Close ticket editor" disabled={busy} onClick={onClose}>✕</button></header>
  <div className="ticket-editor-body">
   {error&&<div className="ea-alert" role="alert">{error}</div>}
   <fieldset disabled={busy} className="ticket-editor-fields">
    <div className="ticket-editor-basics" hidden={choosing}>
    {field('name','Ticket name',{ref:nameInput,required:true,maxLength:100,placeholder:'e.g. General Admission'})}
    <div className="ea-two"><div>{field('price','Price per ticket (INR)',{type:'number',min:0,max:99999999.99,step:'.01',required:true,placeholder:'0.00', 'aria-describedby':'ticket-price-help'})}<p className="ticket-field-hint" id="ticket-price-help">Enter 0 for a free ticket.</p></div><div>{field('quantity','Total tickets',{type:'number',min:Math.max(1,values.sold||0),max:1000000,step:1,required:true,placeholder:'e.g. 100'})}{Number(values.sold)>0&&<p className="ticket-field-hint">{values.sold} already sold. Includes sold tickets.</p>}</div></div>
    <label className="ea-field">What’s included? <span className="ticket-optional">Optional</span><textarea name="description" rows={2} maxLength={255} value={form.description||''} onChange={e=>change('description',e.target.value)} placeholder="e.g. Entry to all sessions and a welcome drink"/></label>
    </div>
    <section className="ticket-design-choice" aria-label="Ticket design"><div className="ticket-design-selected"><Icon name="ticket" size={22}/><div><span>Ticket design</span><strong aria-live="polite">{form.template_id?selected?.name||'Previously assigned design':'Default ticket design'}</strong></div><button ref={designToggle} type="button" className="ea-button" aria-expanded={choosing} aria-controls="ticket-design-picker" onClick={()=>setChoosing(v=>!v)}>{choosing?'Done':'Change'}</button></div>
     {designLoading?<p className="ticket-design-message" role="status">Loading designs…</p>:designError?<div className="ticket-design-message" role="alert">{designError} <button type="button" className="ea-text" onClick={()=>{setDesignLoading(true);setDesignError('');setAttempt(n=>n+1);}}>Try again</button></div>:choosing?<TicketDesignGallery designs={designs} defaultDesign={defaultDesign} selectedId={form.template_id} onSelect={id=>change('template_id',id)} event={event} name={form.name} price={form.price}/>:previewDesign?<TicketDesignPreview design={previewDesign} category={selected?.category} event={event} name={form.name} price={form.price}/>:<p className="ticket-design-message">The assigned design is unavailable. Choose an active design to preview it.</p>}
    </section>
    <div className="ticket-editor-basics" hidden={choosing}>
    <label className="ea-field">Ticket email template<select value={form.email_template_id||''} onChange={e=>change('email_template_id',e.target.value)}><option value="">Default ticket email (Booking confirmed)</option>{emailTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}{form.email_template_id&&!emailTemplates.some(t=>String(t.id)===String(form.email_template_id))&&<option value={form.email_template_id}>Assigned template unavailable — choose another</option>}</select></label>
    {emailError&&<p role="alert" className="ticket-field-hint">{emailError}</p>}
    <details className="ticket-advanced" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}><summary>Booking limits & sales schedule</summary><div className="ticket-advanced-fields"><div className="ea-two">{field('min_per_order','Minimum per booking',{type:'number',min:1,max:100,required:true})}{field('max_per_order','Maximum per booking',{type:'number',min:form.min_per_order,max:100,required:true})}</div><div className="ea-two">{field('sales_start','Sales open',{type:'datetime-local'})}{field('sales_end','Sales close',{type:'datetime-local'})}</div><p className="ticket-field-hint">Leave dates empty to use the event’s availability.</p>{field('sort_order','Display order',{type:'number',min:-10000,max:10000})}</div></details>
    <label className="ea-checkbox"><input type="checkbox" checked={form.is_active} onChange={e=>change('is_active',e.target.checked)}/><span><strong>Available for booking</strong><small>Sales start when the event is published and the sales window is open.</small></span></label>
    </div>
   </fieldset>
  </div>
  <footer className="ea-actions ticket-editor-footer"><button type="button" className="ea-button" disabled={busy} onClick={onClose}>Cancel</button><button key={choosing?'design-done':'save-ticket'} type={choosing?'button':'submit'} onClick={choosing?()=>setChoosing(false):undefined} className="ea-button primary" disabled={busy}>{choosing?'Use selected design':busy?'Saving…':form.id?'Save changes':'Add ticket type'}<Icon name="check" size={16}/></button></footer>
 </form></div>;
}
