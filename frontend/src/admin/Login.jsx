import { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import api from '../api/client';
import { Alert } from '../components/ui';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (localStorage.getItem('admin_token')) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('admin_token', data.data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.data.admin));
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* glow orbs */}
      <div className="pointer-events-none absolute -top-32 left-[15%] h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-[10%] h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
      <div className="dot-grid absolute inset-0" aria-hidden="true" />

      <div className="relative w-full max-w-md">
        <div className="text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-3xl shadow-xl shadow-indigo-500/30">
            🎟️
          </span>
          <h1 className="mt-5 font-display text-2xl font-extrabold text-white">
            Ticket<span className="text-indigo-400">Flow</span> Admin
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">Sign in to manage your events</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-3xl bg-white/[0.04] p-8 ring-1 ring-white/10 backdrop-blur-xl">
          {error && <Alert>{error}</Alert>}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-300">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin@ticketing.com"
              className="w-full rounded-xl bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-slate-600 ring-1 ring-white/10 transition focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-300">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="w-full rounded-xl bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-slate-600 ring-1 ring-white/10 transition focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3.5 font-display font-bold text-white shadow-[0_12px_40px_-10px_rgba(139,92,246,0.6)] transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Signing in…
              </span>
            ) : (
              'Sign In →'
            )}
          </button>
          <div className="rounded-xl bg-white/[0.03] px-4 py-3 text-center text-xs text-slate-500 ring-1 ring-white/5">
            Demo credentials: <span className="font-mono text-slate-400">admin@ticketing.com / admin123</span>
          </div>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-slate-500 transition hover:text-white">
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  );
}
