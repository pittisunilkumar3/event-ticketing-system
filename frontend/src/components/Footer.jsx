import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/client';
import { socialNetworks } from '../utils/social';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import Icon from './Icon';
import {watchSiteContent} from '../settings/watchSiteContent';

export default function Footer() {
  const site=useSiteSettings();
  const [year]=useState(()=>new Date().getFullYear());
  const [pages,setPages]=useState([]);
  const [socialLinks,setSocialLinks]=useState({});
  useEffect(()=>{
    let alive=true,revision=0;
    const load=()=>{
      const request=++revision;
      api.get('/pages').then(({data})=>{if(alive&&request===revision)setPages(data.data.pages);}).catch(()=>{});
      api.get('/social-links').then(({data})=>{if(alive&&request===revision)setSocialLinks(data.data.socialLinks);}).catch(()=>{});
    };
    load();const stop=watchSiteContent(load);
    return()=>{alive=false;stop();};
  },[]);
  return (
    <footer className="tf-landing-footer no-print relative border-t">
      <div className={`mx-auto grid max-w-6xl gap-10 px-4 py-14 ${pages.length ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div>
          <div className="flex items-center gap-2.5">
            <span className={site.is_organizer && site.logo ? "flex h-9 w-9 items-center justify-center" : "flex h-9 w-9 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-400/10 text-orange-400"}>
              {site.logo ? <img src={site.logo} alt="" className="h-9 w-9 object-contain"/> : <Icon name="ticket"/>}
            </span>
            <span className="font-display text-lg font-extrabold text-white">
              {site.company_name}
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
            {site.description}
          </p>
          <div className="mt-4 space-y-2 text-sm text-slate-400">
            {site.support_email && <p><a href={'mailto:'+site.support_email}>{site.support_email}</a></p>}
            {site.phone && <p><a href={'tel:'+site.phone.replace(/[^+0-9]/g,'')}>{site.phone}</a></p>}
            {(site.address || site.country) && <p className="whitespace-pre-line">{[site.address,site.country].filter(Boolean).join(', ')}</p>}
          </div>
          <nav aria-label="Social media" className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">{socialNetworks.filter(({key})=>socialLinks[key]).map(({key,name})=><a key={key} href={socialLinks[key]} target="_blank" rel="noopener noreferrer" className="text-slate-400 transition hover:text-orange-400">{name} ↗</a>)}</nav>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Explore</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/events" className="text-slate-400 transition hover:text-white">Browse events</Link></li>
            <li><Link to="/my-bookings" className="text-slate-400 transition hover:text-white">Find my booking</Link></li>
          </ul>
        </div>

        {pages.length > 0 && <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Information</h4>
          <ul className="mt-4 space-y-2.5 text-sm">{pages.map(page=><li key={page.slug}><Link to={`/pages/${page.slug}`} className="text-slate-400 transition hover:text-white">{page.title}</Link></li>)}</ul>
        </div>}
      </div>

      <div className="border-t border-white/5 py-5 text-center text-xs text-slate-600">
        {site.footer_text && <p className="mb-2">{site.footer_text}</p>}
        {site.copyright_text.replaceAll('{year}',String(year)).replaceAll('{company}',site.company_name)}
      </div>
    </footer>
  );
}
