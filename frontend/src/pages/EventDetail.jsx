import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { Spinner, Alert, GlowOrbs } from '../components/ui';
import { formatDate, formatTime, formatDateTime, formatCurrency, categoryGradient } from '../utils/format';

export default function EventDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [selection, setSelection] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/events/${slug}`);
        setEvent(data.data.event);
        setTicketTypes(data.data.ticketTypes);
      } catch (err) {
        setError(err.response?.data?.message || 'Event not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const totalQty = useMemo(() => Object.values(selection).reduce((a, b) => a + b, 0), [selection]);
  const totalAmount = useMemo(
    () => ticketTypes.reduce((sum, tt) => sum + (selection[tt.id] || 0) * Number(tt.price), 0),
    [selection, ticketTypes]
  );

  function setQty(ttId, delta, max) {
    setSelection((prev) => {
      const next = Math.min(Math.max((prev[ttId] || 0) + delta, 0), Math.min(max, 10));
      return { ...prev, [ttId]: next };
    });
  }

  function handleCheckout() {
    if (totalQty === 0) return;
    const items = Object.entries(selection)
      .filter(([, qty]) => qty > 0)
      .map(([ticket_type_id, qty]) => {
        const tt = ticketTypes.find((t) => t.id === Number(ticket_type_id));
        return { ticket_type_id: Number(ticket_type_id), qty, name: tt.name, price: Number(tt.price) };
      });
    navigate(`/checkout/${slug}`, { state: { event, items, totalAmount, totalQty } });
  }

  if (loading) return <Spinner label="Loading event…" />;
  if (error)
    return (
      <main className="mx-auto max-w-2xl px-4 py-20">
        <Alert>{error}</Alert>
        <div className="mt-4 text-center">
          <Link to="/" className="font-semibold text-indigo-300 hover:underline">
            ← Back to all events
          </Link>
        </div>
      </main>
    );

  return (
    <main>
      {/* ============ CINEMATIC HERO ============ */}
      <section className={`relative h-[380px] overflow-hidden bg-gradient-to-br ${categoryGradient(event.category)}`}>
        {event.banner_image && <img src={event.banner_image} alt={event.title} className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/10" />

        <Link
          to="/"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/60 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-slate-950/90"
        >
          ←
        </Link>

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8">
          <div className="animate-fade-up">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white ring-1 ring-white/25 backdrop-blur">
              {event.category}
            </span>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              {event.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <HeroChip>📅 {formatDate(event.start_datetime)}</HeroChip>
              <HeroChip>🕐 {formatTime(event.start_datetime)}</HeroChip>
              <HeroChip>📍 {event.venue}, {event.city}</HeroChip>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CONTENT ============ */}
      <div className="relative">
        <GlowOrbs />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_400px]">
          {/* Left: about */}
          <div className="space-y-5">
            <div className="rounded-3xl bg-white/[0.04] p-7 ring-1 ring-white/10 backdrop-blur">
              <h2 className="font-display text-xl font-bold text-white">About this event</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-400">
                {event.description || 'No description available.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard icon="🕒" label="Doors open" value={formatDateTime(event.start_datetime)} />
              {event.end_datetime && <InfoCard icon="🏁" label="Ends" value={formatDateTime(event.end_datetime)} />}
              <InfoCard icon="🏙️" label="City" value={event.city} />
              <InfoCard icon="🎫" label="Ticket types" value={`${ticketTypes.length} available`} />
            </div>
          </div>

          {/* Right: booking panel */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <div className="overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10 backdrop-blur">
              <div className="border-b border-white/5 p-6 pb-4">
                <h2 className="font-display text-xl font-bold text-white">Select tickets</h2>
                <p className="mt-0.5 text-sm text-slate-500">Max 10 per ticket type</p>
              </div>

              <div className="space-y-3 p-6 pt-4">
                {ticketTypes.map((tt) => {
                  const soldOut = tt.available === 0;
                  const ended = !tt.is_on_sale;
                  const qty = selection[tt.id] || 0;
                  const pct = tt.quantity ? Math.min(Math.round((tt.sold / tt.quantity) * 100), 100) : 0;
                  const selected = qty > 0;

                  return (
                    <div
                      key={tt.id}
                      className={`rounded-2xl border p-4 transition ${
                        selected
                          ? 'border-indigo-400/50 bg-indigo-500/10 ring-1 ring-indigo-400/30'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-white">{tt.name}</p>
                          {tt.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{tt.description}</p>}
                          {soldOut ? (
                            <p className="mt-1.5 text-xs font-bold text-rose-400">Sold out</p>
                          ) : ended ? (
                            <p className="mt-1.5 text-xs font-bold text-slate-500">Sales ended</p>
                          ) : tt.available < 20 ? (
                            <p className="mt-1.5 text-xs font-bold text-amber-300">🔥 Only {tt.available} left!</p>
                          ) : (
                            <p className="mt-1.5 text-xs text-slate-500">{tt.available} available</p>
                          )}
                        </div>
                        <p className="shrink-0 font-display text-xl font-extrabold text-gradient">
                          {formatCurrency(tt.price)}
                        </p>
                      </div>

                      {/* capacity bar */}
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={`h-full rounded-full ${pct >= 80 ? 'bg-gradient-to-r from-amber-400 to-rose-500' : 'bg-gradient-to-r from-indigo-500 to-fuchsia-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {!soldOut && !ended && (
                        <div className="mt-3.5 flex items-center justify-end gap-3">
                          <button
                            onClick={() => setQty(tt.id, -1, tt.available)}
                            disabled={qty === 0}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-lg font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-25"
                          >
                            −
                          </button>
                          <span className="w-7 text-center font-display text-lg font-extrabold text-white">{qty}</span>
                          <button
                            onClick={() => setQty(tt.id, 1, tt.available)}
                            disabled={qty >= Math.min(tt.available, 10)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white ring-1 ring-white/15 transition hover:bg-indigo-500 hover:ring-indigo-400 disabled:opacity-25"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* total + CTA */}
              <div className="border-t border-white/5 bg-slate-950/40 p-6">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>
                    {totalQty} ticket{totalQty === 1 ? '' : 's'} selected
                  </span>
                  <span className="font-display text-2xl font-extrabold text-white">{formatCurrency(totalAmount)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={totalQty === 0}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-4 font-display font-bold text-white shadow-[0_12px_40px_-10px_rgba(139,92,246,0.6)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
                >
                  {totalQty === 0 ? 'Select tickets to continue' : `Checkout · ${formatCurrency(totalAmount)}`}
                </button>
                <p className="mt-3 text-center text-xs text-slate-600">🔒 Secure checkout · Instant e-tickets</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function HeroChip({ children }) {
  return (
    <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur">
      {children}
    </span>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3.5 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-200">{value}</p>
      </div>
    </div>
  );
}
