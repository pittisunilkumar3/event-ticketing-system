import { useState } from 'react';
import { Link } from 'react-router-dom';
import {notifySiteSettingsChanged,useSiteSettings} from '../../settings/SiteSettingsContext';
import api from '../../api/client';
import SocialLinksSettings from './SocialLinksSettings';
import { Field, Toggle, ImageField, Notice, Icon, errorText, useUnsaved } from './StudioUI';
import './mailSettings.css';

export default function MailSettings({data,onSettings}) {
  const site=useSiteSettings();
  const [brand,setBrand]=useState(data.brand);
  const [smtp,setSmtp]=useState({...data.smtp,password:''});
  const [saved,setSaved]=useState(JSON.stringify({brand:data.brand,smtp:{...data.smtp,password:''}}));
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState(null);
  const [recipient,setRecipient]=useState('');
  const [testMessage,setTestMessage]=useState(null);
  const smtpChanged=JSON.stringify(JSON.parse(saved).smtp)!==JSON.stringify(smtp);
  const canTest=!smtpChanged&&Boolean(data.smtp.host&&data.smtp.from_email);
  useUnsaved(saved!==JSON.stringify({brand,smtp}));
  const change=(key,value)=>setSmtp(s=>({...s,[key]:value}));
  async function save(section,e) {
    e.preventDefault();if(busy)return;setBusy(section);setMessage(null);
    try {
      const {data:r}=await api.put(`/admin/studio/${section}`,section==='brand'?brand:smtp);
      if(section==='brand') {
        notifySiteSettingsChanged();setBrand(r.data.brand);onSettings('brand',r.data.brand);
        setSaved(prev=>JSON.stringify({...JSON.parse(prev),brand:r.data.brand}));
      } else {
        const safe={...r.data.smtp,password:''};setSmtp(safe);onSettings('smtp',r.data.smtp);
        setSaved(prev=>JSON.stringify({...JSON.parse(prev),smtp:safe}));
      }
      setMessage({type:'success',text:r.message});
    } catch(err) {setMessage({text:errorText(err)});}
    finally {setBusy('');}
  }
  async function verify() {
    if(busy||smtpChanged)return;setBusy('verify');setMessage(null);
    try {const {data:r}=await api.post('/admin/studio/smtp/verify');setMessage({type:'success',text:r.message});}
    catch(err) {setMessage({text:errorText(err)});}
    finally {setBusy('');}
  }
  async function sendTest(e) {
    e.preventDefault();
    if(busy||!canTest)return;
    setBusy('test');setTestMessage(null);
    try {
      const {data:r}=await api.post('/admin/studio/smtp/test',{recipient:recipient.trim()});
      setTestMessage({type:'success',text:`${r.message} Recipient: ${r.data.recipient}`});
    } catch(err) {setTestMessage({text:errorText(err)});}
    finally {setBusy('');}
  }
  return <div className="mail-settings">
    <div className="studio-heading">
      <div><span className="studio-eyebrow">CONFIGURATION / EMAIL</span><h1>Mail settings</h1><p>Connect your email provider and choose how booking emails appear in your guests’ inboxes.</p></div>
      <span className={`mail-delivery-status ${data.smtp.enabled?'enabled':''}`}><i aria-hidden="true"/>{data.smtp.enabled?'Delivery enabled':'Delivery disabled'}</span>
    </div>
    <Notice message={message}/>
    <form className="studio-panel mail-delivery-panel" onSubmit={e=>save('smtp',e)} aria-busy={!!busy}>
      <div className="mail-panel-heading"><span className="mail-section-icon"><Icon name="mail" size={22}/></span><div><h2>Email delivery</h2><p>Send booking confirmations, cancellations, and refunds through your provider.</p></div></div>
      <fieldset className="mail-form-fields" disabled={!!busy}>
        <div className="mail-enable-row"><Toggle label="Enable automatic emails" hint="Messages use your active email templates." checked={smtp.enabled} onChange={v=>change('enabled',v)}/></div>
        <div className="mail-settings-columns">
          <section className="mail-settings-section" aria-labelledby="mail-connection-title">
            <div className="mail-section-heading"><h3 id="mail-connection-title">Provider connection</h3><p>Use the SMTP details from your email service.</p></div>
            <Field label="SMTP host" placeholder="smtp.example.com" required={smtp.enabled} value={smtp.host} onChange={e=>change('host',e.target.value)}/>
            <div className="mail-connection-options"><Field label="Port" type="number" min="1" max="65535" required value={smtp.port} onChange={e=>change('port',e.target.value===''?'':Number(e.target.value))}/><Field label="Encryption"><select value={smtp.encryption} onChange={e=>setSmtp(s=>({...s,encryption:e.target.value,port:e.target.value==='tls'?465:587}))}><option value="starttls">STARTTLS (587)</option><option value="tls">TLS / SSL (465)</option></select></Field></div>
            <Field label="Username" autoComplete="off" placeholder="Your SMTP username" value={smtp.username} onChange={e=>change('username',e.target.value)}/>
            <Field label="SMTP password" type="password" autoComplete="new-password" value={smtp.password} placeholder={smtp.has_password?'Leave blank to keep saved password':'Enter your SMTP password'} hint={smtp.has_password?'A password is saved. Enter a new one only to replace it.':'Use the password or app password from your email service.'} onChange={e=>change('password',e.target.value)}/>
          </section>
          <section className="mail-settings-section mail-sender-section" aria-labelledby="mail-sender-title">
            <div className="mail-section-heading"><h3 id="mail-sender-title">Sender details</h3><p>Help guests recognize your emails and reply to you.</p></div>
            <Field label="Sender name" placeholder="Your organization" required={smtp.enabled} value={smtp.from_name} onChange={e=>change('from_name',e.target.value)}/>
            <Field label="Sender email" type="email" placeholder="bookings@example.com" required={smtp.enabled} value={smtp.from_email} hint="Use an address approved by your email provider." onChange={e=>change('from_email',e.target.value)}/>
            <Field label="Reply-to email (optional)" type="email" placeholder="support@example.com" value={smtp.reply_to} onChange={e=>change('reply_to',e.target.value)}/>
            <div className="mail-template-note"><Icon name="page" size={20}/><div><strong>Make every email feel like you.</strong><p>Update your messages and send a test from <Link to="/admin/email-templates">Email templates <span aria-hidden="true">↗</span></Link>.</p></div></div>
          </section>
        </div>
      </fieldset>
      <div className="mail-settings-actions">
        <p>{smtpChanged?<><span className="mail-unsaved-dot" aria-hidden="true"/>Unsaved changes. Save before verifying.</>:<>Save your settings, then verify the connection.</>}</p>
        <div><button type="button" className="studio-button secondary" onClick={verify} disabled={!!busy||smtpChanged}>{busy==='verify'?'Connecting…':'Verify connection'}</button><button type="submit" className="studio-button primary" disabled={!!busy}><Icon name="check" size={16}/>{busy==='smtp'?'Saving…':'Save settings'}</button></div>
      </div>
    </form>
    <form className="studio-panel mail-test-panel" onSubmit={sendTest} aria-busy={busy==='test'}>
      <div className="mail-panel-heading"><span className="mail-section-icon"><Icon name="mail" size={22}/></span><div><h2>Send a test email</h2><p>Check delivery to your inbox using your saved SMTP settings.</p></div></div>
      <div className="mail-test-body">
        <div className="mail-test-controls"><Field label="Recipient email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" value={recipient} disabled={!!busy} onChange={e=>{setRecipient(e.target.value);setTestMessage(null);}}/><button className="studio-button secondary" type="submit" disabled={!!busy||!canTest}><Icon name="arrow" size={16}/>{busy==='test'?'Sending test…':'Send test email'}</button></div>
        <p className="mail-test-help">{smtpChanged?'Save your changes before sending a test email.':!canTest?'Save your SMTP host and sender email to send a test.':'Sends one test message, even when automatic emails are disabled.'}</p>
        <Notice message={testMessage}/>
      </div>
    </form>
    {site.is_organizer&&<details className="mail-brand-settings"><summary>Branding & social links<span>Logo, support details, and links used in your emails</span></summary><div className="mail-brand-grid">
      <form className="studio-panel" onSubmit={e=>save('brand',e)}><div className="studio-panel-title"><Icon name="ticket"/><h2>Brand identity</h2></div><div className="studio-form-body"><Field label="Company name" value={brand.company_name} required onChange={e=>setBrand({...brand,company_name:e.target.value})}/><Field label="Public website URL" type="url" value={brand.site_url} required hint="Used for ticket, image and policy links in emails. Use your public domain before sending to customers." onChange={e=>setBrand({...brand,site_url:e.target.value})}/><Field label="Support email" type="email" value={brand.support_email} onChange={e=>setBrand({...brand,support_email:e.target.value})}/><ImageField label="Website & email logo" value={brand.logo} onChange={v=>setBrand({...brand,logo:v})}/><button className="studio-button primary" disabled={!!busy}>{busy==='brand'?'Saving…':'Save brand settings'}</button></div></form>
      <SocialLinksSettings links={data.socialLinks} onSave={socialLinks=>onSettings('socialLinks',socialLinks)}/>
    </div></details>}
  </div>;
}
