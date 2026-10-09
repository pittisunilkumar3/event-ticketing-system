import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import '../admin/studio/studio.css';
export default function PolicyPage(){
  const {slug}=useParams();
  const [page,setPage]=useState(null),[error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();setPage(null);setError('');api.get(`/pages/${slug}`,{signal:controller.signal}).then(({data})=>setPage(data.data.page)).catch(err=>{if(!controller.signal.aborted)setError(err.response?.data?.message || 'Unable to load this page.');});return()=>controller.abort();},[slug]);
  return <main className="public-policy"><Link to="/" className="text-sm text-orange-300">← Back to events</Link>{error?<p className="py-12 text-slate-400">{error}</p>:!page?<p className="py-12 text-slate-400">Loading page…</p>:<><h1>{page.title}</h1><p className="mb-8 text-xs text-slate-500">Last updated {String(page.updated_at).slice(0,10)}</p><div className="policy-content" dangerouslySetInnerHTML={{__html:page.body}}/></>}</main>;
}
