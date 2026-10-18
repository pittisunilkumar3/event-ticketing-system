import api from '../api/client';

// Public data only: start the first event request alongside branding instead of
// waiting for the branding gate. Consume it once; later refreshes stay live.
const boot = typeof window !== 'undefined' ? window.__ticketflowPublicStart : null;
const pending = boot && boot.base === api.defaults?.baseURL ? boot.requests : new Map();
if (typeof window !== 'undefined') delete window.__ticketflowPublicStart;
export function preloadPublicRoute(pathname) {
  const detail = pathname.match(/^\/(?:events|checkout)\/([^/]+)\/?$/);
  const path = pathname === '/' ? '/events' : detail ? '/events/' + detail[1] : null;
  if (!path || pending.has(path)) return;
  const entry = {started:Date.now(), request:api.get(path, {timeout:15000})};
  pending.set(path, entry);
  entry.request.catch(() => {}); // The page handles errors when it consumes it.
  window.setTimeout(() => { if (pending.get(path) === entry) pending.delete(path); },15000);
}
export async function getPublicData(path, options = {}) {
  const entry = pending.get(path);
  if (entry) pending.delete(path);
  if (!entry || Date.now() - entry.started >= 15000) return api.get(path, {timeout:15000,...options});
  options.signal?.throwIfAborted();
  const response = await entry.request;
  options.signal?.throwIfAborted();
  return response;
}
