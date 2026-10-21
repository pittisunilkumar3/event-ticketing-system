import Icon from '../components/Icon';
import {formatCurrency, formatDate} from '../utils/format';
import {canSelectTicket, isVisibleTicket, ticketLimit, validQuantity} from './ticketSelection';
const saleLabels={on_sale:'Available',scheduled:'Coming soon',ended:'Sales ended',sold_out:'Sold out',unavailable:'Unavailable'};
export default function EventTickets({ticketTypes,selection,onQuantity,onCheckout}) {
 const selected=ticketTypes.filter(t=>validQuantity(t,selection[t.id])>0);
 const quantity=selected.reduce((sum,t)=>sum+Number(selection[t.id]),0);
 const total=selected.reduce((sum,t)=>sum+Number(selection[t.id])*Number(t.price),0);
 const tickets=ticketTypes.filter(isVisibleTicket).sort((a,b)=>Number(canSelectTicket(b))-Number(canSelectTicket(a)));
 return <section className="event-ticket-section" id="tickets" aria-labelledby="event-tickets-title">
  <header className="event-ticket-intro"><div><h2 id="event-tickets-title">Choose your tickets.</h2></div><p>Choose your tickets, then review your booking.</p></header>
  <div className="event-ticket-layout">
   <div className="event-ticket-list">
    {!tickets.length&&<div className="event-ticket-empty"><Icon name="ticket"/><h3>Tickets are on their way.</h3><p>The organizer hasn’t released tickets yet. Check back soon.</p></div>}
    {tickets.map(t=>{
     const n=validQuantity(t,selection[t.id]),available=canSelectTicket(t);
     return <article key={t.id} className={'event-pass'+(n?' is-selected':'')+(!available?' is-unavailable':'')} aria-labelledby={'pass-name-'+t.id}>
      <div className="event-pass-info"><div className="event-pass-status">{n?<span className="event-pass-selected">Selected</span>:<span>{available?'Available':saleLabels[t.sale_status]||'Unavailable'}</span>}</div><h3 id={'pass-name-'+t.id}>{t.name}</h3>{t.description?.trim()&&<details className="event-pass-details"><summary><span className="event-pass-details-show">View details</span><span className="event-pass-details-hide">Hide details</span></summary><p>{t.description}</p></details>}
       <small>{available?(Number(t.min_per_order)>1?`Minimum ${t.min_per_order} · `:'')+`Up to ${ticketLimit(t)} per booking`:t.sale_status==='scheduled'&&t.sales_start?'Sales open '+formatDate(t.sales_start):'Not available to book right now'}</small>
      </div>
      <div className="event-pass-action"><div className="event-pass-price">{Number(t.price)===0?'Free':formatCurrency(t.price)}<small>per ticket</small></div>
       {available?<div className="event-quantity" role="group" aria-label={t.name+' tickets'}><button type="button" aria-label={'Remove '+t.name+' ticket'} disabled={!n} onClick={()=>onQuantity(t,-1)}>−</button><output aria-live="polite" aria-label={t.name+' quantity'}>{n}</output><button type="button" aria-label={'Add '+t.name+' ticket'} disabled={n>=ticketLimit(t)} onClick={()=>onQuantity(t,1)}>+</button></div>:<span className="event-pass-closed">{saleLabels[t.sale_status]==='Available'?'Unavailable':saleLabels[t.sale_status]||'Unavailable'}</span>}
      </div>
     </article>;
    })}
   </div>
   <aside className="event-booking-summary" aria-label="Your selection">
    <div className="event-summary-heading"><Icon name="ticket"/><h3>Your selection</h3></div>
    {quantity?<ul className="event-summary-items">{selected.map(t=><li key={t.id}><div><strong>{t.name}</strong><span>{selection[t.id]} × {formatCurrency(t.price)}</span></div><b>{formatCurrency(selection[t.id]*Number(t.price))}</b></li>)}</ul>:<div className="event-summary-empty"><p>A great experience awaits.</p><span>Use + to add the tickets you’d like.</span></div>}
    <div className="event-summary-total" aria-live="polite" aria-atomic="true"><div><span>Ticket subtotal</span><small>{quantity?`${quantity} ticket${quantity===1?'':'s'} selected`:'No tickets selected'}</small></div><strong>{formatCurrency(total)}</strong></div>
    <button type="button" className="booking-primary" disabled={!quantity} onClick={onCheckout}>{quantity?'Continue to booking':'Choose your tickets'}<Icon name="arrow" size={18}/></button>
    <p className="event-summary-note">Review your details and final total before payment.</p>
   </aside>
  </div>
 </section>;
}
