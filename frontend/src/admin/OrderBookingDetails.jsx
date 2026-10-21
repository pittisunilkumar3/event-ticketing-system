import TaxBreakdown from '../components/TaxBreakdown';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import Icon from '../components/Icon';
import AttendeeAnswers from '../components/AttendeeAnswers';
import {formatDateTime,formatCurrency,StatusBadge} from '../utils/format';
import IssuedTicketPreview from './IssuedTicketPreview';
import '../pages/checkoutAttendees.css';
import './orderDetails.css';

export default function OrderBookingDetails({data,notice,actionLoading,onAction,onDownload}) {
 const {order,tickets=[],attendees=[]}=data;
 const [previewId,setPreviewId]=useState(null);
 const preview=tickets.find(t=>t.id===previewId);
 const demo=['mock','razorpay_test'].includes(order.payment_method);
 const active=data.payment?order.status==='paid':['paid','pending'].includes(order.status);
 const issuedPeople=new Set(tickets.map(t=>t.attendee_id).filter(Boolean));
 const waiting=attendees.filter(p=>!issuedPeople.has(p.id));
 const voided=['cancelled','refunded'].includes(order.status);
 return <div className="booking-detail">
  <Link className="booking-back" to={demo&&data.separate_test_bookings?'/admin/orders?booking_group=test':'/admin/orders'}>← All orders</Link>
  <header className="booking-heading"><div><span className="booking-eyebrow">BOOKING DETAILS</span><h1>{order.booking_ref}</h1><p>Booked {formatDateTime(order.created_at)}</p></div><StatusBadge status={order.status}/></header>
  {notice&&<p className="booking-notice" role="status">{notice}</p>}
  {demo&&<p className="booking-demo"><Icon name="ticket" size={18}/><span><strong>{order.payment_method==='mock'?'Demo booking':'Test payment'}</strong> · No real payment was collected.</span></p>}
  {data.payment&&<p className="booking-notice">Razorpay · {data.payment.mode} · {data.payment.status.replaceAll('_',' ')}{order.status==='pending'&&' · Unpaid reservations expire after 15 minutes.'}</p>}
  <section className="booking-overview" aria-label="Booking summary">
   <div className="booking-event"><span className="booking-eyebrow">EVENT</span><h2>{order.event_title}</h2><p><Icon name="calendar" size={16}/>{formatDateTime(order.event_start)}</p><p><Icon name="pin" size={16}/>{[order.venue,order.city].filter(Boolean).join(', ')||'Venue to be confirmed'}</p></div>
   <TaxBreakdown value={order.tax_snapshot} currency={order.currency}/>
   <div className="booking-totals">{order.coupon_code&&<><div><span>Subtotal</span><strong>{formatCurrency(order.subtotal_amount,order.currency)}</strong></div><div><span>Discount · {order.coupon_code}</span><strong>−{formatCurrency(order.discount_amount,order.currency)}</strong></div></>}<div><span>Booking total</span><strong>{formatCurrency(order.total_amount,order.currency)}</strong></div><div><span>Tickets issued</span><strong>{tickets.length.toString().padStart(2,'0')}</strong></div></div>
   <div className="booking-contact"><span className="booking-eyebrow">CONTACT DETAILS</span><strong>{order.customer_name}</strong>{order.email&&<span>{order.email}</span>}{order.phone&&<span>{order.phone}</span>}</div>
  </section>
  {data.registration&&<section className="booking-registration"><h2>{data.registration.form.config.title}</h2><AttendeeAnswers answers={data.registration.answers} onDownload={answer=>onDownload(answer)}/></section>}
  <section className="booking-guests" aria-label="Attendees and tickets"><header><div><h2>Attendees & tickets</h2><p>Each guest has an individual ticket and QR code.</p></div><span>{tickets.length} {tickets.length===1?'ticket':'tickets'}</span></header>
   <div className="booking-guest-grid">{tickets.map((ticket,index)=>{
    const person=attendees.find(p=>p.id===ticket.attendee_id);
    const name=ticket.attendee_name||person?.name||order.customer_name;
    return <article className="booking-guest" key={ticket.id}>
     <div className="booking-guest-top"><span className="booking-guest-number">{String(index+1).padStart(2,'0')}</span><StatusBadge status={voided?'cancelled':ticket.status}/></div>
     <h3>{name}</h3><p className="booking-ticket-type">{ticket.type_name}</p>
     {(person?.email||person?.phone)&&<div className="booking-guest-contact">{person.email&&<span>{person.email}</span>}{person.phone&&<span>{person.phone}</span>}</div>}
     <div className="booking-ticket-code"><span>TICKET NUMBER</span><code>{ticket.ticket_code}</code></div>
     {!!person?.answers?.length&&<details className="booking-answers" open><summary>Registration details</summary><AttendeeAnswers answers={person.answers} onDownload={answer=>onDownload(answer,person.id)}/></details>}
     <footer><strong>{formatCurrency(ticket.design?.price??ticket.price,order.currency)}</strong><button type="button" className="booking-preview-button" aria-label={`Preview ticket for ${name}`} onClick={()=>setPreviewId(ticket.id)}><Icon name="eye" size={17}/>Preview ticket</button></footer>
    </article>;
   })}</div>
   {waiting.map(p=><article className="booking-waiting" key={p.id}><div><h3>{p.name}</h3><p>{p.type_name}</p>{p.email&&<p>{p.email}</p>}{p.phone&&<p>{p.phone}</p>}<AttendeeAnswers answers={p.answers} onDownload={answer=>onDownload(answer,p.id)}/></div><span>Ticket not issued</span></article>)}
   {!tickets.length&&<p className="booking-empty">{order.status==='pending'?'Tickets will appear here once payment is confirmed.':'No tickets have been issued for this booking.'}</p>}
  </section>
  {active&&<section className="booking-actions"><div><h2>Manage booking</h2><p>Cancelling or refunding invalidates all tickets in this booking.</p></div><div>{!data.payment&&<button type="button" disabled={!!actionLoading} onClick={()=>onAction('cancel')}>{actionLoading==='cancel'?'Cancelling…':'Cancel order'}</button>}<button type="button" disabled={!!actionLoading} onClick={()=>onAction('refund')}>{actionLoading==='refund'?'Refunding…':data.payment?.status==='refund_pending'?'Check / retry refund':'Refund order'}</button></div></section>}
  {preview&&<IssuedTicketPreview ticket={voided?{...preview,status:'cancelled'}:preview} order={order} demo={demo} onClose={()=>setPreviewId(null)}/>}
 </div>;
}
