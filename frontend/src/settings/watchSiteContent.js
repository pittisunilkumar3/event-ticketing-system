// Refresh published content after edits, when returning to the site, and across
// browser origins (for example localhost and 127.0.0.1), where storage is separate.
export function watchSiteContent(refresh, {eventName='site-settings-changed', storageKey='site-settings-updated'} = {}) {
  const visible=()=>{if(document.visibilityState==='visible')refresh();};
  const storage=event=>{if(event.key===storageKey)refresh();};
  window.addEventListener('focus',refresh);
  window.addEventListener(eventName,refresh);
  window.addEventListener('storage',storage);
  document.addEventListener('visibilitychange',visible);
  const timer=window.setInterval(visible,30000);
  return ()=>{
    window.removeEventListener('focus',refresh);
    window.removeEventListener(eventName,refresh);
    window.removeEventListener('storage',storage);
    document.removeEventListener('visibilitychange',visible);
    window.clearInterval(timer);
  };
}
