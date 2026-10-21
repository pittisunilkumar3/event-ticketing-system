import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { siteBase } from '../saas/context';
import Icon from '../components/Icon';
import { formatDateTime, formatEventDates, formatTime, formatCurrency } from '../utils/format';
import './events.css';
import EventRegistrationForm from './EventRegistrationForm';
import TicketModal from './TicketTypeModal';
const emptyType = {
  name: '',
  description: '',
  price: '',
  quantity: '',
  sales_start: '',
  sales_end: '',
  template_id: '',
  is_active: true,
  min_per_order: 1,
  max_per_order: 10,
  sort_order: 0,
};
const inputDate = (value) =>
  String(value || '')
    .replace(' ', 'T')
    .slice(0, 16);
export default function AdminEventDetail() {
  const { id } = useParams(),
    navigate = useNavigate();
  const [owner,setOwner]=useState(false);
  useEffect(()=>{api.get('/auth/me').then(r=>setOwner(r.data.data.admin.role==='super_admin')).catch(()=>{});},[]);
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [tab, setTab] = useState('tickets'),
    [formDirty,setFormDirty] = useState(false),
    [formTicketId,setFormTicketId] = useState(''),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data: r } = await api.get('/admin/events/' + id);
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load event.');
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  async function action(kind, type) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let r;
      if (kind === 'event-delete') {
        r = await api.delete('/admin/events/' + id);
        navigate('/admin/events');
        return;
      }
      if (kind === 'event-restore')
        r = await api.post('/admin/events/' + id + '/restore');
      if (kind === 'status')
        r = await api.patch('/admin/events/' + id + '/status', {
          status: data.event.status === 'published' ? 'draft' : 'published',
        });
      if (kind === 'ticket-delete')
        r = await api.delete('/admin/ticket-types/' + type.id);
      if (kind === 'ticket-restore')
        r = await api.post('/admin/ticket-types/' + type.id + '/restore');
      if (kind === 'ticket-toggle')
        r = await api.put('/admin/ticket-types/' + type.id, {
          is_active: !Number(type.is_active),
        });
      setNotice(r.data.message);
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not make this change.');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="event-admin">
        <div className="ea-empty">{error || 'Opening event workspace…'}</div>
        <Link to="/admin/events">← All events</Link>
      </div>
    );
  const { event, ticketTypes, ticketStats, summary } = data,
    types = ticketTypes.filter((t) => !t.archived_at),
    archived = ticketTypes.filter((t) => t.archived_at),
    sold = ticketTypes.reduce((s, t) => s + t.sold, 0),
    capacity = types.reduce((s, t) => s + t.quantity, 0);
  const eventUrl = event.slug ? new URL(`${siteBase}/events/${encodeURIComponent(event.slug)}`, window.location.origin).href : '';
  async function copyEventLink() {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setNotice('Event link copied.');
    } catch {
      setError('Unable to copy automatically. Select and copy the event link below.');
    }
  }
  function edit(type) {
    setModal({
      ...type,
      sales_start: inputDate(type.sales_start),
      sales_end: inputDate(type.sales_end),
      template_id: type.template_id || '',
      description: type.description || '',
      is_active: Boolean(type.is_active),
    });
  }
  return (
    <div className="event-admin">
      <Link to="/admin/events" className="ea-back">
        ← All events
      </Link>
      <div className="ea-detail-cover">
        {event.banner_image && <img src={event.banner_image} alt="" />}
        <div>
          <span className="ea-eyebrow">
            {event.category || 'EVENT'} / EVENT WORKSPACE
          </span>
          <h1>{event.title}</h1>
          <p>
            {formatEventDates(event.start_datetime,event.end_datetime)} · {formatTime(event.start_datetime)} ·{' '}
            {[event.venue, event.city].filter(Boolean).join(', ')}
          </p>
        </div>
        <span className={'ea-status ' + event.status}>
          {event.archived_at
            ? 'Archived'
            : event.status === 'published'
              ? '● On / Published'
              : event.status === 'draft'
                ? '○ Off / Draft'
                : 'Cancelled'}
        </span>
      </div>
      <div className="ea-detail-actions">
        <div className="ea-actions">
          {event.archived_at ? (
            <button
              className="ea-button primary"
              disabled={busy}
              onClick={() => action('event-restore')}
            >
              Restore event
            </button>
          ) : (
            <>
              <button
                className={
                  'ea-button ' + (event.status === 'published' ? '' : 'primary')
                }
                disabled={busy}
                onClick={() => action('status')}
              >
                {event.status === 'published'
                  ? 'Turn event off'
                  : 'Publish / turn on'}
              </button>
              <Link className="ea-button" to={'/admin/events/' + id + '/edit'}>
                Edit event
              </Link>
              <button
                className="ea-text danger"
                onClick={() =>
                  setConfirm({
                    kind: 'event-delete',
                    title: 'Archive this event?',
                    text: 'This hides the event and stops new bookings. Booking history is kept, and you can restore the event later.',
                  })
                }
              >
                Delete event
              </button>
            </>
          )}
        </div>
        <small>
          {event.status === 'published'
            ? 'Customers can see this event.'
            : 'This event is hidden from new bookings.'}
        </small>
      </div>
      {eventUrl && (
        <section className="ea-public-link" aria-label="Organizer event link">
          <div>
            <strong>Organizer event link</strong>
            <a href={eventUrl} target="_blank" rel="noopener noreferrer">{eventUrl}</a>
            {(event.archived_at || event.status !== 'published') && <small>Publish this event to make it available to visitors.</small>}
          </div>
          <div className="ea-actions">
            <button className="ea-button" onClick={copyEventLink}>Copy link</button>
            {!event.archived_at && event.status === 'published' && <a className="ea-button" href={eventUrl} target="_blank" rel="noopener noreferrer">Open event ↗</a>}
          </div>
        </section>
      )}
      {error && (
        <div className="ea-alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="ea-notice" role="status">
          {notice}
        </div>
      )}
      <div className="ea-stat-grid">
        {[
          ['Tickets sold', sold],
          ['Active capacity', capacity],
          ['Orders', summary?.orders || 0],
          ['Paid revenue (INR)', formatCurrency(summary?.revenue || 0)],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {owner && <div style={{marginBottom:20,textAlign:'right'}}><Link to={`/admin/wallet?event_id=${event.id}`} style={{color:'#a34623',fontWeight:700,fontSize:13}}>View event wallet →</Link></div>}
      <div className="ea-tabs ea-detail-tabs">
        {[
          ['tickets', 'Tickets & pricing'],
          ['details', 'Event details'],
          ['registration', 'Registration form'],
          ['orders', 'Recent bookings'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => {if(key===tab||!formDirty||window.confirm('Discard unsaved registration form changes?'))setTab(key);}}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'registration' && <EventRegistrationForm key={event.id} event={event} ticketTypes={data.ticketTypes} initialTicketId={formTicketId} onDirty={setFormDirty}/>}
      {tab === 'tickets' && (
        <section className="ea-panel">
          <header>
            <div>
              <h2>Every guest. The right ticket.</h2>
              <p>
                Create any ticket type, set the price and control when it’s
                available.
              </p>
            </div>
            <button
              className="ea-button primary"
              disabled={!!event.archived_at}
              onClick={() => setModal({ ...emptyType })}
            >
              <Icon name="plus" />
              Add ticket type
            </button>
          </header>
          <div className="ea-ticket-list">
            {types.length === 0 && (
              <div className="ea-empty">
                <h3>Your event needs its first ticket.</h3>
                <p>
                  Start with General Admission, add VIP access, or create your
                  own option.
                </p>
              </div>
            )}
            {types.map((t) => (
              <article key={t.id} className="ea-ticket-row">
                <div className="ea-ticket-symbol">
                  <Icon name="ticket" />
                </div>
                <div className="ea-ticket-info">
                  <div>
                    <h3>{t.name}</h3>
                    <span
                      className={
                        'ea-pill ' + (Number(t.is_active) ? 'live' : '')
                      }
                    >
                      {!Number(t.is_active)
                        ? 'Sales off'
                        : t.sales_start && new Date(t.sales_start) > new Date()
                          ? 'Scheduled'
                          : t.sales_end && new Date(t.sales_end) <= new Date()
                            ? 'Sales ended'
                            : t.quantity - t.sold < t.min_per_order
                              ? 'Sold out'
                              : 'Sales on'}
                    </span>
                  </div>
                  <p>{t.description || 'No description added.'}</p>
                  <div className="ea-ticket-meta">
                    <span>
                      {t.sold} sold / {t.quantity} capacity
                    </span>
                    <span>
                      {t.min_per_order}–{t.max_per_order} per booking
                    </span>
                    <span>
                      {t.sales_start
                        ? 'From ' + formatDateTime(t.sales_start)
                        : 'Sales open immediately'}
                    </span>
                    {t.sales_end && (
                      <span>Until {formatDateTime(t.sales_end)}</span>
                    )}
                  </div>
                  <div className="ea-stock-track">
                    <i
                      style={{
                        width: Math.min(100, (t.sold / t.quantity) * 100) + '%',
                      }}
                    />
                  </div>
                </div>
                <div className="ea-ticket-price">
                  <strong>
                    {Number(t.price) === 0 ? 'Free' : formatCurrency(t.price)}
                  </strong>
                  <small>INR · per ticket</small>
                  <div className="ea-actions">
                    {owner&&<button className="ea-text" disabled={!!event.archived_at} onClick={()=>{setFormTicketId(t.id);setTab('registration');}}>Registration fields</button>}
                    <button
                      className="ea-text"
                      disabled={!!event.archived_at}
                      onClick={() => edit(t)}
                    >
                      Edit
                    </button>
                    <button
                      className="ea-text"
                      disabled={busy || !!event.archived_at}
                      onClick={() => action('ticket-toggle', t)}
                    >
                      {Number(t.is_active) ? 'Turn off' : 'Turn on'}
                    </button>
                    <button
                      className="ea-text danger"
                      disabled={!!event.archived_at}
                      onClick={() =>
                        setConfirm({
                          kind: 'ticket-delete',
                          type: t,
                          title: 'Archive ' + t.name + '?',
                          text: 'New sales will stop. Previously issued tickets and booking history remain available.',
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {archived.length > 0 && (
            <details className="ea-archived-tickets">
              <summary>Archived ticket types ({archived.length})</summary>
              {archived.map((t) => (
                <div key={t.id}>
                  <span>
                    {t.name} · {formatCurrency(t.price)} · {t.sold} sold
                  </span>
                  <button
                    className="ea-text"
                    disabled={busy || !!event.archived_at}
                    onClick={() => action('ticket-restore', t)}
                  >
                    Restore with sales off
                  </button>
                </div>
              ))}
            </details>
          )}
          <div className="ea-panel-note">
            Turning sales off stops new purchases. Editing a design or price
            does not change previously issued tickets.
          </div>
        </section>
      )}
      {tab === 'details' && (
        <div className="ea-overview-grid">
          <section className="ea-panel">
            <header>
              <h2>The experience</h2>
            </header>
            <div className="ea-panel-body">
              <h3>{event.summary || 'No short introduction added.'}</h3>
              <p className="ea-prose">
                {event.description ||
                  'Add a description to tell your guests what to expect.'}
              </p>
              {event.highlights && (
                <>
                  <h3>Highlights</h3>
                  <p className="ea-prose">{event.highlights}</p>
                </>
              )}
              {event.entry_instructions && (
                <>
                  <h3>Entry instructions</h3>
                  <p className="ea-prose">{event.entry_instructions}</p>
                </>
              )}
            </div>
          </section>
          <section className="ea-panel">
            <header>
              <h2>At a glance</h2>
            </header>
            <div className="ea-panel-body">
              <dl className="ea-facts">
                {[
                  ['Starts', formatDateTime(event.start_datetime)],
                  [
                    'Ends',
                    event.end_datetime
                      ? formatDateTime(event.end_datetime)
                      : 'Not specified',
                  ],
                  ['Venue', event.venue],
                  [
                    'Address',
                    [event.address, event.city].filter(Boolean).join(', '),
                  ],
                  ['Admission', event.age_policy],
                  ['Organizer', event.organizer_name],
                  ['Contact', event.organizer_email],
                  ['Event link', '/events/' + event.slug],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || 'Not specified'}</dd>
                  </div>
                ))}
              </dl>
              <div className="ea-actions">
                {ticketStats.map((s) => (
                  <span key={s.status} className="ea-pill">
                    {s.count} {s.status.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
      {tab === 'orders' && (
        <section className="ea-panel">
          <header>
            <h2>Recent bookings</h2>
            <Link className="ea-text" to={'/admin/orders?event_id=' + id}>
              View all event orders →
            </Link>
          </header>
          <div className="ea-orders">
            {summary?.recentOrders?.length ? (
              summary.recentOrders.map((o) => (
                <Link key={o.id} to={'/admin/orders/' + o.id}>
                  <span>
                    <strong>{o.customer_name}</strong>
                    <small>
                      {o.booking_ref} · {formatDateTime(o.created_at)}
                    </small>
                  </span>
                  <span className="ea-pill">{o.status}</span>
                  <b>{formatCurrency(o.total_amount,o.currency)}</b>
                  <Icon name="arrow" size={16} />
                </Link>
              ))
            ) : (
              <div className="ea-empty">
                Bookings will appear here when guests choose their tickets.
              </div>
            )}
          </div>
        </section>
      )}
      {modal && (
        <TicketModal
          values={modal}
          eventId={id}
          event={event}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            setNotice('Ticket type saved.');
            load();
          }}
        />
      )}
      {confirm && (
        <div className="ea-modal-backdrop">
          <div
            className="ea-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">{confirm.title}</h2>
            <p>{confirm.text}</p>
            <div className="ea-actions">
              <button
                className="ea-button"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Keep it
              </button>
              <button
                className="ea-button danger"
                disabled={busy}
                onClick={() => action(confirm.kind, confirm.type)}
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
