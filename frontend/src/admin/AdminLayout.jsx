import {session} from '../saas/context';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import api from '../api/client';
import Icon from '../components/Icon';
import '../saas/saas.css';
import './studio/studio.css';
import './admin.css';
import {useAdminSession} from './adminSessionContext';

const navigation = [
  {label:'WORKSPACE',items:[['/admin','Overview','grid'],['/admin/events','Events','calendar'],['/admin/orders','Orders','ticket'],['/admin/check-in','Guest check-in','check']]},
  {label:'FINANCES',superadmin:true,items:[['/admin/wallet','Event wallet','credit-card']]},
  {label:'DESIGN STUDIO',superadmin:true,items:[['/admin/ticket-designs','Ticket designs','ticket'],['/admin/email-templates','Email templates','mail']]},
  {label:'CONFIGURATION',superadmin:true,items:[['/admin/website','Your website & branding','settings'],['/admin/mail-settings','Organization SMTP','mail'],['/admin/team','Team','grid'],['/admin/policies','Your policies & pages','page'],['/admin/email-delivery','Email delivery','mail']]},
  {label:'ACCOUNT',items:[['/admin/event-packages','Event packages','ticket'],['/admin/account','My account','settings']]},
];
export default function AdminLayout(){
  const site=useSiteSettings();
  const [open,setOpen]=useState(false);
  const admin=useAdminSession();
  const [balance,setBalance]=useState(null);
  useEffect(()=>{
    const load=()=>api.get('/admin/saas/account').then(r=>setBalance(r.data.data.organization.event_balance)).catch(()=>{});
    load();window.addEventListener('event-balance-updated',load);window.addEventListener('focus',load);
    return()=>{window.removeEventListener('event-balance-updated',load);window.removeEventListener('focus',load);};
  },[]);
  const navigate=useNavigate();
  const {pathname}=useLocation();
  const superadmin=admin.role==='super_admin';
  const title=navigation.flatMap(g=>g.items).find(([url])=>url===pathname)?.[1] || (pathname.includes('/events/')?'Event workspace':'Order details');
  const initials=(admin.name || 'A').split(' ').map(s=>s[0]).slice(0,2).join('');
  function logout(){session.removeItem('admin_token');session.removeItem('admin_user');navigate('/admin/login');}
  return <div className="admin-shell">
    {open && <button aria-label="Close navigation" className="admin-overlay" onClick={()=>setOpen(false)}/>}
    <aside className={`admin-sidebar ${open?'open':''}`}><Link className="admin-brand" to="/admin"><span>{site.logo ? <img src={site.logo} alt="" style={{width:32,height:32,objectFit:'contain'}}/> : <Icon name="ticket" size={24}/>}</span><div style={{minWidth:0,overflowWrap:'anywhere'}}>{site.company_name}<small>{site.tagline}</small></div></Link>
    <div className="admin-workspace-label"><span className="studio-live-dot"/>{superadmin?'Organizer workspace':'Team workspace'}<span>↗</span></div>
    <nav aria-label="Administration">{navigation.filter(group=>!group.superadmin || superadmin).map(group=><div key={group.label} className="admin-nav-group"><p>{group.label}</p>{group.items.filter(([to])=>site.is_organizer || !['/admin/website','/admin/policies'].includes(to)).map(([to,label,icon])=><NavLink key={to} to={to} end={to==='/admin'} className={({isActive})=>isActive?'active':''} onClick={()=>setOpen(false)}><Icon name={icon} size={18}/><span>{label}</span>{to==='/admin/ticket-designs' && <small>NEW</small>}</NavLink>)}</div>)}</nav>
    <div className="admin-sidebar-bottom"><div className="admin-mini-tip"><Icon name="ticket" size={27}/><p>Great events start<br/>with the little details.</p><Link to="/admin/events/new" onClick={()=>setOpen(false)}>Create an event <span>↗</span></Link></div><div className="admin-profile"><span>{initials}</span><div><strong>{admin.name}</strong><small>{superadmin?'Account owner':'Manager'}</small></div><button onClick={logout} title="Sign out" aria-label="Sign out">↪</button></div></div></aside>
    <div className="admin-main"><header className="admin-topbar"><button className="admin-menu-toggle" onClick={()=>setOpen(!open)} aria-label="Open navigation">☰</button><div className="admin-breadcrumb">Workspace <span>/</span> <strong>{title}</strong></div><div className="admin-topbar-right">{balance!==null&&<Link className="event-balance-link" to="/admin/event-packages">{balance} events remaining</Link>}<Link to="/" target="_blank" rel="noreferrer">View website ↗</Link><span className="admin-avatar">{initials}</span></div></header><main className="admin-content"><Outlet/></main><footer className="admin-footer"><span>{site.company_name} · {site.footer_text}</span><span>{site.tagline}</span></footer></div>
  </div>;
}
