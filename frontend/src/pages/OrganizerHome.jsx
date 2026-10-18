import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import api from '../api/client';
import {getPublicData} from '../settings/publicStartup';
import {watchEventContent} from '../settings/watchEventContent';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import EventCard from '../components/EventCard';
import './browseEvents.css';
import './organizerHome.css';
export default function OrganizerHome(){
 const site=useSiteSettings();
 const rgb=(site.accent_color||'#ea580c').slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 const contrast=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#111111':'#ffffff';
 const [events,setEvents]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>watchEventContent(api.defaults.baseURL,signal=>{
  getPublicData('/events',{signal,timeout:15000}).then(r=>{if(signal.aborted)return;setError('');setEvents(r.data.data.events.filter(e=>new Date(String(e.end_datetime||e.start_datetime).replace(' ','T'))>=new Date()).sort((a,b)=>String(a.start_datetime).localeCompare(String(b.start_datetime))));}).catch(()=>{if(!signal.aborted)setError('We couldn’t load events. Please try again.');});
 }),[attempt]);
 return <div className="organizer-home" style={{'--organizer-accent':site.accent_color,'--organizer-contrast':contrast}}><section className={`organizer-hero ${site.hero_image?'has-image':''}`}><div><p className="organizer-eyebrow">{site.company_name}</p><h1>{site.hero_title||site.tagline||`Welcome to ${site.company_name}`}</h1><p>{site.description}</p><Link className="organizer-cta" to="/events">Explore events <span aria-hidden="true">↗</span></Link></div>{site.hero_image&&<img src={site.hero_image} alt=""/>}</section><section className="organizer-events"><div className="organizer-section-heading"><div><p className="organizer-eyebrow">Join us</p><h2>Upcoming events</h2></div><Link to="/events">View all events →</Link></div>{error?<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(n=>n+1)}>Try again</button></div>:events===null?<p role="status">Loading events…</p>:events.length?<div className="organizer-event-grid">{events.slice(0,6).map(event=><EventCard key={event.id} event={event}/>)}</div>:<div className="organizer-empty"><h3>Our next event is on its way.</h3><p>Check back soon for new dates and tickets.</p>{site.support_email&&<a href={`mailto:${site.support_email}`}>Contact us</a>}</div>}</section></div>;
}
