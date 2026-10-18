import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import Icon from '../components/Icon';
import '../admin/admin.css';
import './platform.css';

const navigationGroups = [
  {label:'Workspace', items:[
    ['Overview', 'grid'],
    ['Organizers', 'users'],
    ['Activity', 'clock'],
  ]},
  {label:'Billing', items:[
    ['Event packages', 'ticket'],
    ['Payments', 'credit-card'],
    ['Booking payments', 'ticket'],
    ['Withdrawals', 'credit-card'],
    ['Payment configuration', 'credit-card'],
  ]},
  {label:'Email', items:[
    ['Email templates', 'mail'],
    ['SMTP settings', 'mail'],
  ]},
  {label:'Website', items:[
    ['Website & branding', 'settings'],
    ['Policies & pages', 'page'],
  ]},
];

export default function PlatformLayout({authenticated, active, sectionPaths, onSelect, onSignOut, children}) {
  const site=useSiteSettings();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:800px)').matches);
  const sidebar = useRef(null);
  const toggle = useRef(null);
  const drawerOpen = authenticated && mobile && open;

  useEffect(() => {
    const media = window.matchMedia('(max-width:800px)');
    const update = () => { setMobile(media.matches); setOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector('[aria-current="page"]')?.focus();
    return () => { document.body.style.overflow = previousOverflow; toggle.current?.focus(); };
  }, [drawerOpen]);

  function select(section) { onSelect(section); setOpen(false); }
  function followLink(event, section) {
    // Preserve ordinary link behavior for opening a page in another tab.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    select(section);
  }
  function handleDrawerKey(event) {
    if (!drawerOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    if (event.key === 'Tab') {
      const items = [...sidebar.current.querySelectorAll('button, a[href]')].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  if (!authenticated) return children;

  return <div className="admin-shell platform-shell">
    {drawerOpen && <button className="admin-overlay" aria-label="Close navigation" tabIndex={-1} onClick={() => setOpen(false)}/>}
    <aside ref={sidebar} id="platform-sidebar" className={`admin-sidebar platform-sidebar ${open ? 'open' : ''}`} role={drawerOpen ? 'dialog' : undefined} aria-modal={drawerOpen || undefined} aria-label="Superadmin navigation" inert={mobile && !open} onKeyDown={handleDrawerKey}>
      <div className="platform-brand-row"><a className="admin-brand" href="#overview" onClick={event => { event.preventDefault(); select('Overview'); }}><span>{site.logo?<img src={site.logo} alt="" style={{width:32,height:32,objectFit:"contain"}}/>:<Icon name="ticket" size={24}/>}</span><div>{site.company_name}<small>SUPERADMIN</small></div></a><button className="platform-close" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button></div>
      <div className="admin-workspace-label"><span className="studio-live-dot"/>Platform workspace<span aria-hidden="true">↗</span></div>
      <nav aria-label="Platform sections">{navigationGroups.map(group => <div key={group.label} className="admin-nav-group" role="group" aria-labelledby={'platform-nav-'+group.label.toLowerCase()}><p id={'platform-nav-'+group.label.toLowerCase()}>{group.label}</p>{group.items.map(([label, icon]) => <Link key={label} to={'/superadmin'+(sectionPaths[label]?'/'+sectionPaths[label]:'')} className={active === label ? 'active' : ''} aria-current={active === label ? 'page' : undefined} onClick={event => followLink(event, label)}><Icon name={icon} size={18}/><span>{label}</span></Link>)}</div>)}</nav>
      <div className="admin-sidebar-bottom"><button className="platform-signout" onClick={onSignOut}>Sign out <span aria-hidden="true">↪</span></button></div>
    </aside>
    <div className="admin-main" inert={drawerOpen}>
      <header className="admin-topbar"><button ref={toggle} className="admin-menu-toggle" aria-label="Open navigation" aria-expanded={drawerOpen} aria-controls="platform-sidebar" onClick={() => setOpen(true)}>☰</button><div className="admin-breadcrumb">Superadmin <span>/</span><strong>{active}</strong></div><div className="admin-topbar-right"><a href="/signup" target="_blank" rel="noreferrer">Organizer signup ↗</a></div></header>
      <main className="saas platform-content">{children}</main>
    </div>
  </div>;
}
