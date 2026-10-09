import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import './studio/studio.css';
import './admin.css';

const navigation = [
  {label:'WORKSPACE',items:[['/admin','Overview','grid'],['/admin/events','Events','calendar'],['/admin/orders','Orders','ticket'],['/admin/check-in','Guest check-in','check']]},
  {label:'DESIGN STUDIO',superadmin:true,items:[['/admin/ticket-designs','Ticket designs','ticket'],['/admin/email-templates','Email templates','mail']]},
  {label:'CONFIGURATION',superadmin:true,items:[['/admin/mail-settings','Brand & SMTP','settings'],['/admin/policies','Policies & pages','page'],['/admin/email-delivery','Email delivery','mail']]},
  {label:'ACCOUNT',items:[['/admin/settings','Account settings','settings']]},
];
export default function AdminLayout(){
  const [open,setOpen]=useState(false);
  const [admin,setAdmin]=useState(()=>{try{return JSON.parse(localStorage.getItem('admin_user') || '{}');}catch{return {};}});
  const navigate=useNavigate();
  const {pathname}=useLocation();
  useEffect(()=>{api.get('/auth/me').then(({data})=>{setAdmin(data.data.admin);localStorage.setItem('admin_user',JSON.stringify(data.data.admin));}).catch(()=>{});},[]);
  const superadmin=admin.role==='super_admin';
  const title=navigation.flatMap(g=>g.items).find(([url])=>url===pathname)?.[1] || (pathname.includes('/events/')?'Event workspace':'Order details');
  const initials=(admin.name || 'A').split(' ').map(s=>s[0]).slice(0,2).join('');
  function logout(){localStorage.removeItem('admin_token');localStorage.removeItem('admin_user');navigate('/admin/login');}
  return <div className="admin-shell">
    {open && <button aria-label="Close navigation" className="admin-overlay" onClick={()=>setOpen(false)}/>}
    <aside className={`admin-sidebar ${open?'open':''}`}><Link className="admin-brand" to="/admin"><span><Icon name="ticket" size={24}/></span><div>TicketFlow<small>EVENT MANAGEMENT</small></div></Link>
    <div className="admin-workspace-label"><span className="studio-live-dot"/>{superadmin?'Superadmin workspace':'Team workspace'}<span>↗</span></div>
    <nav aria-label="Administration">{navigation.filter(group=>!group.superadmin || superadmin).map(group=><div key={group.label} className="admin-nav-group"><p>{group.label}</p>{group.items.map(([to,label,icon])=><NavLink key={to} to={to} end={to==='/admin'} className={({isActive})=>isActive?'active':''} onClick={()=>setOpen(false)}><Icon name={icon} size={18}/><span>{label}</span>{to==='/admin/ticket-designs' && <small>NEW</small>}</NavLink>)}</div>)}</nav>
    <div className="admin-sidebar-bottom"><div className="admin-mini-tip"><Icon name="ticket" size={27}/><p>Great events start<br/>with the little details.</p><Link to="/admin/events/new" onClick={()=>setOpen(false)}>Create an event <span>↗</span></Link></div><div className="admin-profile"><span>{initials}</span><div><strong>{admin.name}</strong><small>{superadmin?'Super administrator':'Staff member'}</small></div><button onClick={logout} title="Sign out" aria-label="Sign out">↪</button></div></div></aside>
    <div className="admin-main"><header className="admin-topbar"><button className="admin-menu-toggle" onClick={()=>setOpen(!open)} aria-label="Open navigation">☰</button><div className="admin-breadcrumb">Workspace <span>/</span> <strong>{title}</strong></div><div className="admin-topbar-right"><Link to="/" target="_blank" rel="noreferrer">View website ↗</Link><span className="admin-avatar">{initials}</span></div></header><main className="admin-content"><Outlet/></main><footer className="admin-footer"><span>TicketFlow · Made for memorable moments.</span><span>YOUR EVENTS. YOUR WAY.</span></footer></div>
  </div>;
}
