import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/client';
import { socialNetworks } from '../utils/social';

export default function Footer() {
  const [pages,setPages]=useState([]);
  const [socialLinks,setSocialLinks]=useState({});
  useEffect(()=>{
    api.get('/pages').then(({data})=>setPages(data.data.pages)).catch(()=>{});
    api.get('/social-links').then(({data})=>setSocialLinks(data.data.socialLinks)).catch(()=>{});
  },[]);
  return (
    <footer className="no-print relative border-t border-white/5 bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg">
              🎟️
            </span>
            <span className="font-display text-lg font-extrabold text-white">
              Ticket<span className="text-gradient">Flow</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
            Discover events, book in seconds, and get your e-tickets instantly — all in one place.
          </p>
          <nav aria-label="Social media" className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">{socialNetworks.filter(({key})=>socialLinks[key]).map(({key,name})=><a key={key} href={socialLinks[key]} target="_blank" rel="noopener noreferrer" className="text-slate-400 transition hover:text-orange-400">{name} ↗</a>)}</nav>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Explore</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/" className="text-slate-400 transition hover:text-white">Browse events</Link></li>
            <li><Link to="/my-bookings" className="text-slate-400 transition hover:text-white">Find my booking</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Information</h4>
          <ul className="mt-4 space-y-2.5 text-sm">{pages.map(page=><li key={page.slug}><Link to={`/pages/${page.slug}`} className="text-slate-400 transition hover:text-white">{page.title}</Link></li>)}</ul>
        </div>
      </div>

      <div className="border-t border-white/5 py-5 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} TicketFlow — Event Ticketing System
      </div>
    </footer>
  );
}
