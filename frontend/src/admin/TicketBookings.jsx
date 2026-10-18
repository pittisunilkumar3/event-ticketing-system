import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import api from '../api/client';
import {Alert,Spinner} from '../components/ui';
import {formatDateTime,StatusBadge} from '../utils/format';
import IssuedTicketPreview from './IssuedTicketPreview';
import './orderDetails.css';
import './ticketBookings.css';

export function TicketRows({tickets,onPreview,previewLoading}) {
 return <div className="ticket-report-table"><table><thead><tr><th>Attendee</th><th>Ticket</th><th>Event / pass</th><th>Booking</th><th>Check-in</th><th>Booked</th><th><span className="sr-only">Actions</span></th></tr></thead>
 <tbody>{tickets.map(ticket=><tr key={ticket.id}>
  <td><strong>{ticket.attendee_name||'Name not recorded'}</strong><span>{ticket.attendee_email||'Email not recorded'}</span><span>{ticket.attendee_phone||'Phone not recorded'}</span></td>
  <td><code>{ticket.ticket_code}</code></td>
  <td><strong>{ticket.type_name}</strong><span>{ticket.event_title}</span></td>
  <td><Link to={'/admin/orders/'+ticket.order_id}>{ticket.booking_ref}</Link><span><StatusBadge status={ticket.order_status}/></span></td>
  <td><StatusBadge status={ticket.ticket_status}/>{ticket.checked_in_at&&<span>{formatDateTime(ticket.checked_in_at)}</span>}</td>
  <td>{formatDateTime(ticket.booked_at)}</td>
  <td><button type="button" onClick={()=>onPreview(ticket)} disabled={!!previewLoading} aria-label={'View ticket for '+(ticket.attendee_name||ticket.ticket_code)}>{previewLoading===ticket.id?'Opening…':'View ticket'}</button></td>
 </tr>)}</tbody></table></div>;
}

export default function TicketBookings() {
 const [params,setParams]=useSearchParams();
 const queryString=params.toString();
 const eventId=params.get('event_id')||'';
 const [result,setResult]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [choices,setChoices]=useState({events:[],ticketTypes:[]}),[choicesError,setChoicesError]=useState('');
 const [exporting,setExporting]=useState(false),[actionError,setActionError]=useState('');
 const [preview,setPreview]=useState(null),[previewLoading,setPreviewLoading]=useState(null);
 function change(key,value){const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);if(key!=='page')next.delete('page');if(key==='event_id')next.delete('ticket_type_id');setParams(next,{replace:key==='search'});}
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setActionError('');
  const query=Object.fromEntries(new URLSearchParams(queryString));delete query.view;
  const timer=setTimeout(()=>api.get('/admin/orders/tickets',{signal:controller.signal,params:query}).then(r=>{if(!controller.signal.aborted)setResult(r.data.data);}).catch(e=>{if(!controller.signal.aborted){setResult(null);setError(e.response?.data?.message||'Unable to load individual tickets.');}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);}),query.search?300:0);
  return()=>{clearTimeout(timer);controller.abort();};
 },[queryString]);
 useEffect(()=>{
  const controller=new AbortController();setChoicesError('');setChoices(previous=>({...previous,ticketTypes:[]}));
  api.get('/admin/orders/tickets/options',{signal:controller.signal,params:{event_id:eventId||undefined}}).then(r=>{if(!controller.signal.aborted)setChoices(r.data.data);}).catch(()=>{if(!controller.signal.aborted)setChoicesError('Unable to load event and pass filters. Refresh the page to try again.');});
  return()=>controller.abort();
 },[eventId]);
 useEffect(()=>{if(!previewLoading)return;const controller=new AbortController();
  api.get('/admin/orders/'+previewLoading.order_id,{signal:controller.signal}).then(r=>{
   if(controller.signal.aborted)return;
   const ticket=r.data.data.tickets.find(t=>t.id===previewLoading.id);
   if(!ticket)throw new Error('This ticket is no longer available.');
   const order=r.data.data.order;
   setPreview({ticket:['cancelled','refunded'].includes(order.status)?{...ticket,status:'cancelled'}:ticket,order,demo:['mock','razorpay_test'].includes(order.payment_method)});
  }).catch(e=>{if(!controller.signal.aborted)setActionError(e.response?.data?.message||e.message||'Unable to open this ticket.');}).finally(()=>{if(!controller.signal.aborted)setPreviewLoading(null);});
  return()=>controller.abort();
 },[previewLoading]);
 async function exportTickets(){
  setExporting(true);setActionError('');
  try{
   const query=Object.fromEntries(params);delete query.view;delete query.page;delete query.limit;
   const response=await api.get('/admin/orders/tickets/export',{params:query,responseType:'blob'});
   const url=URL.createObjectURL(response.data),link=document.createElement('a');
   link.href=url;link.download='individual-tickets-'+(params.get('booking_group')==='test'?'test':'real')+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){let message='Unable to export tickets. Please try again.';try{if(e.response?.data instanceof Blob)message=JSON.parse(await e.response.data.text()).message||message;}catch{}setActionError(message);}
  finally{setExporting(false);}
 }
 const pagination=result?.pagination;
 const group=params.get('booking_group')==='test'?'test':'real';
 return <div className="ticket-report">
  <div className="ticket-report-intro"><div><h2>Individual tickets</h2><p>One row per issued ticket. Pending bookings appear here after tickets are issued.</p></div><button className="ticket-report-export" type="button" disabled={exporting||loading||!!error||!pagination?.total} onClick={exportTickets}>{exporting?'Exporting…':'Export CSV'}</button></div>
  <div className="ticket-report-filters">
   <label className="ticket-report-search">Search tickets<input type="search" maxLength={200} value={params.get('search')||''} onChange={e=>change('search',e.target.value)} placeholder="Name, email, phone, ticket or booking number"/></label>
   <label>Booking type<select value={group} onChange={e=>change('booking_group',e.target.value)}><option value="real">Real bookings</option><option value="test">Test & demo</option></select></label>
   <label>Event<select value={eventId} onChange={e=>change('event_id',e.target.value)}><option value="">All events</option>{choices.events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
   <label>Pass<select value={params.get('ticket_type_id')||''} disabled={!eventId} onChange={e=>change('ticket_type_id',e.target.value)}><option value="">{eventId?'All passes':'Choose an event first'}</option>{choices.ticketTypes.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
   <label>Booking status<select value={params.get('status')||''} onChange={e=>change('status',e.target.value)}><option value="">All booking statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option><option value="refunded">Refunded</option></select></label>
   <label>Check-in status<select value={params.get('ticket_status')||''} onChange={e=>change('ticket_status',e.target.value)}><option value="">All ticket statuses</option><option value="valid">Valid / not checked in</option><option value="checked_in">Checked in</option><option value="cancelled">Cancelled / refunded</option><option value="pending">Awaiting payment</option></select></label>
   <label>Booked from<input type="date" value={params.get('from')||''} onChange={e=>change('from',e.target.value)}/></label>
   <label>Booked through<input type="date" min={params.get('from')||undefined} value={params.get('to')||''} onChange={e=>change('to',e.target.value)}/></label>
  </div>
  <div className="ticket-report-summary"><p aria-live="polite">{loading?'Loading tickets…':pagination?`${pagination.total} ${pagination.total===1?'ticket':'tickets'} · ${group==='test'?'Test & demo':'Real bookings'}`:''}</p><button type="button" onClick={()=>setParams({view:'tickets',...(group==='test'?{booking_group:'test'}:{})})}>Clear filters</button></div>
  {choicesError&&<Alert>{choicesError}</Alert>}{error&&<Alert>{error}</Alert>}{actionError&&<Alert>{actionError}</Alert>}
  {loading?<Spinner/>:!error&&(result?.tickets.length?<TicketRows tickets={result.tickets} onPreview={ticket=>{setActionError('');setPreviewLoading(ticket);}} previewLoading={previewLoading?.id}/>:<div className="ticket-report-empty"><h3>No matching tickets</h3><p>Try another filter or check the order view for bookings awaiting payment.</p></div>)}
  {!loading&&pagination?.pages>1&&<nav className="ticket-report-pagination" aria-label="Ticket pages"><button type="button" disabled={pagination.page<=1} onClick={()=>change('page',String(pagination.page-1))}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button type="button" disabled={pagination.page>=pagination.pages} onClick={()=>change('page',String(pagination.page+1))}>Next</button></nav>}
  {preview&&<IssuedTicketPreview {...preview} onClose={()=>setPreview(null)}/>}
 </div>;
}
