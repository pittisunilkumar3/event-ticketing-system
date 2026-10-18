import {watchSiteContent} from './watchSiteContent.js';

const eventName = scope => 'events-changed:' + scope;
const storageKey = scope => 'events-updated:' + scope;
export function notifyEventContentChanged(scope) {
  window.dispatchEvent(new Event(eventName(scope)));
  try { localStorage.setItem(storageKey(scope), String(Date.now()) + ':' + Math.random()); }
  catch { /* Focus and polling still refresh when storage is unavailable. */ }
}

// Keep an open page current without allowing an older response to replace new data.
export function watchEventContent(scope, load) {
  let controller;
  const refresh = () => {
    controller?.abort();
    controller = new AbortController();
    load(controller.signal);
  };
  refresh();
  const stream = typeof window.EventSource === 'function' ? new window.EventSource(scope + '/events/stream') : null;
  // A ready event also catches changes missed during a disconnected stream.
  stream?.addEventListener('ready', refresh);
  stream?.addEventListener('changed', refresh);
  const stop = watchSiteContent(refresh, {eventName:eventName(scope), storageKey:storageKey(scope)});
  return () => { stream?.close(); stop(); controller.abort(); };
}
