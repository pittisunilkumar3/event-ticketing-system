import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import { formatEventDates, formatTime, formatCurrency } from '../utils/format';
import './events.css';
export default function Events() {
  const [data, setData] = useState({
      events: [],
      pagination: { page: 1, pages: 1, total: 0 },
    }),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(null),
    [refresh, setRefresh] = useState(0),
    [archive, setArchive] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError('');
        api
          .get('/admin/events', {
            params: {
              page,
              limit: 12,
              search,
              status: filter === 'archived' ? '' : filter,
              archived: filter === 'archived',
            },
            signal: controller.signal,
          })
          .then(({ data: r }) => {
            setData(r.data);
            if (page > 1 && !r.data.events.length) setPage((p) => p - 1);
          })
          .catch((e) => {
            if (!controller.signal.aborted)
              setError(e.response?.data?.message || 'Could not load events.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      search ? 250 : 0
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, filter, refresh]);
  async function action(event, kind) {
    setBusy(event.id);
    setError('');
    try {
      if (kind === 'archive') await api.delete('/admin/events/' + event.id);
      else if (kind === 'restore')
        await api.post('/admin/events/' + event.id + '/restore');
      else
        await api.patch('/admin/events/' + event.id + '/status', {
          status: event.status === 'published' ? 'draft' : 'published',
        });
      setArchive(null);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not update event.');
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="event-admin">
      <header className="ea-heading">
        <div>
          <span className="ea-eyebrow">WORKSPACE / EVENTS</span>
          <h1>Bring people together.</h1>
          <p>
            Your experiences, ticket options and bookings — all in one place.
          </p>
        </div>
        <Link to="/admin/events/new" className="ea-button primary">
          <Icon name="plus" />
          Create event
        </Link>
      </header>
      <div className="ea-list-toolbar">
        <div className="ea-tabs" role="group" aria-label="Filter events">
          {[
            ['', 'All events'],
            ['published', 'On / Published'],
            ['draft', 'Off / Draft'],
            ['cancelled', 'Cancelled'],
            ['archived', 'Archived'],
          ].map(([key, name]) => (
            <button
              key={key}
              className={filter === key ? 'active' : ''}
              onClick={() => {
                setFilter(key);
                setPage(1);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <input
          aria-label="Search events"
          placeholder="Search events or venues…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {error && (
        <div className="ea-alert" role="alert">
          {error}
        </div>
      )}
      <p className="ea-results">
        {data.pagination.total} experiences{' '}
        <span>Manage the details. Make the moment.</span>
      </p>
      {loading ? (
        <div className="ea-empty">Loading your events…</div>
      ) : data.events.length === 0 ? (
        <div className="ea-empty">
          <h2>
            {filter === 'archived'
              ? 'Your archive is empty.'
              : 'No events found.'}
          </h2>
          <p>Create a new event or try another filter.</p>
        </div>
      ) : (
        <div className="ea-event-grid">
          {data.events.map((event) => (
            <article className="ea-event-card" key={event.id}>
              <Link to={'/admin/events/' + event.id} className="ea-event-cover">
                {event.banner_image && <img src={event.banner_image} alt="" />}
                <span>{event.category || 'Experience'}</span>
                <b className={'ea-status ' + event.status}>
                  {event.archived_at
                    ? 'Archived'
                    : event.status === 'published'
                      ? '● Live'
                      : event.status === 'draft'
                        ? '○ Off / Draft'
                        : 'Cancelled'}
                </b>
              </Link>
              <div className="ea-event-card-body">
                <small>{formatEventDates(event.start_datetime,event.end_datetime)} · <span style={{whiteSpace:'pre-line'}}>{event.schedule_text || formatTime(event.start_datetime)}</span></small>
                <Link to={'/admin/events/' + event.id}>
                  <h2>{event.title}</h2>
                </Link>
                <p>
                  {[event.venue, event.city].filter(Boolean).join(' · ') ||
                    'Venue not set'}
                </p>
                <div className="ea-card-metrics">
                  <span>
                    <b>{event.tickets_sold}</b>tickets sold
                  </span>
                  <span>
                    <b>{event.ticket_type_count}</b>ticket types
                  </span>
                  <span>
                    <b>
                      {event.min_price == null
                        ? '—'
                        : formatCurrency(event.min_price)}
                    </b>
                    starting price
                  </span>
                </div>
                <div className="ea-card-actions">
                  <Link className="ea-button" to={'/admin/events/' + event.id}>
                    Manage event <Icon name="arrow" size={14} />
                  </Link>
                  {event.archived_at ? (
                    <button
                      disabled={busy === event.id}
                      className="ea-text"
                      onClick={() => action(event, 'restore')}
                    >
                      Restore
                    </button>
                  ) : (
                    <>
                      <button
                        role="switch"
                        aria-checked={event.status === 'published'}
                        aria-label={'Event sales for ' + event.title}
                        disabled={busy === event.id}
                        className={
                          'ea-switch ' +
                          (event.status === 'published' ? 'on' : '')
                        }
                        onClick={() => action(event, 'toggle')}
                      >
                        <i />
                        {event.status === 'published' ? 'On' : 'Off'}
                      </button>
                      <button
                        className="ea-text danger"
                        disabled={busy === event.id}
                        onClick={() => setArchive(event)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="ea-pagination">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          ← Previous
        </button>
        <span>
          Page {page} of {Math.max(1, data.pagination.pages)}
        </span>
        <button
          disabled={page >= data.pagination.pages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next →
        </button>
      </div>
      {archive && (
        <div className="ea-modal-backdrop">
          <div
            className="ea-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-title"
          >
            <h2 id="archive-title">Move event to archive?</h2>
            <p>
              “{archive.title}” will disappear from booking pages and new sales
              will stop. Existing bookings stay available. You can restore it
              from Archived events.
            </p>
            <div className="ea-actions">
              <button
                className="ea-button"
                disabled={!!busy}
                onClick={() => setArchive(null)}
              >
                Keep event
              </button>
              <button
                className="ea-button danger"
                disabled={!!busy}
                onClick={() => action(archive, 'archive')}
              >
                {busy ? 'Archiving…' : 'Move to archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
