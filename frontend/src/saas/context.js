const match=window.location.pathname.match(/^\/o\/([a-z][a-z0-9-]{2,39})(?:\/|$)/);
export const organizerSlug=match?.[1] || '';
export const siteBase=organizerSlug ? '/o/'+organizerSlug : '';
export const apiBase=organizerSlug ? '/api/o/'+organizerSlug : '/api';
export const sessionKey=(key)=>`${key}:${organizerSlug || window.location.hostname}`;
export const session={
 getItem:key=>localStorage.getItem(sessionKey(key)),
 setItem:(key,value)=>localStorage.setItem(sessionKey(key),value),
 removeItem:key=>localStorage.removeItem(sessionKey(key)),
};
