import {useEffect,useState} from 'react';
import api from '../api/client';
import {session} from './context';
import {useAdminSession} from '../admin/adminSessionContext';
import {PackageDetails} from './PackageDetails';
import PackageOptions from './PackageOptions';
import {useLocation} from 'react-router-dom';
import './saas.css';
export const inr=paise=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(paise||0)/100);
import {loadCheckout} from './razorpayCheckout';
export default function EventPackages(){
 const {hash}=useLocation();
 const [data,setData]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(null);
 const owner=useAdminSession()?.role==='super_admin';
 const load=()=>api.get('/admin/saas/account').then(r=>setData(r.data.data));
 useEffect(()=>{let active=true;const refresh=()=>api.get('/admin/saas/account').then(r=>{if(active){setData(r.data.data);setError('');}}).catch(e=>{if(active)setError(e.response?.data?.message||'Could not load event packages.');});refresh();window.addEventListener('focus',refresh);return()=>{active=false;window.removeEventListener('focus',refresh);};},[]);
 useEffect(()=>{if(data&&hash==='#available-packages')document.getElementById('available-packages')?.scrollIntoView({block:'start'});},[Boolean(data),hash]);
 async function checkPayment(purchase){setBusy(purchase.id);setError('');setMessage('');try{const r=await api.post('/admin/saas/purchases/'+purchase.id+'/reconcile');await load();window.dispatchEvent(new Event('event-balance-updated'));setMessage(r.data.data.status==='paid'?'Payment confirmed. Your event balance is up to date.':'Payment has not been captured yet. No credits have been added.');}catch(e){setError(e.response?.data?.message||'Unable to check payment.');}finally{setBusy(null);}}
 async function buy(pack){
  setBusy(pack.id);setError('');setMessage('');
  try{
   await loadCheckout();
   const key='package-request:'+pack.id;
   let request=session.getItem(key);if(!request){request=crypto.randomUUID();session.setItem(key,request);}
   const {data:r}=await api.post('/admin/saas/purchases',{package_id:pack.id,request_key:request});
   if(r.data.paid){session.removeItem(key);await load();setMessage('This purchase is already paid. Your event balance is up to date.');setBusy(null);return;}
   const purchase=r.data.purchase;
   const checkout=new window.Razorpay({key:r.data.key,order_id:purchase.provider_order_id,amount:purchase.amount_paise,currency:'INR',name:'TicketFlow',description:purchase.package_name+' · '+purchase.event_count+' events',theme:{color:'#d95620'},
    handler:async result=>{try{await api.post('/admin/saas/purchases/verify',{...result,purchase_id:purchase.id});session.removeItem(key);setMessage('Payment confirmed. Your events are ready to use.');await load();window.dispatchEvent(new Event('event-balance-updated'));}catch(e){setError(e.response?.data?.message||'Payment confirmation is pending. Refresh your balance shortly.');}finally{setBusy(null);}},
    modal:{ondismiss:()=>{setBusy(null);load().catch(()=>{});}},
   });
   checkout.on('payment.failed',()=>{setError('Payment was not completed. You can retry this purchase.');setBusy(null);});checkout.open();
  }catch(e){setError(e.response?.data?.message||e.message||'Unable to open checkout.');setBusy(null);}
 }
 return <div className="saas" style={{padding:0}}><header className="page-head"><div><span className="eyebrow">Your event subscription</span><h1>Events on your terms.</h1><p className="lede">Buy a package. Publish when you’re ready. No monthly charges or expiry dates.</p></div><button className="secondary" onClick={()=>load().then(()=>{setError('');window.dispatchEvent(new Event('event-balance-updated'));}).catch(()=>setError('Unable to refresh.'))}>Refresh balance</button></header>{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}{!data?(!error&&<p role="status">Loading your event balance…</p>):<><PackageDetails data={data}/>{data.organization.status==='suspended'&&<p className="notice">Your account is suspended. Publishing and new bookings are paused. Contact support.</p>}{!data.payments_ready&&<p className="notice">Online package payments are not available yet. Contact the platform administrator.</p>}<PackageOptions data={data} owner={owner} busy={busy} onBuy={buy}/>{!owner&&<p className="muted">An account owner can purchase event packages.</p>}<section className="card"><h2>Purchase history</h2><div className="table-wrap"><table><thead><tr><th>Package</th><th>Events</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{data.purchases.map(p=><tr key={p.id}><td>{p.package_name}<small>{p.id}</small></td><td>{p.event_count}</td><td>{inr(p.amount_paise)}</td><td><span className={'badge '+p.status}>{p.status}</span></td><td>{p.created_at?.slice(0,10)}</td><td>{owner&&p.status!=='paid'&&<button className="secondary" disabled={busy!==null||!data.payments_ready} onClick={()=>checkPayment(p)}>Check payment</button>}</td></tr>)}</tbody></table>{!data.purchases.length&&<p className="empty">Your package purchases will appear here.</p>}</div></section><section className="card" style={{marginTop:20}}><h2>Event balance history</h2><div className="table-wrap"><table><thead><tr><th>Activity</th><th>Events</th><th>Date</th></tr></thead><tbody>{data.ledger.map(l=><tr key={l.id}><td>{l.reason}</td><td>{l.amount>0?'+':''}{l.amount}</td><td>{l.created_at?.slice(0,10)}</td></tr>)}</tbody></table>{!data.ledger.length&&<p className="empty">Package purchases and published events will appear here.</p>}</div></section><p className="muted">Republishing the same event is free. Cancellation does not automatically return an event credit. Existing events continue even when your balance is zero.</p></>}</div>;
}
