import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import {watchEventContent} from '../settings/watchEventContent';
import EventCard from '../components/EventCard';
import Icon from '../components/Icon';
import './browseEvents.css';

export default function BrowseEvents() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const city = params.get('city') || '';
  const sort = params.get('sort') || 'date';
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({ categories: [], cities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const filtered = Boolean(search || category || city);

  function updateFilter(key, value) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }

  function clearFilters() {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      ['search', 'category', 'city'].forEach(key => next.delete(key));
      return next;
    }, { replace: true });
  }

  useEffect(() => {
    let timer;
    setLoading(true);
    setError('');
    const stop = watchEventContent(api.defaults.baseURL, signal => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/events', {
          params: { search: search.trim() || undefined, category: category || undefined, city: city || undefined },
          signal,
        });
        if (signal.aborted) return;
        setError('');
        setEvents(data.data.events);
        setFilters(data.data.filters);
      } catch (err) {
        if (!signal.aborted) setError(err.response?.data?.message || 'We couldn’t load events. Please try again.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    });
    return () => { clearTimeout(timer); stop(); };
  }, [search, category, city, retry]);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => {
    if (sort === 'price') {
      const priceA = a.min_price == null ? Infinity : Number(a.min_price);
      const priceB = b.min_price == null ? Infinity : Number(b.min_price);
      if (priceA !== priceB) return priceA - priceB;
    }
    const dateA = new Date(String(a.start_datetime).replace(' ', 'T')).getTime();
    const dateB = new Date(String(b.start_datetime).replace(' ', 'T')).getTime();
    return (Number.isFinite(dateA) ? dateA : Infinity) - (Number.isFinite(dateB) ? dateB : Infinity);
  }), [events, sort]);

  return (
    <main className="browse-page">
      <section className="browse-hero">
        <div className="browse-container">
          <div className="browse-intro">
            <div>
              <p className="browse-eyebrow"><span /> GO OUT. TUNE IN. SHOW UP.</p>
              <h1>Find your next<br/><span>“you had to be there.”</span></h1>
              <p className="browse-description">Big ideas. Live music. Shared moments.<br className="browse-mobile-break"/> Find something worth being there for.</p>
            </div>
            <div className="browse-hero-ticket" aria-hidden="true">
              <div className="browse-ticket-top"><Icon name="ticket" size={22}/><span>LESS SCROLLING.<br/>MORE LIVING.</span></div>
              <strong>Good times.<br/>Great company.</strong>
              <div className="browse-ticket-bottom"><span>YOUR NEXT EXPERIENCE</span><Icon name="arrow" size={22}/></div>
              <div className="browse-ticket-stub"><span>ADMIT ONE</span><div className="browse-barcode"/></div>
            </div>
          </div>
          <div className="browse-search-bar" role="search" aria-label="Find events">
            <div className="browse-search-field"><Icon name="search" size={22}/><label className="sr-only" htmlFor="event-search">Search events or venues</label><input id="event-search" type="search" autoComplete="off" placeholder="Search events or venues" value={search} onChange={e => updateFilter('search', e.target.value)}/></div>
            <div className="browse-city-field"><Icon name="pin" size={20}/><label className="sr-only" htmlFor="event-city">Filter by city</label><select id="event-city" value={city} onChange={e => updateFilter('city', e.target.value)}><option value="">All cities</option>{city && !filters.cities.includes(city) && <option value={city}>{city}</option>}{filters.cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
        </div>
      </section>

      <section className="browse-catalog browse-container" aria-labelledby="browse-results-title">
        <div className="browse-filter-row"><div className="browse-categories" role="group" aria-label="Event categories">{['', ...new Set([...filters.categories, ...(category ? [category] : [])])].map(c => <button key={c || 'all'} type="button" aria-pressed={category === c} className={category === c ? 'is-selected' : ''} onClick={() => updateFilter('category', c)}>{!c && <Icon name="grid" size={15}/>} {c || 'All events'}</button>)}</div>{filtered && <button type="button" className="browse-clear" onClick={clearFilters}>Clear filters <span aria-hidden="true">×</span></button>}</div>
        <div className="browse-results-heading"><div><p className="browse-eyebrow">MAKE ROOM FOR SOMETHING GOOD</p><h2 id="browse-results-title">{filtered ? 'Your next plans' : 'Explore events'}</h2><p className="browse-result-count" role="status" aria-live="polite">{loading ? 'Finding events…' : error ? 'Events are currently unavailable' : `${events.length} event${events.length === 1 ? '' : 's'}${filtered ? (events.length === 1 ? ' matches your filters' : ' match your filters') : ' to explore'}`}</p></div><label className="browse-sort">Sort by<select value={sort === 'price' ? 'price' : 'date'} onChange={e => updateFilter('sort', e.target.value)}><option value="date">Date: earliest first</option><option value="price">Price: low to high</option></select></label></div>
        <div aria-busy={loading}>
          {loading ? <div className="browse-grid" aria-hidden="true">{[0,1].map(i => <div className="browse-skeleton" key={i}><div/><span/><span/><span/></div>)}</div> : error ? <div className="browse-message" role="alert"><Icon name="calendar" size={32}/><h3>Let's try that again.</h3><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Try again <Icon name="arrow" size={16}/></button></div> : events.length === 0 ? <div className="browse-message"><Icon name="search" size={32}/><h3>{filtered ? 'No matches just yet.' : 'Good things are on the way.'}</h3><p>{filtered ? 'Try a different search, category, or city to find your next event.' : 'There are no published events to explore right now. Check back soon.'}</p>{filtered && <button onClick={clearFilters}>See all events <Icon name="arrow" size={16}/></button>}</div> : <div className="browse-grid">{sortedEvents.map(event => <EventCard key={event.public_key||event.id} event={event}/>)}</div>}
        </div>
      </section>
      <section className="browse-booking-help browse-container"><span className="browse-help-icon"><Icon name="ticket" size={27}/></span><div><h2>Already have something lined up?</h2><p>Your booking details and tickets are a few clicks away.</p></div><Link to="/my-bookings">Find my booking <Icon name="arrow" size={18}/></Link></section>
    </main>
  );
}
