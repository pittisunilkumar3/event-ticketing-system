import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Login from './Login';
import AdminLayout from './AdminLayout';
import Dashboard from './Dashboard';
import Events from './Events';
import EventForm from './EventForm';
import AdminEventDetail from './AdminEventDetail';
import Orders from './Orders';
import OrderDetail from './OrderDetail';
import CheckIn from './CheckIn';
import Settings from './Settings';
import { lazy, Suspense, useEffect, useState } from 'react';
import api from '../api/client';
const StudioPage = lazy(() => import('./studio/Studio'));
function Studio(props) { return <Suspense fallback={<p className="p-8 text-slate-500">Opening design studio…</p>}><StudioPage {...props}/></Suspense>; }

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="events/new" element={<EventForm />} />
          <Route path="events/:id" element={<AdminEventDetail />} />
          <Route path="events/:id/edit" element={<EventForm />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="check-in" element={<CheckIn />} />
          <Route path="settings" element={<Settings />} />
          <Route element={<RequireSuperAdmin />}>
            <Route path="ticket-designs" element={<Studio section="tickets" />} />
            <Route path="email-templates" element={<Studio section="emails" />} />
            <Route path="mail-settings" element={<Studio section="smtp" />} />
            <Route path="policies" element={<Studio section="pages" />} />
            <Route path="email-delivery" element={<Studio section="delivery" />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

function RequireSuperAdmin() {
  const [status,setStatus]=useState('loading');
  useEffect(()=>{api.get('/auth/me').then(({data})=>setStatus(data.data.admin.role==='super_admin'?'allowed':'denied')).catch(()=>setStatus('denied'));},[]);
  if(status==='loading')return <p className="p-8 text-slate-500">Checking access…</p>;
  if(status==='denied')return <p className="p-8 text-slate-700">This area is available to superadmins only.</p>;
  return <Outlet/>;
}

function RequireAuth() {
  const token = localStorage.getItem('admin_token');
  const location = useLocation();
  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
