import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDateTime } from '../utils/format';

function foreground(hex) {
  const rgb=(hex || '#111111').replace('#','').match(/.{2}/g)?.map(v=>parseInt(v,16)) || [17,17,17];
  return rgb[0]*.299+rgb[1]*.587+rgb[2]*.114 > 155 ? '#171717' : '#ffffff';
}
export default function DesignedTicket({ design = {}, ticket = {}, order = {}, preview = false }) {
  const layout=design.layout || 'classic';
  const bg=layout==='minimal'?'#ffffff':design.background || '#111111';
  const ink=foreground(bg);
  return <article className={`designed-ticket ticket-layout-${layout} ${ticket.status==='cancelled'?'ticket-void':''}`} style={{'--ticket-bg':bg,'--ticket-ink':ink,'--ticket-accent':design.accent || '#f97316'}}>
    <div className="ticket-design-header">
      {design.banner_image && <img className="ticket-design-banner" src={design.banner_image} alt=""/>}
      <div className="ticket-brand-row">{design.logo ? <img className="ticket-design-logo" src={design.logo} alt={design.brand || 'TicketFlow'}/> : <strong>{design.brand || 'TicketFlow'}<span>®</span></strong>}<span>{preview?'DESIGN PREVIEW':String(ticket.status || 'valid').replace('_',' ').toUpperCase()}</span></div>
      <p className="ticket-eyebrow">{design.heading || 'YOUR NEXT GREAT EXPERIENCE'}</p>
      <h2>{order.event_title || 'Cinematica · An evening of possibilities'}</h2>
      <span className="ticket-type-label">{design.type_name || ticket.type_name || 'VIP Experience'}</span>
    </div>
    <div className="ticket-design-content"><div className="ticket-meta-grid">
      <div><small>DATE & TIME</small><strong>{order.event_start?formatDateTime(order.event_start):'Sat, Dec 12, 2026 · 6:00 PM'}</strong></div>
      <div><small>VENUE</small><strong>{order.venue || 'Main Exhibition Hall'}{order.city ? `, ${order.city}` : ''}</strong></div>
      {design.show_attendee !== false && <div><small>GUEST</small><strong>{ticket.attendee_name || order.customer_name || 'Alex Morgan'}</strong></div>}
      {design.show_price !== false && <div><small>TICKET PRICE</small><strong>{formatCurrency(design.price ?? ticket.price ?? 60)}</strong></div>}
      <div><small>BOOKING REFERENCE</small><strong>{order.booking_ref || 'TKT-PREVIEW'}</strong></div>
    </div><div className="ticket-qr"><div><QRCodeSVG value={preview?'PREVIEW-NOT-A-VALID-TICKET':ticket.ticket_code || 'INVALID'} size={108} level="M" marginSize={2} bgColor="#ffffff" fgColor="#111111"/></div><code>{preview?'PREVIEW ONLY':ticket.ticket_code}</code><small>{preview?'Not valid for entry':'SCAN AT ENTRY'}</small></div></div>
    <footer>{design.footer_text || 'Present your QR code at the entrance.'}</footer>
  </article>;
}
