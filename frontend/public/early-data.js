// Inline at build time: public requests begin before the React bundle downloads.
(() => {
  const match = location.pathname.match(/^\/o\/([a-z][a-z0-9-]{2,39})(?:\/|$)/);
  const site = match ? '/o/' + match[1] : '';
  const path = location.pathname.slice(site.length) || '/';
  if (!/^\/(?:$|events(?:\/[^/]+)?\/?$|checkout\/[^/]+\/?$|pages\/[^/]+\/?$|my-bookings\/?$)/.test(path)) return;
  const base = site ? '/api' + site : '/api';
  const requests = new Map();
  window.__ticketflowPublicStart = {base, requests};
  const start = endpoint => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const request = fetch(base + endpoint, {signal:controller.signal, credentials:'omit', cache:'no-store'})
      .then(async response => {
        const data = await response.json();
        if (!response.ok) {const error = new Error(data.message || 'Unable to load this website.');error.response={data,status:response.status};throw error;}
        return {data};
      }).finally(() => clearTimeout(timer));
    request.catch(() => {});
    requests.set(endpoint, {started:Date.now(), request});
  };
  start('/site-settings');
  if (path === '/') start('/events');
  const detail = path.match(/^\/(?:events|checkout)\/([^/]+)\/?$/);
  if (detail) start('/events/' + detail[1]);
  setTimeout(() => {requests.clear();}, 15000);
})();
