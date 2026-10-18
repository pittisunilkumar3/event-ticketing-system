import EventPackages from '../saas/EventPackages';
import Team from '../saas/Team';
import SiteSettings from './SiteSettings';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminSession, {OwnerAccess} from './AdminSession';
import Login from './Login';
import AdminLayout from './AdminLayout';
import Dashboard from './Dashboard';
import Events from './Events';
import EventForm from './EventForm';
import AdminEventDetail from './AdminEventDetail';
import Orders from './Orders';
import Wallet from './Wallet';
import OrderDetail from './OrderDetail';
import CheckIn from './CheckIn';
import Settings from './Settings';
import EmailTemplates from './EmailTemplates';
import { lazy, Suspense } from 'react';
const StudioPage = lazy(() => import('./studio/Studio'));
function Studio(props) { return <Suspense fallback={<p className="p-8 text-slate-500">Opening design studio…</p>}><StudioPage {...props}/></Suspense>; }

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<AdminSession />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="events/new" element={<EventForm />} />
          <Route path="events/:id" element={<AdminEventDetail />} />
          <Route path="events/:id/edit" element={<EventForm />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="check-in" element={<CheckIn />} />
          <Route path="settings" element={<Navigate to="/admin/account" replace />} />
          <Route path="account" element={<Settings />} />
          <Route path="event-packages" element={<EventPackages/>}/>
          <Route element={<OwnerAccess />}>
            <Route path="wallet" element={<Wallet/>}/>
            <Route path="team" element={<Team/>}/>
            <Route path="website" element={<OrganizerWebsite><SiteSettings/></OrganizerWebsite>}/>
            <Route path="ticket-designs" element={<Studio section="tickets" />} />
            <Route path="email-templates" element={<Studio section="emails" />} />
            <Route path="email-library" element={<EmailTemplates />} />
            <Route path="mail-settings" element={<Studio section="smtp" />} />
            <Route path="policies" element={<OrganizerWebsite><Studio section="pages" /></OrganizerWebsite>} />
            <Route path="email-delivery" element={<Studio section="delivery" />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

function OrganizerWebsite({children}) {
  const site=useSiteSettings();
  return site.is_organizer ? children : <div className="p-8"><h1 className="text-xl font-semibold">Platform website settings have moved</h1><p className="mt-2">Manage the platform logo, social links and policy pages in Superadmin.</p><a className="inline-block mt-4 underline" href="/superadmin">Open Superadmin</a></div>;
}
