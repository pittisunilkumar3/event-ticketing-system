import { useState } from 'react';
import { formatCurrency, formatEventDates, formatTime } from '../utils/format';
import Icon from './Icon';
import EventLink from './EventLink';

export default function EventCard({ event }) {
  const [failedImage, setFailedImage] = useState(null);
  const start = new Date(String(event.start_datetime).replace(' ', 'T'));
  const validDate = Number.isFinite(start.getTime());
  const isConference = event.category?.toLowerCase() === 'conference';
  const isMusic = event.category?.toLowerCase() === 'music';
  const isFree = event.min_price != null && Number(event.min_price) === 0;

  return (
    <EventLink event={event} className="browse-event-card">
      <div className={`browse-card-art ${isMusic ? 'browse-art-music' : 'browse-art-conference'}`}>
        {event.banner_image && failedImage !== event.banner_image ? <img src={event.banner_image} alt="" loading="lazy" onError={() => setFailedImage(event.banner_image)}/> : <div className="browse-generated-art" aria-hidden="true"><span className="browse-art-caption">{event.category || 'LIVE EXPERIENCE'}</span><strong>{isMusic ? <>All together.<br/>All night.</> : isConference ? <>Ideas meet.<br/>People connect.</> : <>Be there.<br/>Be part of it.</>}</strong>{isMusic ? <div className="browse-sound-wave">{[36,58,82,110,140,120,94,150,175,140,102,75,110,136,96,62].map((height,i) => <i key={i} style={{height}}/>)}</div> : <div className="browse-art-rings"><i/><i/><i/></div>}<span className="browse-art-bottom">{event.city || 'BE PART OF IT'} <Icon name="arrow" size={23}/></span></div>}
        {validDate && <div className="browse-date-badge"><span>{start.toLocaleString('en-US',{month:'short'})}</span><strong>{start.getDate()}</strong></div>}
      </div>
      <div className="browse-card-content"><span className="browse-card-category">{event.category || 'Event'}</span><h3>{event.title}</h3><p className="browse-card-detail"><Icon name="calendar" size={16}/>{validDate ? <span>{formatEventDates(event.start_datetime, event.end_datetime)}<span style={{display:'block',whiteSpace:'pre-line'}}>{event.schedule_text || formatTime(event.start_datetime)}</span></span> : 'Date to be announced'}</p><p className="browse-card-detail"><Icon name="pin" size={16}/><span>{[event.venue, event.city].filter(Boolean).join(', ') || 'Venue to be announced'}</span></p><div className="browse-card-bottom"><div>{event.min_price != null && !isFree && <small>From</small>}<strong>{event.min_price == null ? 'See ticket options' : isFree ? 'Free entry' : formatCurrency(event.min_price)}</strong></div><span className="browse-card-action">View event <Icon name="arrow" size={18}/></span></div></div>
    </EventLink>
  );
}
