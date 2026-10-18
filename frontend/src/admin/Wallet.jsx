import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import Withdrawals from './Withdrawals';
import { formatCurrency as currencyFormat, formatDateTime } from '../utils/format';
import './wallet.css';

const reasons = { payout_reversal:'Returned bank transfer',booking:'Booking received',opening:'Opening booking balance',cancelled:'Cancellation reversal',refunded:'Refund reversal',withdrawal:'Withdrawal paid'};
export default function Wallet() {
  const [params,setParams] = useSearchParams();
  const eventId=params.get('event_id') || '', currency=params.get('currency') || 'INR', mode=params.get('mode') || 'live', page=params.get('page') || '1';
  const includeArchived=params.get('include_archived')==='true';
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    api.get('/admin/wallet',{params:{event_id:eventId||undefined,mode,currency,page,include_archived:includeArchived},signal:controller.signal})
      .then(r=>{if(!controller.signal.aborted)setData(r.data.data);})
      .catch(e=>{if(!controller.signal.aborted)setError(e.response?.data?.message || 'Unable to load your wallet. Please try again.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[eventId,mode,currency,page,includeArchived,refresh]);
  useEffect(()=>{const onFocus=()=>setRefresh(n=>n+1);window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus);},[]);
  function filter(key,value){const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);next.delete('page');setParams(next);}
  const formatCurrency=amount=>currencyFormat(amount,currency);
  const selected=data?.events.find(e=>String(e.id)===eventId);
  const events=eventId?data?.events.filter(e=>String(e.id)===eventId):data?.events;
  const showingArchived=includeArchived || Boolean(eventId && selected?.archived_at);
  return <div className="wallet-page">
    <header className="wallet-heading"><div><p className="wallet-eyebrow">ORGANIZATION FINANCES</p><h1>Event wallet</h1><p>Every booking, connected to its event.</p></div><button className="wallet-button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>{loading?'Updating…':'Refresh'}</button></header>
    <div className="wallet-filters">
      <label>Event<select value={eventId} onChange={e=>filter('event_id',e.target.value)}><option value="">{showingArchived?'All events':'Current events'}</option>{data?.events.map(e=><option key={e.id} value={e.id}>{e.title}{e.archived_at?' (archived)':''}</option>)}</select></label>
      <label>Payment type<select value={mode} onChange={e=>filter('mode',e.target.value)}><option value="live">Live payments</option><option value="test">Gateway test payments</option><option value="demo">Demo payments</option><option value="recorded">Other recorded payments</option></select></label>
      <label>Currency<select value={currency} onChange={e=>filter('currency',e.target.value)}><option value="INR">INR · current bookings</option><option value="USD">USD · historical bookings</option></select></label>
      <label className="wallet-archive-filter"><input type="checkbox" checked={showingArchived} disabled={loading} onChange={e=>{const next=new URLSearchParams(params);if(e.target.checked)next.set('include_archived','true');else next.delete('include_archived');next.delete('event_id');next.delete('page');setParams(next);}}/>Show archived events</label>
      {eventId&&<Link to={`/admin/events/${eventId}`}>View event ↗</Link>}
    </div>
    {error?<div className="wallet-message" role="alert">{error} <button onClick={()=>setRefresh(n=>n+1)}>Try again</button></div>:loading?<p role="status" className="wallet-message">Loading wallet…</p>:data&&<>
      <section className="wallet-overview" aria-label="Wallet summary">
        <div className="wallet-balance"><div className="wallet-balance-top"><Icon name="credit-card" size={26}/><span>{mode==='live'?'AVAILABLE TO REQUEST':mode==='test'?'TEST BALANCE':mode==='demo'?'DEMO BALANCE':'RECORDED BALANCE'} · {currency}</span></div><strong>{formatCurrency(mode==='live'?data.summary.available:data.summary.balance)}</strong><p>{selected?.title || (showingArchived?'Across all your events':'Across your current events')}</p><small>{mode==='live'?'Verified booking payments · '+currency:mode==='test'||mode==='demo'?'Test bookings only · No money collected':'Bookkeeping balance · Settlement not verified'}</small></div>
        <div className="wallet-stat"><span>Booking credits</span><strong>{formatCurrency(data.summary.credits)}</strong><small>{data.summary.bookings} {Number(data.summary.bookings)===1?'booking':'bookings'} recorded</small></div>
        <div className="wallet-stat"><span>Cancellations & refunds</span><strong>{formatCurrency(data.summary.reversals)}</strong><small>Reversed from booking credits</small></div>
      </section>
      <p className="wallet-note">{mode==='live'?'Verified payments credit the event wallet. Request a withdrawal for superadmin approval; approval starts a bank transfer through RazorpayX.':mode==='test'||mode==='demo'?'Test and demo payments cannot be withdrawn.':'Older recorded amounts are not verified gateway funds and cannot be withdrawn.'} Event package credits are separate.</p>
      {mode==='live'&&<><div className="wallet-hold-summary"><span>Wallet balance <strong>{formatCurrency(data.summary.balance)}</strong></span><span>Reserved for withdrawal <strong>{formatCurrency(data.summary.held)}</strong></span><span>Refund / review holds <strong>{formatCurrency(data.summary.refund_held)}</strong></span><span>Paid out <strong>{formatCurrency(data.summary.withdrawn)}</strong></span></div><Withdrawals currency={currency} events={data.events} eventId={eventId} onChange={()=>setRefresh(n=>n+1)}/></>}
      <section className="wallet-section"><header><div><h2>{eventId?'Event balance':'Your event wallets'}</h2><p>Booking credits minus refunds and paid withdrawals.</p></div><span>{events.length} {events.length===1?'event':'events'}</span></header>
        {!events.length?<div className="wallet-empty"><Icon name="calendar" size={32}/><h3>No current events</h3><p>Create an event or show archived events to view older wallets.</p><Link to="/admin/events/new">Create an event →</Link></div>:<div className="wallet-table-scroll"><table><thead><tr><th>Event</th><th>Bookings</th><th>Credits</th><th>Reversals</th><th>Balance</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td><button className="wallet-event-link" onClick={()=>filter('event_id',String(e.id))}>{e.title}</button><small>{e.archived_at?'Archived':e.status==='published'?'Published':'Draft'}</small></td><td>{e.bookings}</td><td>{formatCurrency(e.credits)}</td><td>{formatCurrency(e.reversals)}</td><td><strong>{formatCurrency(e.balance)}</strong></td></tr>)}</tbody></table></div>}
      </section>
      <section className="wallet-section"><header><div><h2>Transaction history</h2><p>{selected?selected.title:showingArchived?'All event wallets':'Current event wallets'} · {{live:'Live payments',test:'Gateway test payments',demo:'Demo payments',recorded:'Other recorded payments'}[mode]}</p></div><span>{data.pagination.total} {data.pagination.total===1?'entry':'entries'}</span></header>
        {!data.entries.length?<div className="wallet-empty"><Icon name="ticket" size={32}/><h3>No transactions yet</h3><p>Verified bookings will appear here automatically for the selected payment type.</p></div>:<div className="wallet-table-scroll"><table><thead><tr><th>Transaction</th><th>Event</th><th>Booking</th><th>Date</th><th>Amount</th></tr></thead><tbody>{data.entries.map(entry=><tr key={entry.id}><td><span className={`wallet-entry-type ${entry.entry_type}`}>{Number(entry.amount)>=0?'↙':'↗'}</span>{reasons[entry.reason]}<small>#{entry.id}</small></td><td>{entry.event_title}</td><td>{entry.order_id?<Link to={`/admin/orders/${entry.order_id}`}>{entry.booking_ref}</Link>:<span>Withdrawal {entry.withdrawal_id?.slice(0,8)}</span>}</td><td>{formatDateTime(entry.created_at)}</td><td className={Number(entry.amount)>=0?'wallet-credit':'wallet-reversal'}>{Number(entry.amount)>0?'+':''}{formatCurrency(entry.amount)}</td></tr>)}</tbody></table></div>}
        {data.pagination.pages>1&&<div className="wallet-pagination"><button disabled={Number(page)<=1} onClick={()=>{const next=new URLSearchParams(params);next.set('page',String(Number(page)-1));setParams(next);}}>Previous</button><span>Page {page} of {data.pagination.pages}</span><button disabled={Number(page)>=data.pagination.pages} onClick={()=>{const next=new URLSearchParams(params);next.set('page',String(Number(page)+1));setParams(next);}}>Next</button></div>}
      </section>
      <p className="wallet-footnote">Opening entries include bookings marked paid when wallets were introduced. Older cancelled and refunded bookings are excluded. Gateway refunds update the wallet after the provider confirms the refund. Older demo reversals are accounting records only.</p>
    </>}
  </div>;
}
