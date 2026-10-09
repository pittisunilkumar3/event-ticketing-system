import { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import DesignedTicket from '../components/DesignedTicket';
import '../admin/studio/studio.css';
import api from '../api/client';
import { Spinner, Alert } from '../components/ui';
import { formatCurrency } from '../utils/format';

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

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <span>Booking <strong className="font-mono text-white">{order.booking_ref}</strong> · {order.status}</span>
        <span>{tickets.length} ticket(s) · {formatCurrency(order.total_amount)}</span>
      </div>
      <div className="print-tickets space-y-7">
        {tickets.map(ticket => <DesignedTicket key={ticket.id} ticket={ticket} order={order} design={ticket.design || {}} />)}
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
