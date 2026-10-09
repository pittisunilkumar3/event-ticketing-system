import { useEffect, useState } from 'react';
import CkEditor from '../CkEditor';

// The studio rich editor is the hostel-reference CKEditor 4 (full toolbar,
// self-hosted in /public/ckeditor4/). Adapter maps the RichEditor prop
// contract (value/onChange) onto CkEditor's (data/onChange).
export function RichEditor({ value, onChange }) {
  return <CkEditor data={value} onChange={onChange} />;
}
import api from '../../api/client';

export { default as Icon } from '../../components/Icon';
import Icon from '../../components/Icon';
export function Field({ label, hint, children, ...props }) {
  return <label className="studio-field"><span>{label}</span>{children || <input {...props} />} {hint && <small>{hint}</small>}</label>;
}
export function Toggle({ checked, onChange, label, hint }) {
  return <label className="studio-toggle"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} /><i aria-hidden="true" /></label>;
}
export function Notice({ message }) {
  return message && <div role="status" className={`studio-notice ${message.type || 'error'}`}>{message.text}</div>;
}
export function ImageField({ label, value, onChange }) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function upload(e) {
    const file=e.target.files[0]; if(!file) return;
    e.target.value=''; setError('');
    if(file.size>5*1024*1024) { setError('Choose an image smaller than 5 MB.'); return; }
    const form=new FormData(); form.append('image',file); setBusy(true);
    try { const {data}=await api.post('/admin/studio/upload',form,{headers:{'Content-Type':'multipart/form-data'}}); onChange(data.data.url); }
    catch(err) { setError(err.response?.data?.message || 'Upload failed.'); }
    finally { setBusy(false); }
  }
  return <div className="studio-image-field"><span>{label}</span><label className="studio-upload">{value ? <img src={value} alt={`${label} preview`} /> : <><Icon name="plus"/><small>{busy?'Uploading…':'Upload image'}</small></>}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} disabled={busy} /></label>{busy && <small>Uploading…</small>}{value && <button type="button" onClick={()=>onChange('')} className="studio-text-button">Remove</button>}{error && <small className="studio-error">{error}</small>}</div>;
}
export function useUnsaved(dirty) {
  useEffect(()=>{ const handler=e=>{if(dirty){e.preventDefault();e.returnValue='';}}; window.addEventListener('beforeunload',handler); return ()=>window.removeEventListener('beforeunload',handler); },[dirty]);
  return () => !dirty || window.confirm('Discard your unsaved changes?');
}
export const errorText = err => err.response?.data?.message || 'Something went wrong. Please try again.';
