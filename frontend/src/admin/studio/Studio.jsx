import { useEffect, useState } from 'react';
import api from '../../api/client';
import TicketDesigner from './TicketDesigner';
import EmailDesigner from './EmailDesigner';
import MailSettings from './MailSettings';
import Policies from './Policies';
import DeliveryLog from './DeliveryLog';
import { Notice, errorText } from './StudioUI';
import './studio.css';

export default function Studio({section}) {
  const [data,setData]=useState(null),[error,setError]=useState('');
  async function load(){setError('');try{const {data:r}=await api.get('/admin/studio/bootstrap');setData(r.data);}catch(err){setError(errorText(err));}}
  useEffect(()=>{load();},[]);
  const updateTemplate=t=>setData(current=>{const key=t.kind==='ticket'?'ticketTemplates':'emailTemplates';const list=current[key];return {...current,[key]:list.some(x=>x.id===t.id)?list.map(x=>x.id===t.id?t:x):[...list,t]};});
  if(error)return <div className="studio"><Notice message={{text:error}}/><button className="studio-button secondary" onClick={load}>Try again</button></div>;
  if(!data)return <div className="studio studio-empty">Opening your design studio…</div>;
  return <div className="studio" key={section}>{section==='tickets'?<TicketDesigner data={data} onUpdate={updateTemplate}/>:section==='emails'?<EmailDesigner data={data} onUpdate={updateTemplate}/>:section==='smtp'?<MailSettings data={data} onSettings={(key,value)=>setData({...data,[key]:value})}/>:section==='pages'?<Policies data={data} onPage={page=>setData({...data,pages:data.pages.map(p=>p.slug===page.slug?page:p)})}/>:<DeliveryLog/>}</div>;
}
