import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import {
  Field,
  ImageField,
  Notice,
  errorText,
  useUnsaved,
} from "./studio/StudioUI";
import { notifySiteSettingsChanged } from "../settings/SiteSettingsContext";
import "./siteSettings.css";
import "./studio/studio.css";
import SocialLinksSettings from "./studio/SocialLinksSettings";

export default function SiteSettings({client=api, platform=false, onNavigate}) {
  const endpoint=platform?"/website":"/admin/studio";
  const [form, setForm] = useState(null);
  const [socialLinks, setSocialLinks] = useState(null);
  const [heroBusy, setHeroBusy] = useState(false);
  useEffect(()=>{client.get(platform?"/website/social-links":"/social-links").then(r=>setSocialLinks(r.data.data.socialLinks)).catch(()=>{});},[]);
  const [saved, setSaved] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [faviconBusy, setFaviconBusy] = useState(false);
  useUnsaved(Boolean(form) && JSON.stringify(form) !== saved);
  async function load() {
    try {
      const { data } = await client.get(endpoint+"/brand");
      setForm(data.data.brand);
      setSaved(JSON.stringify(data.data.brand));
    } catch (e) {
      setMessage({ text: errorText(e) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const update = (key, value) => setForm((s) => ({ ...s, [key]: value }));
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await client.put(endpoint+"/brand", form);
      setForm(data.data.brand);
      setSaved(JSON.stringify(data.data.brand));
      notifySiteSettingsChanged();
      setMessage({
        type: "success",
        text: "Site settings saved. Your website and browser tab now use these details.",
      });
    } catch (err) {
      setMessage({ text: errorText(err) });
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="py-8 text-slate-500">
        Loading site settings…
      </p>
    );
  if (!form)
    return (
      <div>
        <Notice message={message} />
        <button className="studio-button secondary" onClick={() => { setLoading(true); setMessage(null); load(); }}>
          Try again
        </button>
      </div>
    );
  return (
    <div className="studio site-settings">
      {!platform&&<div className="studio-heading"><div><h1>{platform?"Platform website & branding":"Your organizer website"}</h1><p>{platform?"Manage the logo, identity, contact details and social links across the ticketing platform.":"These settings apply only to your organizer’s ticketing site."}</p></div></div>}
      <Notice message={message} />
      <div className="site-settings-layout">
        <form onSubmit={save}>
          <fieldset disabled={saving} className="site-settings-fields">
            <section className="studio-panel">
              <div className="studio-panel-title">
                <h2>Website identity</h2>
                <span>Brand & browser</span>
              </div>
              <div className="studio-form-body">
                <div className="studio-two-col">
                  <Field
                    label="Website / company name"
                    required
                    maxLength={120}
                    value={form.company_name}
                    onChange={(e) => update("company_name", e.target.value)}
                    hint={platform?"Shown across the platform website and sign-in pages.":"Shown in the navigation, sign-in page and emails."}
                  />
                  <Field
                    label="Website title"
                    required
                    maxLength={160}
                    value={form.site_title}
                    onChange={(e) => update("site_title", e.target.value)}
                    hint="Shown in the browser tab."
                  />
                </div>
                <Field
                  label="Tagline"
                  maxLength={160}
                  value={form.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                />
                <Field
                  label="Website description"
                  hint="Used in the site footer and page description."
                >
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
                <Field
                  label="Public website URL"
                  type="url"
                  readOnly
                  required
                  value={form.site_url}
                  onChange={(e) => update("site_url", e.target.value)}
                  hint={platform?"The platform address configured on the server.":"Your assigned organizer website, used in booking and policy links."}
                />
                <div className="studio-two-col">
                  <ImageField client={client} uploadUrl={endpoint+"/upload"}
                    label={platform?"Platform website logo":"Website & email logo"}
                    value={form.logo}
                    onChange={(v) => update("logo", v)}
                    onBusy={setLogoBusy}
                  />
                  <ImageField client={client} uploadUrl={endpoint+"/upload"}
                    label="Browser favicon"
                    value={form.favicon}
                    onChange={(v) => update("favicon", v)}
                    onBusy={setFaviconBusy}
                  />
                </div>
                <p className="site-settings-hint">
                  Use a square PNG for the favicon, ideally 32 × 32 or 64 × 64
                  pixels. Removing it restores the default ticket icon.
                </p>
              </div>
            </section>
            <section className="studio-panel"><div className="studio-panel-title"><h2>Homepage</h2></div><div className="studio-form-body"><Field label="Homepage headline" maxLength={160} value={form.hero_title||''} onChange={e=>update('hero_title',e.target.value)} hint={platform?"Leave empty to use the default platform headline.":"Leave empty to use your tagline."}/><Field label="Brand color" type="color" value={form.accent_color||'#ea580c'} onChange={e=>update('accent_color',e.target.value)}/><ImageField client={client} uploadUrl={endpoint+"/upload"} label="Homepage image" value={form.hero_image||''} onChange={v=>update('hero_image',v)} onBusy={setHeroBusy}/></div></section>
            <section className="studio-panel">
              <div className="studio-panel-title">
                <h2>Contact details</h2>
                <span>Visible on your website</span>
              </div>
              <div className="studio-form-body">
                <div className="studio-two-col">
                  <Field
                    label="Support / contact email"
                    type="email"
                    value={form.support_email}
                    onChange={(e) => update("support_email", e.target.value)}
                    hint={platform?"Shown in the platform website footer.":"Also available in your email templates."}
                  />
                  <Field
                    label="Phone number"
                    type="tel"
                    maxLength={40}
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </div>
                <Field label="Business address">
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </Field>
                <Field
                  label="Country"
                  maxLength={100}
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                />
              </div>
            </section>
            <section className="studio-panel">
              <div className="studio-panel-title">
                <h2>Footer</h2>
              </div>
              <div className="studio-form-body">
                <Field
                  label="Footer message"
                  maxLength={300}
                  value={form.footer_text}
                  onChange={(e) => update("footer_text", e.target.value)}
                />
                <Field
                  label="Copyright text"
                  maxLength={300}
                  value={form.copyright_text}
                  onChange={(e) => update("copyright_text", e.target.value)}
                  hint="Use {year} for the current year and {company} for your company name."
                />
              </div>
            </section>
            <div className="site-settings-save">
              <button
                className="studio-button primary"
                disabled={saving || logoBusy || faviconBusy || heroBusy}
              >
                {saving
                  ? "Saving…"
                  : logoBusy || faviconBusy || heroBusy
                    ? "Uploading image…"
                    : "Save site settings"}
              </button>
              <Link to="/" target="_blank" rel="noreferrer">
                View website ↗
              </Link>
            </div>
          </fieldset>
        </form>
        <aside className="site-settings-aside">
          <section className="studio-panel">
            <div className="studio-panel-title">
              <h2>Brand preview</h2>
            </div>
            <div className="site-browser-preview">
              <div>
                <img
                  src={form.favicon || "/favicon.svg"}
                  alt="Favicon preview"
                />
                <span>{form.site_title}</span>
              </div>
              <p>{form.site_url}</p>
            </div>
            <div className="site-brand-preview">
              {form.logo && <img src={form.logo} alt="Website logo preview" />}
              <strong>{form.company_name}</strong>
              <span>{form.tagline}</span>
              <p>{form.description}</p>
            </div>
          </section>
          <section className="studio-panel site-settings-related">
            <div className="studio-panel-title">
              <h2>More settings</h2>
            </div>
            {platform ? <><button type="button" className="studio-button secondary" onClick={()=>onNavigate("Policies & pages")}>Policies & pages</button><button type="button" className="studio-button secondary" onClick={()=>onNavigate("Email templates")}>Email templates</button></> : <>
            <Link to="/admin/email-templates">
              <strong>Email templates</strong>
              <span>Customize booking messages ↗</span>
            </Link>
            <Link to="/admin/policies">
              <strong>Policies & pages</strong>
              <span>Privacy, terms, refunds and contact page ↗</span>
            </Link>
            </>}
          </section>
        </aside>
      </div>
      {socialLinks && <SocialLinksSettings platform={platform} client={client} endpoint={endpoint+"/social-links"} links={socialLinks} onSave={setSocialLinks}/>}
    </div>
  );
}
