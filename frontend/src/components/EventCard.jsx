import { Link } from 'react-router-dom';
import { formatCurrency, categoryGradient } from '../utils/format';

export default function EventCard({ event, index = 0 }) {
  const start = new Date(String(event.start_datetime).replace(' ', 'T'));
  const day = start.getDate();
  const month = start.toLocaleString('en-US', { month: 'short' }).toUpperCase();

  return (
    <Link
      to={`/events/${event.slug}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="animate-fade-up group relative overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10 backdrop-blur transition duration-300 hover:-translate-y-1.5 hover:ring-indigo-400/40 hover:shadow-[0_24px_60px_-16px_rgba(99,102,241,0.4)]"
    >
      {/* Banner */}
      <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${categoryGradient(event.category)}`}>
        {event.banner_image ? (
          <img
            src={event.banner_image}
            alt={event.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="dot-grid absolute inset-0 flex items-center justify-center text-6xl transition duration-500 group-hover:scale-110">
            {categoryEmoji(event.category)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

        {/* date chip */}
        <div className="absolute left-4 top-4 rounded-2xl bg-slate-950/70 px-3 py-1.5 text-center backdrop-blur-md ring-1 ring-white/20">
          <p className="text-[10px] font-bold tracking-widest text-fuchsia-300">{month}</p>
          <p className="font-display text-xl font-extrabold leading-none text-white">{day}</p>
        </div>

        {/* category chip */}
        <span className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/20">
          {event.category || 'Event'}
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        <h3 className="line-clamp-1 font-display text-lg font-bold text-white transition group-hover:text-indigo-300">
          {event.title}
        </h3>
        <p className="mt-1.5 line-clamp-1 text-sm text-slate-400">
          📍 {event.venue}, {event.city}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-slate-500">From</span>
            <span className="font-display text-lg font-extrabold text-gradient">
              {event.min_price != null ? formatCurrency(event.min_price) : '—'}
            </span>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-indigo-300 ring-1 ring-white/10 transition duration-300 group-hover:bg-gradient-to-br group-hover:from-indigo-500 group-hover:to-fuchsia-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-500/40">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

function categoryEmoji(category = '') {
  const map = { Music: '🎵', Sports: '🏃', Comedy: '🎭', Conference: '🎤', Food: '🍽️', Theatre: '🎬', Art: '🎨' };
  return map[category] || '🎪';
}
