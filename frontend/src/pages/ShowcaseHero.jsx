import {Link} from 'react-router-dom';
import Icon from '../components/Icon';
import EventVenueLink from '../components/EventVenueLink';
import {formatCurrency, formatEventDates, formatTime} from '../utils/format';
import './showcaseThemes.css';

export const showcaseThemes = ['marquee', 'atelier', 'horizon', 'pulse'];

export default function ShowcaseHero({event, lowest, theme}) {
  const hasTickets = Number.isFinite(lowest);
  return <section className={`showcase-hero showcase-${theme}`}>
    <div className="booking-container">
      <div className="showcase-topline">
        <Link to="/events">← All experiences</Link>
        <span>{event.category || 'Live experience'}</span>
      </div>
      <div className={`showcase-grid${event.banner_image ? '' : ' showcase-no-art'}`}>
        <header className="showcase-title"><span>{event.organizer_name || 'Live experience'}</span><h1>{event.title}</h1></header>
        {event.banner_image && <figure className="showcase-art"><img src={event.banner_image} alt={`${event.title} event banner`}/></figure>}
        <div className="showcase-invitation">
          {event.summary && <p>{event.summary}</p>}
          <a className="showcase-cta" href={hasTickets ? '#tickets' : '#about'}>{hasTickets ? 'Choose your pass' : 'Explore the event'}<Icon name="arrow" size={18}/></a>
          {hasTickets && <span className="showcase-price">{lowest === 0 ? 'Free tickets available' : `From ${formatCurrency(lowest)}`}</span>}
        </div>
        <dl className="showcase-facts">
          <div><dt><Icon name="calendar" size={16}/>Date & time</dt><dd>{formatEventDates(event.start_datetime, event.end_datetime)}<span><span style={{whiteSpace:'pre-line'}}>{event.schedule_text || formatTime(event.start_datetime)}</span></span></dd></div>
          <div><dt><Icon name="pin" size={16}/>Location</dt><dd><EventVenueLink event={event}/>{event.city && event.city !== event.venue && <span>{event.city}</span>}</dd></div>
        </dl>
      </div>
    </div>
  </section>;
}
