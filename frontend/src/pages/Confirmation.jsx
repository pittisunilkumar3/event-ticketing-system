import TaxBreakdown from '../components/TaxBreakdown';
import { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import DesignedTicket from '../components/DesignedTicket';
import CustomerState from '../components/CustomerState';
import Icon from '../components/Icon';
import '../admin/studio/studio.css';
import api from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';

const bookingStates = {
  paid: { label: 'Confirmed', title: 'Your booking, all in one place.', description: 'Keep your reference handy and have your tickets ready when you arrive.', icon: 'check' },
  pending: { label: 'Pending', title: 'Your booking is pending.', description: 'This booking is not yet confirmed. Check with the organizer before attending.', icon: 'ticket' },
  cancelled: { label: 'Cancelled', title: 'This booking was cancelled.', description: 'The tickets below are no longer valid for entry.', icon: 'ticket' },
  refunded: { label: 'Refunded', title: 'This booking was refunded.', description: 'The tickets below are no longer valid for entry.', icon: 'ticket' },
};

export default function Confirmation() {
  const { ref } = useParams();
  const { state } = useLocation();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setBooking(null);
    api.get(`/bookings/${encodeURIComponent(ref)}`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setBooking(data.data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.response?.status === 404 ? 'Check the reference on your confirmation and try again.' : 'We couldn’t load your booking right now. Please try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ref]);

  if (loading) return <CustomerState loading eyebrow="YOUR BOOKING" title="Getting your tickets ready…" description="We’re checking the latest details for your booking."/>;
  if (error || !booking) return <CustomerState eyebrow="YOUR BOOKING" title="We couldn’t open this booking." description={error} to="/my-bookings" action="Find my booking" icon="search"/>;
  return <BookingReceipt booking={booking} justBooked={Boolean(state?.fresh)}/>;
}

export function BookingReceipt({ booking, justBooked = false }) {
  const { order, tickets = [] } = booking;
  const status = bookingStates[order.status] || { label: 'Unconfirmed', title: 'Your booking details.', description: 'Contact the organizer to confirm your booking status.', icon: 'ticket' };
  const voided = order.status === 'cancelled' || order.status === 'refunded';
  const ready = order.status === 'paid';
  return (
    <main className="customer-page confirmation-page">
      <div className="confirmation-container">
        <Link className="customer-back no-print" to="/my-bookings">← Find another booking</Link>
        <header className={`confirmation-heading no-print ${ready ? 'is-confirmed' : 'is-unconfirmed'}`}>
          <span className="customer-state-icon"><Icon name={status.icon} size={27}/></span>
          <p className="customer-eyebrow">{justBooked && ready ? 'YOU’RE ON THE LIST' : 'YOUR BOOKING'}</p>
          <h1>{justBooked && ready ? 'Your next experience is booked.' : status.title}</h1>
          <p>{status.description}</p>
        </header>
        <section className="confirmation-summary no-print" aria-label="Booking details">
          <div className="confirmation-reference"><div><span>BOOKING REFERENCE</span><code>{order.booking_ref}</code></div><span className={`confirmation-status status-${order.status}`}>{status.label}</span></div>
          <div className="confirmation-event"><h2>{order.event_title}</h2>{order.event_start && <p><Icon name="calendar" size={16}/>{formatDateTime(order.event_start)}</p>}{(order.venue || order.city) && <p><Icon name="pin" size={16}/>{[order.venue, order.city].filter(Boolean).join(', ')}</p>}</div>
          <TaxBreakdown value={order.tax_snapshot} currency={order.currency}/>
          <div className="confirmation-totals">{order.coupon_code&&<><div><span>Subtotal</span><strong>{formatCurrency(order.subtotal_amount,order.currency)}</strong></div><div><span>Discount · {order.coupon_code}</span><strong>−{formatCurrency(order.discount_amount,order.currency)}</strong></div></>}<div><span>Tickets</span><strong>{tickets.length}</strong></div><div><span>Booking total</span><strong>{formatCurrency(order.total_amount,order.currency)}</strong></div></div>
        </section>
        <div className="confirmation-ticket-heading no-print"><div><h2>{voided ? 'Cancelled tickets' : 'Your tickets'}</h2><p>{ready ? 'Save a copy or print your tickets before you go.' : 'Ticket validity follows the status of your booking.'}</p></div>{tickets.length > 0 && <button className="customer-button customer-button-secondary" onClick={() => window.print()}><Icon name="printer" size={17}/>Print / Save PDF</button>}</div>
        <div className="print-tickets confirmation-tickets" style={{ '--page-bg': '#f9faf5' }}>
          {tickets.map(ticket => <DesignedTicket key={ticket.id} ticket={voided ? { ...ticket, status: 'cancelled' } : ticket} order={order} design={ticket.design || {}}/>)}
        </div>
        {tickets.length === 0 && <p className="confirmation-no-tickets">No tickets have been issued for this booking yet.</p>}
        <div className="confirmation-footer no-print"><Icon name="ticket" size={22}/><div><h3>More good moments are waiting.</h3><p>See what else is happening.</p></div><Link className="customer-text-link" to="/events">Explore events <Icon name="arrow" size={17}/></Link></div>
      </div>
    </main>
  );
}
