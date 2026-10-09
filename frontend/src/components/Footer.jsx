import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="no-print relative border-t border-white/5 bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg">
              🎟️
            </span>
            <span className="font-display text-lg font-extrabold text-white">
              Ticket<span className="text-gradient">Flow</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
            Discover events, book in seconds, and get your e-tickets instantly — all in one place.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Explore</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/" className="text-slate-400 transition hover:text-white">Browse events</Link></li>
            <li><Link to="/my-bookings" className="text-slate-400 transition hover:text-white">Find my booking</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Built with</h4>
          <div className="mt-4 flex flex-wrap gap-2">
            {['React', 'Vite', 'Tailwind', 'Express', 'MySQL', 'XAMPP'].map((t) => (
              <span key={t} className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-white/10">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 py-5 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} TicketFlow — Event Ticketing System
      </div>
    </footer>
  );
}
