import {useEffect,useState} from 'react';
import Policies from '../admin/studio/Policies';
import '../admin/studio/studio.css';
export default function PlatformPolicies({client}){
 const [data,setData]=useState(null),[error,setError]=useState('');
 async function load(){setError('');try{const r=await client.get('/website/pages');setData(r.data.data);}catch(e){setError(e.response?.data?.message||'Unable to load platform pages.');}}
 useEffect(()=>{load();},[]);
 return <div className="studio">{error?<><p role="alert">{error}</p><button onClick={load}>Try again</button></>:data?<Policies data={data} client={client} endpoint="/website" platform onPage={page=>setData(d=>({...d,pages:d.pages.map(p=>p.slug===page.slug?page:p)}))}/>:<p role="status">Loading platform pages…</p>}</div>;
}
