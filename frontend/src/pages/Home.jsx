import { useEffect, useState } from 'react';
import api from '../api/client';
import EventCard from '../components/EventCard';
import { Spinner, EmptyState, Alert, GlowOrbs } from '../components/ui';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({ categories: [], cities: [] });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(loadEvents, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [search, category, city]); // eslint-disable-line

  async function loadEvents() {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (city) params.city = city;
      const { data } = await api.get('/events', { params });
      setEvents(data.data.events);
      setFilters(data.data.filters);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <GlowOrbs />
        <div className="dot-grid absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-24 text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold text-indigo-300 ring-1 ring-white/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {events.length} live events open for booking
          </div>

          <h1
            className="animate-fade-up mx-auto mt-6 max-w-3xl font-display text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Tickets to
            <span className="text-gradient"> unforgettable </span>
            moments.
          </h1>

          <p className="animate-fade-up mx-auto mt-5 max-w-xl text-lg text-slate-400" style={{ animationDelay: '160ms' }}>
            Concerts, conferences, marathons and more — book in seconds, get instant e-tickets.
          </p>

          {/* Search */}
          <div className="animate-fade-up relative mx-auto mt-9 max-w-2xl" style={{ animationDelay: '240ms' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, venues, cities…"
              className="w-full rounded-2xl border-0 bg-white/[0.06] px-6 py-4.5 pl-14 text-white placeholder-slate-500 ring-1 ring-white/15 backdrop-blur transition focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg">🔍</span>
          </div>
        </div>
      </section>

      {/* ============ FILTERS ============ */}
      <div className="no-print sticky top-16 z-30 border-y border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3.5">
          <Chip active={!category} onClick={() => setCategory('')}>
            All
          </Chip>
          {filters.categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? '' : c)}>
              {c}
            </Chip>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="cursor-pointer rounded-full bg-white/[0.05] px-4 py-2 text-sm text-slate-300 ring-1 ring-white/10 transition hover:text-white focus:outline-none [&>option]:bg-slate-900"
            >
              <option value="">All cities</option>
              {filters.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {(search || category || city) && (
              <button
                onClick={() => {
                  setSearch('');
                  setCategory('');
                  setCity('');
                }}
                className="rounded-full bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30 transition hover:bg-rose-500/20"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============ EVENTS GRID ============ */}
      <main className="mx-auto max-w-6xl px-4 py-10">
        {loading ? (
          <Spinner label="Finding events…" />
        ) : error ? (
          <Alert>{error}</Alert>
        ) : events.length === 0 ? (
          <EmptyState
            title="No events found"
            subtitle="Try adjusting your search or filters — or check back soon for new events!"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        )}
      </main>

      {/* ============ HOW IT WORKS ============ */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-center font-display text-2xl font-extrabold text-white">
          Book in <span className="text-gradient">3 easy steps</span>
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            { icon: '🔎', title: 'Find your event', desc: 'Search by city, category or vibe.' },
            { icon: '🎟️', title: 'Pick your tickets', desc: 'Choose quantities and checkout securely.' },
            { icon: '📱', title: 'Get instant e-tickets', desc: 'QR tickets ready to scan at the gate.' },
          ].map((s, i) => (
            <div
              key={i}
              className="animate-fade-up relative overflow-hidden rounded-3xl bg-white/[0.03] p-6 ring-1 ring-white/10"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <span className="absolute -right-3 -top-5 font-display text-7xl font-extrabold text-white/[0.04]">
                {i + 1}
              </span>
              <span className="text-3xl">{s.icon}</span>
              <h3 className="mt-3 font-display font-bold text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25'
          : 'bg-white/[0.05] text-slate-400 ring-1 ring-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
