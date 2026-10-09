import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  const linkClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
    }`;

  return (
    <header className="no-print sticky top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg shadow-lg shadow-indigo-500/30">
            🎟️
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            Ticket<span className="text-gradient">Flow</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <NavLink to="/" className={linkClass} end>
            Browse Events
          </NavLink>
          <NavLink to="/my-bookings" className={linkClass}>
            My Bookings
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
