import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Alert, GlowOrbs } from '../components/ui';

export default function MyBookings() {
  const navigate = useNavigate();
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = ref.trim().toUpperCase();
    if (!clean) return;
    setError('');
    setChecking(true);
    try {
      const { data } = await api.get(`/bookings/${clean}`);
      navigate(`/confirmation/${clean}`, { state: { fresh: data.data } });
    } catch (err) {
      setError(err.response?.data?.message || 'Booking not found. Check your reference.');
      setChecking(false);
    }
  }

  return (
    <main className="relative">
      <GlowOrbs />
      <div className="relative mx-auto max-w-xl px-4 py-20">
        <div className="animate-fade-up overflow-hidden rounded-3xl bg-white/[0.04] p-9 ring-1 ring-white/10 backdrop-blur">
          <div className="text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 text-4xl ring-1 ring-white/10">
              🔎
            </span>
            <h1 className="mt-5 font-display text-2xl font-extrabold text-white">Find my booking</h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter the booking reference from your confirmation
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="TKT-XXXXXXX"
              className="w-full rounded-2xl bg-white/[0.05] px-5 py-4 text-center font-mono text-lg font-bold uppercase tracking-[0.2em] text-white placeholder-slate-600 ring-1 ring-white/10 transition focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
            {error && <Alert>{error}</Alert>}
            <button
              type="submit"
              disabled={checking || !ref.trim()}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-4 font-display font-bold text-white shadow-[0_12px_40px_-10px_rgba(139,92,246,0.6)] transition hover:opacity-90 disabled:opacity-40"
            >
              {checking ? 'Searching…' : 'View my tickets →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
