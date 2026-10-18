import { Link, useLocation } from 'react-router-dom';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import Icon from './Icon';

export default function Navbar() {
  const site=useSiteSettings();
  const { pathname } = useLocation();
  return (
    <header className={`tf-site-header ${site.is_organizer ? 'organizer-site-header' : ''} no-print sticky top-0 z-50 border-b ${pathname !== '/' ? 'tf-browse-header' : ''}`}>
      <div className="mx-auto flex items-center justify-between">
        <Link to="/" className="tf-site-brand" aria-label={`${site.company_name} home`}><span>{site.logo ? <img src={site.logo} alt="" className="h-[22px] w-[22px] object-contain"/> : <Icon name="ticket" size={22}/>}</span><span>{site.company_name}</span></Link>
        <nav className="tf-site-nav" aria-label="Main navigation">
          {pathname === '/' && !site.is_organizer ? <>
            <a className="tf-nav-detail" href="#features">Features</a>
            <a className="tf-nav-detail" href="#how-it-works">How it works</a>
            <Link to="/events">Browse events</Link>
            <Link to="/admin/login" className="tf-nav-account">Sign in <Icon name="arrow" size={16}/></Link>
          </> : <>
            <Link to="/" className="tf-nav-detail">{site.is_organizer ? 'Home' : 'For organizers'}</Link>
            <Link to="/events" aria-current={pathname.startsWith('/events') ? 'page' : undefined}>Browse events</Link>
            <Link to="/my-bookings" aria-current={pathname === '/my-bookings' || pathname.startsWith('/confirmation/') ? 'page' : undefined} className="tf-nav-account">My bookings <Icon name="ticket" size={16}/></Link>
          </>}
        </nav>
      </div>
    </header>
  );
}
