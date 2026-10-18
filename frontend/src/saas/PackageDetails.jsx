import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import api from '../api/client';
import './packageDetails.css';

export function PackageDetails({data,compact=false}) {
 const {subscription:s,organization}=data;
 if(!s)return null;
 const purchase=s.latest_purchase;
 const paidDate=purchase?.paid_at?new Date(purchase.paid_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):null;
 return <section className="package-details" aria-label="Your event package">
  <header><div><p className="package-details-label">{organization.name}</p><h2>Your event package</h2></div><span className="package-details-status">{organization.status==='suspended'?'Account suspended':s.can_publish?'Ready to publish':'No credits remaining'}</span></header>
  <h3>{purchase?purchase.package_name:Number(s.remaining_events)>0?'Superadmin event credits':'No package purchased'}</h3>
  {purchase?<p>Latest purchase · {purchase.event_count} events · {new Intl.NumberFormat('en-IN',{style:'currency',currency:purchase.currency}).format(purchase.amount_paise/100)}{paidDate?' · Paid '+paidDate:''}</p>:<p>{Number(s.remaining_events)>0?'Your available credits can be used to create and publish events.':'Purchase a package or ask the platform administrator to add credits.'}</p>}
  <dl><div><dt>Purchased events</dt><dd>{s.purchased_events}</dd></div><div><dt>Credits used</dt><dd>{s.used_events}</dd></div><div><dt>Superadmin adjustments</dt><dd>{Number(s.adjusted_events)>0?'+':''}{s.adjusted_events}</dd></div><div><dt>Events remaining</dt><dd>{s.remaining_events}</dd></div></dl>
  <p className="package-details-note">Available credits let you create events, including drafts. One credit is used on first publication; republishing is free. No monthly renewal or expiry.</p>
  {compact?<Link to="/admin/event-packages">View packages & purchase history →</Link>:s.can_create?<Link to="/admin/events/new">Create an event →</Link>:<a href="#available-packages">Browse packages ↓</a>}
 </section>;
}

export default function AccountPackage() {
 const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setError('');
  api.get('/admin/saas/account',{signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setData(r.data.data);}).catch(e=>{if(!controller.signal.aborted)setError(e.response?.data?.message||'Unable to load your event package.');});
  const refresh=()=>setAttempt(n=>n+1);window.addEventListener('focus',refresh);window.addEventListener('event-balance-updated',refresh);
  return()=>{controller.abort();window.removeEventListener('focus',refresh);window.removeEventListener('event-balance-updated',refresh);};
 },[attempt]);
 if(error)return <section className="package-details" role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>Try again</button></section>;
 return data?<PackageDetails data={data} compact/>:<p role="status">Loading your event package…</p>;
}
