import {useEffect,useRef} from 'react';
import DesignedTicket from '../components/DesignedTicket';

export default function IssuedTicketPreview({ticket,order,demo,onClose}) {
 const dialog=useRef(null),close=useRef(null);
 useEffect(()=>{const previous=document.activeElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
 function keyboard(e){
  if(e.key==='Escape'){e.preventDefault();onClose();}
  if(e.key==='Tab'){const controls=[...dialog.current.querySelectorAll('button,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }
 return <div className="issued-ticket-backdrop"><section className="issued-ticket-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="issued-ticket-title" onKeyDown={keyboard}>
  <header><div><span className="booking-eyebrow">TICKET PREVIEW</span><h2 id="issued-ticket-title">{ticket.attendee_name||order.customer_name}</h2><p>{ticket.type_name} · {order.booking_ref}</p></div><button ref={close} type="button" onClick={onClose} aria-label="Close ticket preview">✕</button></header>
  <div className="issued-ticket-body">{demo&&<p className="issued-ticket-note">Demo ticket · No real payment was collected.</p>}<DesignedTicket design={ticket.design||{}} ticket={ticket} order={order}/></div>
  <footer><span>{ticket.ticket_code}</span><button type="button" onClick={onClose}>Done</button></footer>
 </section></div>;
}
