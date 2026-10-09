import { useState } from 'react';
import api from '../../api/client';
import { socialNetworks, emptySocialLinks } from '../../utils/social';
import { Field, Notice, Icon, errorText, useUnsaved } from './StudioUI';

export default function SocialLinksSettings({ links, onSave }) {
  const [values, setValues] = useState({ ...emptySocialLinks, ...links });
  const [saved, setSaved] = useState(JSON.stringify({ ...emptySocialLinks, ...links }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  useUnsaved(saved !== JSON.stringify(values));
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const { data } = await api.put('/admin/studio/social-links', { socialLinks: values });
      setValues(data.data.socialLinks); setSaved(JSON.stringify(data.data.socialLinks));
      onSave(data.data.socialLinks);
      setMessage({ type: 'success', text: data.message });
    } catch (err) { setMessage({ text: errorText(err) }); }
    finally { setBusy(false); }
  }
  return <form className="studio-panel studio-social-settings" onSubmit={save}>
    <div className="studio-panel-title"><Icon name="settings"/><h2>Social media links</h2><span>WEBSITE & EMAILS</span></div>
    <div className="studio-form-body">
      <p className="studio-social-help">Add your profile links once. They appear in the website footer and email templates using brand links. Leave a field empty to hide that platform.</p>
      <Notice message={message}/>
      <div className="studio-social-fields">{socialNetworks.map(({ key, name, example }) =>
        <Field key={key} label={name} type="url" maxLength={2048} placeholder={example}
          value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))}/>
      )}</div>
      <div className="studio-save-bar"><small>Use full profile URLs starting with https://.</small><button className="studio-button primary" disabled={busy}>{busy ? 'Saving…' : 'Save social links'}<Icon name="check" size={16}/></button></div>
    </div>
  </form>;
}
