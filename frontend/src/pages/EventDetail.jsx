import { useEffect, useState } from 'react';
import {
  useNavigate,
  useParams,
  useSearchParams,
  Link,
} from 'react-router-dom';
import api from '../api/client';
import {getPublicData} from '../settings/publicStartup';
import {watchEventContent} from '../settings/watchEventContent';
import { formatDate, formatTime, formatCurrency } from '../utils/format';
import Icon from '../components/Icon';
import CustomerState from '../components/CustomerState';
import './booking.css';
import './eventDetail.css';
import './eventThemes.css';
import {eventThemeId} from './eventTheme';
import EventTickets from './EventTickets';
import PremiereHero from './PremiereHero';
import ShowcaseHero, {showcaseThemes} from './ShowcaseHero';
import EventDescription from './EventDescription';
import {canSelectTicket, nextQuantity, validQuantity} from './ticketSelection';
import {checkoutDestination} from './checkoutNavigation';
export default function EventDetail() {
  const { slug } = useParams(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [selection, setSelection] = useState({});
  useEffect(() => {
    let initial = true;
    setData(null);
    setError('');
    return watchEventContent(api.defaults.baseURL, signal => {
    getPublicData('/events/' + slug, { signal })
      .then(({ data: r }) => {
        if (signal.aborted) return;
        setError('');
        setData(r.data);
        const requested = Object.fromEntries(
          (params.get('tickets') || '').split(',').map((x) => x.split(':'))
        );
        const useRequested = initial;
        setSelection(previous =>
          Object.fromEntries(
            r.data.ticketTypes.map((t) => {
              return [t.id, validQuantity(t, useRequested ? requested[t.id] || 0 : previous[t.id] || 0)];
            })
          )
        );
        initial = false;
      })
      .catch((e) => {
        if (!signal.aborted) {
          setData(null);
          setError(e.response?.data?.message || 'Unable to load this event.');
        }
      });
    });
  }, [slug, params]);
  if (!data) return <CustomerState loading={!error} eyebrow="YOUR NEXT EXPERIENCE" title={error ? 'This event isn’t available.' : 'Opening your next experience…'} description={error || 'We’re getting the latest event and ticket details.'} action="Explore events" icon="calendar"/>;
  const { event, ticketTypes } = data;
  const selected = ticketTypes.filter(t => validQuantity(t, selection[t.id]) > 0);
  const setQty = (t, delta) => setSelection(s => ({...s, [t.id]: nextQuantity(t, s[t.id], delta)}));
  function checkout() {
    if (!selected.length) return;
    const cart = selected.map((t) => t.id + ':' + selection[t.id]).join(',');
    const destination = checkoutDestination(data, slug, cart);
    if (data.checkout_path) window.location.assign(destination);
    else navigate(destination);
  }
  return <EventPageView data={data} selection={selection} onQuantity={setQty} onCheckout={checkout}/>;
}
export function EventPageView({data,selection={},onQuantity=()=>{},onCheckout=()=>{}}) {
  const {event,ticketTypes=[]}=data;
  const theme=eventThemeId(event.page_theme);
  const lowest = ticketTypes
    .filter(canSelectTicket)
    .reduce((m, t) => Math.min(m, Number(t.price)), Infinity);
  return (
    <main className={`booking-page event-detail-page event-theme-${theme}`}>
      {showcaseThemes.includes(theme) ? <ShowcaseHero event={event} lowest={lowest} theme={theme}/> : theme === 'premiere' ? <PremiereHero event={event} lowest={lowest}/> : <section
        className={
          'event-stage ' + (!event.banner_image ? 'event-stage-art' : 'has-banner')
        }
      >
        {event.banner_image && (
          <img className="event-stage-image" src={event.banner_image} alt="" />
        )}
        <div className="event-stage-shade" />
        <div className="booking-container event-stage-content">
          <Link className="booking-back" to="/events">
            ← All experiences
          </Link>
          <div className="event-stage-bottom">
            <div>
              <span className="booking-kicker">
                {event.category || 'Live experience'} <i />{' '}
                {event.city || 'Coming together'}
              </span>
              <h1>{event.title}</h1>
              <p>{event.summary || 'Be there for the moments that matter.'}</p>
              <div className="event-stage-meta">
                <span>
                  <Icon name="calendar" />
                  {formatDate(event.start_datetime)}
                </span>
                <span>
                  {formatTime(event.start_datetime)} ·{' '}
                  {event.venue || 'Venue to be announced'}
                </span>
              </div>
            </div>
            <a className="event-date-stamp" href="#tickets">
              <small>
                {new Date(
                  event.start_datetime.replace(' ', 'T')
                ).toLocaleString('en', { month: 'short' })}
              </small>
              <strong>
                {new Date(event.start_datetime.replace(' ', 'T')).getDate()}
              </strong>
              <span>GET TICKETS ↗</span>
            </a>
          </div>
        </div>
      </section>}
      <div className="event-section-nav">
        <div className="booking-container">
          <a href="#about">The experience</a>
          <a href="#details">Good to know</a>
          <a href="#tickets">Tickets & pricing</a>
          <span>
            {Number.isFinite(lowest)
              ? lowest === 0
                ? 'Free tickets available'
                : 'From ' + formatCurrency(lowest)
              : 'Stay tuned for ticket availability'}
          </span>
        </div>
      </div>
      <div className="booking-container event-body">
        <EventTickets ticketTypes={ticketTypes} selection={selection} onQuantity={onQuantity} onCheckout={onCheckout}/>
        <div className="event-story">
          <section id="about" className="event-about-section">
            <span className="booking-kicker">THE EXPERIENCE</span>
            <h2>About the experience.</h2>
            <EventDescription description={event.description}/>
            {event.highlights && (
              <div className="event-highlights">
                {event.highlights
                  .split('\n')
                  .filter(Boolean)
                  .map((line, i) => (
                    <div key={i}>
                      <Icon name="check" />
                      {line}
                    </div>
                  ))}
              </div>
            )}
          </section>
          <section id="details" className="event-details-section">
            <span className="booking-kicker">PLAN YOUR VISIT</span>
            <h2>Good to know.</h2>
            <div className="event-facts">
              <Fact
                icon="calendar"
                label="When"
                value={formatDate(event.start_datetime)}
                extra={
                  formatTime(event.start_datetime) +
                  (event.end_datetime
                    ? ' – ' +
                      formatDate(event.end_datetime) +
                      ', ' +
                      formatTime(event.end_datetime)
                    : '')
                }
              />
              <Fact
                icon="pin"
                label="Where"
                value={event.venue || 'Venue to be announced'}
                extra={[event.address, event.city].filter(Boolean).join(', ')}
              />
              <Fact
                icon="ticket"
                label="Admission"
                value={event.age_policy || 'See ticket descriptions'}
                extra="Choose the pass that suits your visit."
              />
              <Fact
                icon="grid"
                label="Your ticket"
                value="A unique QR entry pass"
                extra="Your booking reference gives you access to your tickets."
              />
            </div>
            {event.entry_instructions && (
              <div className="event-entry">
                <h3>Before you arrive</h3>
                <p>{event.entry_instructions}</p>
              </div>
            )}
            {(event.venue || event.address) && (
              <a
                className="booking-text-link"
                target="_blank"
                rel="noreferrer"
                href={
                  'https://www.google.com/maps/search/?api=1&query=' +
                  encodeURIComponent(
                    [event.venue, event.address, event.city]
                      .filter(Boolean)
                      .join(', ')
                  )
                }
              >
                Find the venue on maps ↗
              </a>
            )}
          </section>
          {event.organizer_name && (
            <section className="event-organizer">
              <div className="organizer-monogram">
                {event.organizer_name[0]}
              </div>
              <div>
                <small>CURATED BY</small>
                <h3>{event.organizer_name}</h3>
                {event.organizer_email && (
                  <a href={'mailto:' + event.organizer_email}>
                    Contact the organizer ↗
                  </a>
                )}
              </div>
            </section>
          )}
        </div>

      </div>
    </main>
  );
}
function Fact({ icon, label, value, extra }) {
  return (
    <div className="event-fact">
      <Icon name={icon} />
      <div>
        <small>{label}</small>
        <h3>{value}</h3>
        <p>{extra}</p>
      </div>
    </div>
  );
}
