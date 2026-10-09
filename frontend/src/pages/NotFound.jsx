import { Link } from 'react-router-dom';
import { GlowOrbs } from '../components/ui';

export default function NotFound() {
  return (
    <main className="relative flex flex-col items-center justify-center px-4 py-28 text-center">
      <GlowOrbs />
      <div className="relative">
        <span className="animate-float inline-block text-7xl">🎫</span>
      </div>
      <h1 className="mt-6 font-display text-4xl font-extrabold text-white">
        4<span className="text-gradient">0</span>4
      </h1>
      <p className="mt-3 max-w-sm text-slate-500">
        This page didn't make the guest list. Let's get you back to the action.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-7 py-3.5 font-display font-bold text-white shadow-[0_12px_40px_-10px_rgba(139,92,246,0.6)] transition hover:opacity-90"
      >
        Back to events
      </Link>
    </main>
  );
}
