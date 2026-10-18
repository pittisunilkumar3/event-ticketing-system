import {Link} from 'react-router-dom';
import Icon from '../components/Icon';
import {formatCurrency,formatDate,formatTime} from '../utils/format';
import './premiereTheme.css';

export default function PremiereHero({event,lowest}) {
 const hasTickets=Number.isFinite(lowest);
 return <section className="premiere-hero">
  <div className="booking-container">
   <Link className="premiere-back" to="/events">← All experiences</Link>
   <div className={'premiere-hero-grid'+(!event.banner_image?' premiere-no-art':'')}>
    <div className="premiere-intro">
     <span className="premiere-category"><i/>{event.category||'Live experience'}</span>
     <h1>{event.title}</h1>
     {event.summary&&<p>{event.summary}</p>}
     <div className="premiere-hero-actions"><a className="premiere-cta" href={hasTickets?'#tickets':'#about'}>{hasTickets?'Find your pass':'Explore the event'}<Icon name="arrow" size={18}/></a>{hasTickets&&<span>{lowest===0?'Free tickets available':<>Tickets from <strong>{formatCurrency(lowest)}</strong></>}</span>}</div>
    </div>
    {event.banner_image&&<figure className="premiere-artwork"><img src={event.banner_image} alt={event.title+' event banner'}/></figure>}
   </div>
   <dl className="premiere-facts">
    <div><Icon name="calendar" size={20}/><div><dt>Date & time</dt><dd>{formatDate(event.start_datetime)}<span>{formatTime(event.start_datetime)}</span></dd></div></div>
    <div><Icon name="pin" size={20}/><div><dt>Venue</dt><dd>{event.venue||'Venue to be announced'}{event.city&&event.city!==event.venue&&<span>{event.city}</span>}</dd></div></div>
    <div><Icon name="users" size={20}/><div><dt>Presented by</dt><dd>{event.organizer_name||'Event organizer'}</dd></div></div>
   </dl>
  </div>
 </section>;
}
