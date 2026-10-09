import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { socialNetworks, templateSocialMode } from '../../utils/social';
import { Field, Toggle, ImageField, RichEditor, Notice, Icon, errorText, useUnsaved } from './StudioUI';

const formats=['Logo · message · banner · button','Logo · message · button','Message · button · highlighted section','Icon · booking code · button','Icon · message · link','Icon · booking summary table','Logo · message · banner (no button)','Banner first · logo · message','Message · highlighted section · order info','Icon · banner · booking code · extra message','Centered icon · message · button'];
export default function EmailDesigner({data,onUpdate}) {
  const [selected,setSelected]=useState(data.emailTemplates[0]);
  const [saved,setSaved]=useState(JSON.stringify(selected));
  const [category,setCategory]=useState('automated');
  const [preview,setPreview]=useState(null);
  const [previewError,setPreviewError]=useState('');
  const [previewBusy,setPreviewBusy]=useState(false);
  const [message,setMessage]=useState(null);
  const [saving,setSaving]=useState(false);
  const [testOpen,setTestOpen]=useState(false);
  const [recipient,setRecipient]=useState('');
  const [sending,setSending]=useState(false);
  const editorRef=useRef(null);
  const config=selected.config;
  const allowChange=useUnsaved(JSON.stringify(selected)!==saved);
  const update=(key,value)=>setSelected(s=>({...s,config:{...s.config,[key]:value}}));
  function select(template){if(!allowChange())return;setSelected(structuredClone(template));setSaved(JSON.stringify(template));setMessage(null);}
  function newTemplate(){if(!allowChange())return;const t={kind:'email',name:'My custom email',active:true,config:{...data.defaults.email}};setSelected(t);setSaved(JSON.stringify(t));setCategory('custom');setMessage(null);}
  function changeCategory(value){if(!allowChange())return;setCategory(value);const t=data.emailTemplates.find(t=>value==='automated'?t.event_key:!t.event_key);if(t){setSelected(structuredClone(t));setSaved(JSON.stringify(t));}else{const draft={kind:'email',name:'My custom email',active:true,config:{...data.defaults.email}};setSelected(draft);setSaved(JSON.stringify(draft));}setMessage(null);}
  useEffect(()=>{
    const controller=new AbortController(); setPreviewBusy(true);
    const timer=setTimeout(async()=>{try{const {data:r}=await api.post('/admin/studio/email-preview',{config},{signal:controller.signal});setPreview(r.data);setPreviewError('');}catch(err){if(!controller.signal.aborted)setPreviewError(errorText(err));}finally{if(!controller.signal.aborted)setPreviewBusy(false);}},400);
    return()=>{clearTimeout(timer);controller.abort();};
  },[config]);
  async function save(e){e.preventDefault();setSaving(true);setMessage(null);try{const {data:r}=await api[selected.id?'put':'post'](`/admin/studio/templates${selected.id?'/'+selected.id:''}`,selected);setSelected(r.data.template);setSaved(JSON.stringify(r.data.template));onUpdate(r.data.template);setMessage({type:'success',text:'Email template saved.'});}catch(err){setMessage({text:errorText(err)});}finally{setSaving(false);}}
  async function sendTest(e){e.preventDefault();setSending(true);setMessage(null);try{const {data:r}=await api.post('/admin/studio/email-test',{recipient,config});setTestOpen(false);setMessage({type:'success',text:r.message});}catch(err){setMessage({text:errorText(err)});}finally{setSending(false);}}
  return <><div className="studio-heading"><div><span className="studio-eyebrow">DESIGN STUDIO / EMAILS</span><h1>A better first impression.</h1><p>Your words. Your brand. Every message, thoughtfully designed.</p></div><button className="studio-button secondary" onClick={newTemplate}><Icon name="plus"/>Create template</button></div><Notice message={message}/>
    <div className="studio-panel studio-email-panel"><div className="studio-panel-title"><div><Icon name="mail"/><h2>Email templates</h2></div><select aria-label="Template category" value={category} onChange={e=>changeCategory(e.target.value)}><option value="automated">Booking notifications</option><option value="custom">My custom templates</option></select></div>
    <div className="studio-tabs">{data.emailTemplates.filter(t=>category==='automated'?t.event_key:!t.event_key).map(t=><button key={t.id} className={selected.id===t.id?'active':''} onClick={()=>select(t)}><span className={t.active?'studio-live-dot':'studio-muted-dot'}/>{t.name}</button>)}{!selected.id && <span className="studio-new-tab">New template</span>}</div>
    <div className="studio-email-status"><Toggle label={selected.event_key?'Send this email when the booking status changes':'Keep this custom template active'} hint={selected.event_key?'Automatic delivery also requires enabled SMTP settings.':'Custom templates can be saved, previewed and sent as test emails.'} checked={selected.active} onChange={v=>setSelected({...selected,active:v})}/></div>
    <div className="studio-email-workspace"><section className="studio-email-preview"><div className="studio-browser-bar"><i/><i/><i/><span>{previewBusy?'Updating preview…':'Live preview'}</span><b>Format {config.format}</b></div><div className="studio-preview-subject"><small>SUBJECT</small><strong>{preview?.subject || 'Your email preview'}</strong></div>{previewError && <div className="studio-preview-warning">{previewError} Preview shows the last valid version.</div>}<iframe title="Email preview" sandbox="" srcDoc={preview?.html || '<p style="font-family:sans-serif;padding:24px;color:#667085">Preparing your preview…</p>'}/><p className="studio-preview-footnote">Sample booking data · Only published policy links appear</p></section>
    <form className="studio-email-editor" onSubmit={save}><div className="studio-token-box"><strong>Personalize your message</strong><p>Click a placeholder to insert it into the message.</p><div>{data.placeholders.map(key=><button type="button" key={key} onClick={()=>editorRef.current?.insertText(`{{${key}}}`)}>{`{{${key}}}`}</button>)}</div></div>
    <Field label="Template name" value={selected.name} maxLength={120} required onChange={e=>setSelected({...selected,name:e.target.value})}/>
    <Field label="Email format"><select value={config.format} onChange={e=>update('format',Number(e.target.value))}>{formats.map((name,i)=><option key={name} value={i+1}>Format {i+1} — {name}</option>)}</select></Field>
    <div className="studio-section-label">Brand & imagery</div><div className="studio-three-col">{[['logo','Logo'],['icon','Icon'],['banner_image','Banner']].map(([key,label])=><ImageField key={key} label={label} value={config[key]} onChange={v=>update(key,v)}/>)}</div>
    <Field label="Accent color"><div className="studio-color"><input type="color" value={config.accent} onChange={e=>update('accent',e.target.value)}/><code>{config.accent}</code></div></Field>
    <div className="studio-section-label">The message</div><Field label="Subject line" value={config.subject} maxLength={255} required onChange={e=>update('subject',e.target.value)}/><Field label="Main title" value={config.title} maxLength={255} required onChange={e=>update('title',e.target.value)}/><div className="studio-field"><span>Mail body message</span><RichEditor value={config.body} onChange={v=>update('body',v)} editorRef={editorRef}/></div>
    {[3,9,10].includes(config.format) && <div className="studio-field"><span>Additional message</span><RichEditor label="Additional message" value={config.body_2} onChange={v=>update('body_2',v)}/></div>}
    {config.format!==7 && <><div className="studio-section-label">Button & destination</div><div className="studio-two-col"><Field label="Button label" value={config.button_name} onChange={e=>update('button_name',e.target.value)}/><Field label="Button URL" value={config.button_url} hint="Use {{booking_url}} for the customer's tickets." onChange={e=>update('button_url',e.target.value)}/></div></>}
    <div className="studio-section-label">Footer & links</div><Field label="Footer message"><textarea rows={2} value={config.footer_text} onChange={e=>update('footer_text',e.target.value)}/></Field><Field label="Copyright text" value={config.copyright_text} onChange={e=>update('copyright_text',e.target.value)}/>
    <div className="studio-check-grid">{data.pages.map(page=><label key={page.slug}><input type="checkbox" checked={config.page_links.includes(page.slug)} onChange={e=>update('page_links',e.target.checked?[...config.page_links,page.slug]:config.page_links.filter(s=>s!==page.slug))}/><span>{page.title}<small>{page.published?'Published':'Draft — hidden in emails'}</small></span></label>)}</div><Link className="studio-text-link" to="/admin/policies">Manage policy pages →</Link>
    <section className="studio-socials" aria-label="Social media links"><h3>Social media links</h3><Field label="Social links for this email"><select value={templateSocialMode(config)} onChange={e=>update('social_mode',e.target.value)}><option value="brand">Use saved brand links</option><option value="custom">Customize for this template</option><option value="hidden">Hide social links</option></select></Field>
      {templateSocialMode(config)==='custom' ? socialNetworks.map(({key,name,example})=><Field key={key} label={name} type="url" maxLength={2048} placeholder={example} value={config.social_links?.[key] || ''} onChange={e=>update('social_links',{...config.social_links,[key]:e.target.value})}/>) : <p className="studio-social-help">{templateSocialMode(config)==='brand'?'Uses the profiles saved in Brand & SMTP. Empty profiles are hidden.':'No social links will appear in this email.'}</p>}
      <Link className="studio-text-link" to="/admin/mail-settings">Manage brand social links →</Link>
    </section>
    <div className="studio-save-bar"><button type="button" className="studio-button secondary" onClick={()=>{setSelected(JSON.parse(saved));setMessage(null);}}>Reset changes</button><button type="button" className="studio-button secondary" onClick={()=>setTestOpen(true)}>Send test</button><button className="studio-button primary" disabled={saving}>{saving?'Saving…':'Save template'}<Icon name="check" size={16}/></button></div>
    </form></div></div>
    {testOpen && <div className="studio-modal-backdrop"><form role="dialog" aria-modal="true" aria-labelledby="test-email-title" className="studio-modal" onSubmit={sendTest}><h2 id="test-email-title">Send a test email</h2><p>This sends the current preview, including unsaved edits, using your saved SMTP settings.</p><Notice message={message}/><Field label="Recipient email" type="email" required value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="you@example.com"/><div className="studio-save-bar"><button type="button" className="studio-button secondary" disabled={sending} onClick={()=>setTestOpen(false)}>Cancel</button><button className="studio-button primary" disabled={sending}>{sending?'Sending…':'Send test email'}</button></div></form></div>}
  </>;
}
