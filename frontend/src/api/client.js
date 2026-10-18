import {apiBase, siteBase, session} from '../saas/context';
import axios from 'axios';
import {notifyEventContentChanged} from '../settings/watchEventContent';

// All calls go through the Vite dev proxy (/api → http://localhost:5001)
const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
});

// Attach admin JWT automatically (used in Phase 4 admin panel)
api.interceptors.request.use((config) => {
  const token = session.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => {
    if(res.config.url?.startsWith('/admin/events') && res.config.method!=='get') window.dispatchEvent(new Event('event-balance-updated'));
    if (/^\/admin\/(events|ticket-types)(\/|$)/.test(res.config.url || '') && !['get','head'].includes(res.config.method)) notifyEventContentChanged(apiBase);
    return res;
  },
  (err) => {
    if ((err.response?.status === 401 || err.response?.data?.code === 'TENANT_MISMATCH') && !['/auth/password','/auth/login'].includes(err.config?.url) && window.location.pathname.startsWith(siteBase+'/admin')) {
      session.removeItem('admin_token');
      session.removeItem('admin_user');
      window.location.href = siteBase+'/admin/login';
    }
    return Promise.reject(err);
  }
);

export default api;
