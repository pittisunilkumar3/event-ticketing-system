import {useRef,useState} from 'react';
import {siteBase} from '../../saas/context';
import {notifySiteSettingsChanged} from '../../settings/SiteSettingsContext';
import api from '../../api/client';
import {Field,RichEditor,Toggle,Notice,errorText,useUnsaved} from './StudioUI';
export default function Policies({data,onPage,client=api,endpoint='/admin/studio',platform=false}){
 const [page,setPage]=useState(()=>data.pages.find(p=>p.slug==='privacy-policy')||data.pages[0]);
 const [saved,setSaved]=useState(JSON.stringify(page)),[message,setMessage]=useState(null),[busy,setBusy]=useState(false),[uploadBusy,setUploadBusy]=useState(false);
 const editorRef=useRef(null),allowChange=useUnsaved(saved!==JSON.stringify(page));
 function select(slug){if(!allowChange())return;const p=data.pages.find(p=>p.slug===slug);setPage(p);setSaved(JSON.stringify(p));setMessage(null);}
 async function save(e){e.preventDefault();setBusy(true);setMessage(null);try{
  const payload={...page,body:editorRef.current?.getData()??page.body};
  const {data:r}=await client.put(`${endpoint}/pages/${page.slug}`,payload);setPage(r.data.page);setSaved(JSON.stringify(r.data.page));onPage(r.data.page);notifySiteSettingsChanged();setMessage({type:'success',text:r.message});
 }catch(err){setMessage({text:errorText(err)});}finally{setBusy(false);}}
 return <div className="policy-editor">
  {!platform&&<div className="studio-heading"><div><h1>Your organizer policies</h1><p>Manage the pages on your organizer’s ticketing site.</p></div></div>}
  <Notice message={message}/>
  <div className="policy-editor-select"><Field label="Page"><select aria-label="Page to edit" value={page.slug} disabled={busy||uploadBusy} onChange={e=>select(e.target.value)}>{data.pages.map(p=><option key={p.slug} value={p.slug}>{p.title}</option>)}</select></Field></div>
  <form onSubmit={save} className="studio-panel">
   <div className="studio-panel-title"><h2>{page.title}</h2><span className="studio-badge">{page.published?'Published':'Draft'}</span></div>
   <div className="studio-form-body">
    <Field label="Page title" value={page.title} required maxLength={120} disabled={busy} onChange={e=>setPage({...page,title:e.target.value})}/>
    <div className="studio-field"><span>Content</span><RichEditor key={page.slug} label="Page content" editorRef={editorRef} value={page.body} onChange={body=>setPage(p=>({...p,body}))} client={client} uploadUrl={endpoint+'/upload'} disabled={busy} onBusy={setUploadBusy}/></div>
    <Toggle label="Publish this page" hint="Published pages appear in your website footer." checked={page.published} onChange={published=>setPage({...page,published})}/>
    <div className="studio-save-bar">
     {data.pages.find(p=>p.slug===page.slug)?.published&&<a href={`${platform?'':siteBase}/pages/${page.slug}`} target="_blank" rel="noreferrer" className="studio-button secondary">View published page</a>}
     <button type="button" className="studio-button secondary" disabled={busy||uploadBusy} onClick={()=>{setPage(JSON.parse(saved));setMessage(null);}}>Reset changes</button>
     <button className="studio-button primary" disabled={busy||uploadBusy}>{busy?'Saving…':uploadBusy?'Uploading…':page.published?'Save & publish':'Save draft'}</button>
    </div>
   </div>
  </form>
 </div>;
}
