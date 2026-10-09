import { useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { Alert, GlowOrbs } from '../components/ui';
import { formatCurrency, categoryGradient } from '../utils/format';

export default function Checkout() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();

  const [form, setForm] = useState({ customer_name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!state?.items?.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20">
        <Alert type="info">No tickets selected. Please pick your tickets first.</Alert>
        <div className="mt-4 text-center">
          <Link to={`/events/${slug}`} className="font-semibold text-indigo-300 hover:underline">
            ← Back to event
          </Link>
        </div>
      </main>
    );
  }

  const { event, items, totalAmount, totalQty } = state;

  function setField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.customer_name.trim() || !form.email.trim()) {
      setError('Please fill in your name and email.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/orders', {
        event_id: event.id,
        customer_name: form.customer_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        items: items.map(({ ticket_type_id, qty }) => ({ ticket_type_id, qty })),
      });
      navigate(`/confirmation/${data.data.order.booking_ref}`, {
        state: { fresh: data.data, email: form.email.trim() },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="relative">
      <GlowOrbs />
      <div className="relative mx-auto max-w-5xl px-4 py-10">
        <button
          onClick={() => navigate(-1)}
          className="no-print mb-5 text-sm font-medium text-slate-500 transition hover:text-indigo-300"
        >
          ← Back
        </button>

        <h1 className="font-display text-3xl font-extrabold text-white">
          Secure <span className="text-gradient">checkout</span>
        </h1>
        <p className="mt-1.5 text-slate-500">Almost there — confirm your details to get your e-tickets.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Form */}
          <form onSubmit={handleSubmit} className="h-fit rounded-3xl bg-white/[0.04] p-7 ring-1 ring-white/10 backdrop-blur">
            <h2 className="font-display text-lg font-bold text-white">Your details</h2>
            <div className="mt-5 space-y-4">
              <Field label="Full name" name="customer_name" value={form.customer_name} onChange={setField} placeholder="John Doe" required />
              <Field
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={setField}
                placeholder="john@example.com"
                required
                hint="E-tickets will be linked to this email"
              />
              <Field label="Phone (optional)" name="phone" value={form.phone} onChange={setField} placeholder="555-0100" />
            </div>

            {/* Payment */}
            <div className="mt-7 rounded-2xl border border-indigo-400/25 bg-indigo-500/[0.07] p-5">
              <p className="flex items-center gap-2 font-display font-bold text-white">💳 Payment method</p>
              <label className="mt-4 flex cursor-pointer items-center gap-3.5 rounded-xl bg-slate-950/60 p-4 ring-1 ring-indigo-400/30">
                <input type="radio" checked readOnly className="h-4 w-4 accent-indigo-500" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-white">Demo Payment — instant</span>
                  <span className="text-xs text-slate-500">Mock gateway · Stripe-ready architecture</span>
                </span>
                <span className="text-2xl">⚡</span>
              </label>
            </div>

            {error && (
              <div className="mt-5">
                <Alert>{error}</Alert>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-7 w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-4 font-display text-lg font-bold text-white shadow-[0_12px_40px_-10px_rgba(139,92,246,0.6)] transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Processing payment…
                </span>
              ) : (
                `Pay ${formatCurrency(totalAmount)} & Get Tickets`
              )}
            </button>
          </form>

          {/* Summary */}
          <aside className="h-fit overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10 backdrop-blur lg:sticky lg:top-24">
            <div className={`relative h-24 bg-gradient-to-br ${categoryGradient(event.category)}`}>
              {event.banner_image && <img src={event.banner_image} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
              <p className="absolute bottom-3 left-5 right-5 font-display font-bold text-white">{event.title}</p>
            </div>

            <div className="p-6">
              <p className="text-xs text-slate-500">📍 {event.venue}, {event.city}</p>

              <div className="mt-4 space-y-2.5 border-t border-white/5 pt-4">
                {items.map((item) => (
                  <div key={item.ticket_type_id} className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      {item.qty}× {item.name}
                    </span>
                    <span className="font-semibold text-slate-200">{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="font-display font-bold text-white">Total ({totalQty})</span>
                <span className="font-display text-2xl font-extrabold text-gradient">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-500/[0.07] p-3 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
                🔒 Tickets are issued instantly after payment
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({ label, name, type = 'text', value, onChange, placeholder, required, hint }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-300">
        {label} {required && <span className="text-fuchsia-400">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-slate-500 ring-1 ring-white/10 transition focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
      />
      {hint && <p className="mt-1.5 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}
