import { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/client';
import { Spinner, Alert } from '../components/ui';
import { formatDate, formatTime, formatCurrency, categoryGradient } from '../utils/format';

export default function Confirmation() {
  const { ref } = useParams();
  const { state } = useLocation();
  const [booking, setBooking] = useState(state?.fresh || null);
  const [loading, setLoading] = useState(!state?.fresh);
  const [error, setError] = useState('');

  useEffect(() => {
    if (state?.fresh) return;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/bookings/${ref}`);
        setBooking(data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Booking not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [ref]); // eslint-disable-line

  if (loading) return <Spinner label="Loading your tickets…" />;
  if (error)
    return (
      <main className="mx-auto max-w-2xl px-4 py-20">
        <Alert>{error}</Alert>
        <div className="mt-4 text-center">
          <Link to="/my-bookings" className="font-semibold text-indigo-300 hover:underline">
            Try another reference →
          </Link>
        </div>
      </main>
    );

  const { order, tickets } = booking;
  const isFresh = Boolean(state?.fresh);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* Success banner */}
      {isFresh && (
        <div className="animate-pop no-print mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-[1.5px]">
          <div className="relative overflow-hidden rounded-[22px] bg-slate-950 px-8 py-10 text-center">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="animate-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-3xl shadow-lg shadow-emerald-500/40">
              ✓
            </div>
            <h1 className="mt-5 font-display text-3xl font-extrabold text-white">Booking Confirmed!</h1>
            <p className="mt-2 text-slate-400">
              Your e-tickets are ready. Save your reference:{' '}
              <span className="font-mono font-bold text-emerald-300">{order.booking_ref}</span>
            </p>
          </div>
        </div>
      )}

      {/* ============ THE TICKET ============ */}
      <div className="print-area keep-colors relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl ring-1 ring-white/10">
        {/* Ticket header */}
        <div className={`relative h-32 bg-gradient-to-br ${categoryGradient('')}`}>
          {order.event_banner && <img src={order.event_banner} alt="" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/20" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-7 pb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-fuchsia-300">Admit one</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">{order.event_title}</h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Booking ref</p>
              <p className="font-mono text-lg font-extrabold tracking-wider text-fuchsia-300">{order.booking_ref}</p>
            </div>
          </div>
        </div>

        {/* Event info row */}
        <div className="grid grid-cols-2 gap-4 px-7 py-5 sm:grid-cols-4">
          <Meta label="Date" value={formatDate(order.event_start)} />
          <Meta label="Time" value={formatTime(order.event_start)} />
          <Meta label="Venue" value={`${order.venue}, ${order.city}`} />
          <Meta label="Paid" value={formatCurrency(order.total_amount)} highlight />
        </div>

        {/* Perforation */}
        <div className="relative border-t-2 border-dashed border-white/15">
          <span className="absolute -left-5 -top-5 h-10 w-10 rounded-full bg-slate-950 ring-1 ring-white/10" />
          <span className="absolute -right-5 -top-5 h-10 w-10 rounded-full bg-slate-950 ring-1 ring-white/10" />
        </div>

        {/* Ticket stubs with QR */}
        <div className="grid gap-4 bg-white/[0.02] p-7 sm:grid-cols-2">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`relative overflow-hidden rounded-2xl border p-4 transition ${
                ticket.status === 'cancelled'
                  ? 'border-white/5 bg-white/[0.02] opacity-50'
                  : 'border-white/10 bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-white">{ticket.type_name}</span>
                {ticket.status === 'checked_in' ? (
                  <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300 ring-1 ring-sky-400/30">
                    Checked in
                  </span>
                ) : ticket.status === 'cancelled' ? (
                  <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 ring-1 ring-rose-400/30">
                    Cancelled
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
                    Valid
                  </span>
                )}
              </div>
              <div className="mt-3.5 flex items-center gap-4">
                <div className="rounded-xl bg-white p-2.5 shadow-lg">
                  <QRCodeSVG value={ticket.ticket_code} size={84} fgColor="#0f172a" level="M" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ticket code</p>
                  <p className="mt-0.5 break-all font-mono text-[13px] font-bold leading-snug text-slate-200">
                    {ticket.ticket_code}
                  </p>
                  <p className="mt-1.5 text-[10px] text-slate-600">Present this QR at the entrance</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Ticket footer */}
        <div className="flex items-center justify-between border-t border-white/5 px-7 py-4">
          <p className="text-xs text-slate-600">
            Customer: <span className="text-slate-400">{order.customer_name}</span>
          </p>
          <p className="font-display text-xs font-extrabold tracking-widest text-slate-600">
            TICKET<span className="text-gradient">FLOW</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="no-print mt-7 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => window.print()}
          className="rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3.5 font-display text-sm font-bold text-white shadow-[0_12px_40px_-10px_rgba(139,92,246,0.6)] transition hover:opacity-90"
        >
          🖨️ Print / Save as PDF
        </button>
        <Link
          to="/"
          className="rounded-2xl bg-white/[0.05] px-6 py-3.5 font-display text-sm font-bold text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
        >
          Browse more events
        </Link>
      </div>
    </main>
  );
}

function Meta({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? 'text-gradient font-display text-base' : 'text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}
