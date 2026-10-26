import OrganizerHome from './OrganizerHome';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import { useEffect, useState } from 'react';
import api from '../api/client';
import {getPublicData} from '../settings/publicStartup';
import {watchEventContent} from '../settings/watchEventContent';
import {formatDate} from '../utils/format';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import EventLink from '../components/EventLink';
import './landing.css';

export function PublishedEventList({events,loading,error,onRetry}) {
  return <section className="tf-published-events" id="published-events" aria-labelledby="published-events-title"><div className="tf-published-heading"><span className="tf-eyebrow">ON THE CALENDAR</span><h2 id="published-events-title">Explore published events.</h2></div>
    {loading?<p role="status">Loading events…</p>:error?<div role="alert"><p>{error}</p><button className="tf-small-button" onClick={onRetry}>Try again</button></div>:events.length?<div className="tf-published-list">{events.slice(0,3).map(event=><EventLink key={event.public_key||event.id} event={event} className="tf-published-event"><span className="tf-event-symbol"><Icon name="calendar"/></span><div><strong>{event.title}</strong><span>{formatDate(event.start_datetime)}{event.schedule_text && <small>{event.schedule_text}</small>}</span><small>{[event.venue,event.city].filter(Boolean).join(', ')}</small></div><Icon name="arrow" size={18}/></EventLink>)}</div>:<div className="tf-published-empty"><Icon name="calendar" size={36}/><h3>No events published yet.</h3><p>Published events will appear here when they are available.</p></div>}
    <Link className="tf-text-link" to="/events">Browse events <Icon name="arrow" size={17}/></Link>
  </section>;
}
function PublishedEvents() {
 const [events,setEvents]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>watchEventContent(api.defaults.baseURL,signal=>{getPublicData('/events',{signal,timeout:15000}).then(({data})=>{if(!signal.aborted){setEvents(data.data.events);setError('');}}).catch(e=>{if(!signal.aborted)setError(e.response?.data?.message||'Unable to load events. Please try again.');}).finally(()=>{if(!signal.aborted)setLoading(false);});}),[attempt]);
 return <PublishedEventList events={events} loading={loading} error={error} onRetry={()=>setAttempt(n=>n+1)}/>;
}

export default function Home() {
  const site = useSiteSettings();
  return site.is_organizer ? <OrganizerHome/> : <PlatformHome/>;
}
function PlatformHome() {
  const site=useSiteSettings();
  const rgb=(site.accent_color||'#ea580c').slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  const contrast=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#111111':'#ffffff';
  return (
    <main className="tf-landing" style={{"--tf-orange":site.accent_color,"--tf-contrast":contrast}}>
      <section className="tf-hero tf-container">
        <div className="tf-hero-copy"><div className="tf-eyebrow"><span/> THE EVENT TICKETING WORKSPACE</div><h1>{site.hero_title||<>Great events.<br/>Less busywork.<br/><span>More possibility.</span></>}</h1><p>{site.description}</p><div className="tf-hero-actions"><Link to="/admin/login" className="tf-button tf-button-primary">Open your workspace <Icon name="arrow" size={18}/></Link><a href="#published-events" className="tf-text-link">Explore events <span>↗</span></a></div><div className="tf-hero-footnote"><Icon name="check" size={15}/><span>From the first ticket to the final check-in.</span></div></div>
        <div className="tf-hero-art"><div className="tf-art-caption"><span className="tf-caption-line"/> YOUR NEXT EVENT STARTS HERE</div>{site.hero_image?<img id="published-events" src={site.hero_image} alt="" style={{width:"100%",maxHeight:520,objectFit:"cover",borderRadius:16}}/>:<PublishedEvents/>}<div className="tf-art-bottom"><span>BUILT FOR THE PEOPLE BEHIND THE EXPERIENCE</span><span>EXPLORE ↑</span></div></div>
      </section>
      <section className="tf-use-cases"><div className="tf-container"><span>One platform.<br/><b>Every kind of gathering.</b></span><div>Conferences <span>✳</span> Live music <span>✳</span> Workshops <span>✳</span> Community</div></div></section>
      <section className="tf-features tf-container" id="features"><div className="tf-section-heading"><div><span className="tf-eyebrow">LESS FRICTION. MORE FLOW.</span><h2>Everything connected.<br/>Nothing in your way.</h2></div><p>Your event details, ticket designs, bookings, and check-ins. Finally, a place for all of it.</p></div>
        <div className="tf-feature-grid">
          <article className="tf-feature-card tf-feature-wide"><div className="tf-feature-copy"><span className="tf-feature-icon"><Icon name="calendar" size={23}/></span><h3>Your event.<br/>Your way.</h3><p>Set the date, share the details, and create ticket types that fit your audience. Manage availability as your plans evolve.</p><Link to="/admin/events">Manage events <Icon name="arrow" size={17}/></Link></div><div className="tf-event-editor" aria-label="Event setup"><div className="tf-editor-art"><span>YOUR<br/>NEXT EVENT<span>↗</span></span><div className="tf-orbit"/></div><div className="tf-editor-detail"><span>EVENT DETAILS</span><b>Plan your next gathering</b><p><Icon name="calendar" size={14}/>Set your date and venue</p><div><span>Create your ticket types</span></div></div></div></article>
          <article className="tf-feature-card tf-ticket-feature"><span className="tf-feature-icon"><Icon name="ticket" size={23}/></span><h3>Tickets with personality.</h3><p>Make every ticket feel like your brand with customizable layouts and QR codes for entry.</p><div className="tf-demo-ticket" aria-label="Branded ticket design"><div><span>{site.company_name}</span><strong>You're<br/>on the list.</strong><small>GENERAL ADMISSION <Icon name="arrow" size={16}/></small></div><aside><Icon name="ticket" size={30}/><span>YOUR EVENT</span></aside></div><Link to="/admin/ticket-designs">Explore ticket designs <Icon name="arrow" size={17}/></Link></article>
          <article className="tf-feature-card tf-small-feature"><span className="tf-feature-icon"><Icon name="grid" size={23}/></span><div><h3>The full picture, in one place.</h3><p>Keep an eye on ticket sales, order status, and attendance from your dashboard.</p></div></article>
          <article className="tf-feature-card tf-small-feature"><span className="tf-feature-icon"><Icon name="check" size={23}/></span><div><h3>A smoother hello at the door.</h3><p>Validate tickets and record arrivals with QR-based check-in.</p></div></article>
        </div>
      </section>
      <section className="tf-workflow" id="how-it-works"><div className="tf-container"><div className="tf-section-heading"><div><span className="tf-eyebrow">FROM IDEA TO OPEN DOORS</span><h2>Bring people together.<br/>We'll help with the details.</h2></div><Link to="/admin/login" className="tf-text-link">Go to your workspace <Icon name="arrow" size={18}/></Link></div><div className="tf-steps">{[{ title: 'Make it yours.', copy: 'Add your event details, set your ticket types, and choose a design that feels like you.' }, { title: 'Open the doors online.', copy: 'Publish your event so guests can discover it, book their place, and receive their tickets.' }, { title: 'Be there for the moment.', copy: 'Track bookings, validate tickets, and check in your guests when the day arrives.' }].map((step, i) => <article key={step.title}><span>0{i + 1}</span><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div></div></section>
      <section className="tf-final-cta tf-container"><div><span className="tf-eyebrow">GOOD THINGS START WITH A GATHERING.</span><h2>Make your next event<br/>one to remember<span>.</span></h2></div><div><Link to="/admin/login" className="tf-button tf-button-primary">Open your workspace <Icon name="arrow" size={18}/></Link><Link to="/events" className="tf-text-link">Here for an event? Browse events ↗</Link></div></section>
    </main>
  );
}
