import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";
import defaults from "../../../shared/siteSettings.json";
import {watchSiteContent} from './watchSiteContent';
const Context = createContext(defaults);
export const notifySiteSettingsChanged = () => {
  window.dispatchEvent(new Event("site-settings-changed"));
  try {
    localStorage.setItem("site-settings-updated", String(Date.now()));
  } catch {
    /* Same-tab updates still work when storage is unavailable. */
  }
};
export const useSiteSettings = () => useContext(Context);
export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const { pathname } = useLocation();
  useEffect(() => {
    let alive = true,
      revision = 0;
    const load = async () => {
      const id = ++revision;
      try {
        const { data } = await api.get("/site-settings");
        if (alive && id === revision) {
          setSettings({ ...defaults, ...data.data.settings }); setLoaded(true); setError("");
        }
      } catch (e) {
        if(alive && id === revision) setError(e.response?.data?.message || "Unable to load this website. Please try again.");
      }
    };
    load();
    const stop=watchSiteContent(load);
    return () => {
      alive = false;
      stop();
    };
  }, []);
  useEffect(() => {
    const page = pathname.startsWith("/superadmin") ? "Superadmin" : pathname.startsWith("/admin")
      ? pathname === "/admin/login"
        ? "Admin sign in"
        : "Admin"
      : "";
    document.title = page
      ? `${page} · ${settings.site_title}`
      : settings.site_title;
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.removeAttribute("type");
    icon.href = settings.favicon || "/favicon.svg";
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = settings.description;
  }, [settings, pathname]);
  if (!pathname.startsWith('/superadmin') && pathname !== '/signup' && !loaded) return <main style={{padding:40}}>{error ? <><p role="alert">{error}</p><button onClick={()=>window.dispatchEvent(new Event('site-settings-changed'))}>Try again</button></> : <p role="status">Loading website…</p>}</main>;
  return <Context.Provider value={settings}>{children}</Context.Provider>;
}
