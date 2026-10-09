import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import api from "../api/client";
import CkEditor from "./CkEditor";

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS — exact port of the hostel reference project
// ═══════════════════════════════════════════════════════════════
const CATEGORIES = [
  { key: "user", label: "Customer Mail Templates" },
  { key: "admin", label: "Admin Notification Templates" },
];

const TABS = {
  user: [
    // ── Customer Templates ──
    { key: "registration", label: "Customer Registration", icon: "👋" },
    { key: "forgot_password", label: "Forgot Password", icon: "🔑" },
    { key: "booking_confirmation", label: "Booking Confirmed", icon: "✅" },
    { key: "booking_cancelled", label: "Booking Cancelled", icon: "❌" },
    { key: "payment_success", label: "Payment Success", icon: "💳" },
    { key: "payment_failed", label: "Payment Failed", icon: "⚠️" },
    { key: "event_reminder", label: "Event Reminder", icon: "🔔" },
    { key: "ticket_refunded", label: "Refund Processed", icon: "💰" },
  ],
  admin: [
    { key: "registration", label: "Customer Registration", icon: "🔔" },
    { key: "new_booking", label: "New Booking", icon: "📋" },
    { key: "booking_cancelled", label: "Booking Cancelled", icon: "❌" },
    { key: "payment_received", label: "Payment Received", icon: "💰" },
    { key: "contact_message", label: "Contact Message", icon: "💬" },
  ],
};

const TEMPLATE_FORMATS = [
  { id: 1, name: "Format 1", desc: "Logo + Title + Body + Banner + Button" },
  { id: 2, name: "Format 2", desc: "Logo + Title + Body + Button" },
  { id: 3, name: "Format 3", desc: "Title + Body + Button + Green Section" },
  { id: 4, name: "Format 4", desc: "Icon + Title + Body + Code + Button" },
  { id: 5, name: "Format 5", desc: "Icon + Title | Body + Link (Default)" },
  { id: 6, name: "Format 6", desc: "Icon + Title + Body + Transaction Table" },
  { id: 7, name: "Format 7", desc: "Logo + Title + Body + Banner (No Button)" },
  { id: 8, name: "Format 8", desc: "Logo + Title + Body + Banner + Button" },
  { id: 9, name: "Format 9", desc: "Title + Body + Green Section + Order Info" },
  { id: 10, name: "Format 10", desc: "Icon + Title + Body + Banner + Credentials" },
  { id: 11, name: "Format 11", desc: "Icon Centered + Title + Body + Button" },
];

const PLACEHOLDERS = [
  "name", "email", "phone", "customer_name", "booking_id", "event_title",
  "event_date", "event_time", "venue", "city", "tickets_summary", "amount",
  "refund_amount", "status", "reset_url", "message", "transaction_id", "time",
];

// ═══════════════════════════════════════════════════════════════
// FOOTER DATA — Real URLs from admin settings
// ═══════════════════════════════════════════════════════════════
const DEFAULT_FOOTER = {
  siteUrl: window.location.origin,
  companyName: "TicketFlow",
  companyLogo: "",
  socialLinks: {},
  cmsPages: {},
};

// ═══════════════════════════════════════════════════════════════
// GENERATE PREVIEW HTML — table-based, email-compatible
// ═══════════════════════════════════════════════════════════════
function absUrl(url) {
  if (!url) return url;
  return url.startsWith("/") ? window.location.origin + url : url;
}

function generatePreviewHTML(tpl, footer) {
  const fmt = parseInt(tpl.email_template) || 5;
  const title = tpl.title || "Main Title";
  const bodyContent = tpl.body || '<span style="color:#9ca3af">Email body will appear here...</span>';

  const bannerImg = tpl.banner_image
    ? `<img src="${absUrl(tpl.banner_image)}" style="width:100%;height:auto;max-height:200px;object-fit:cover;display:block" alt="Banner" />`
    : "";
  const logoImg = tpl.logo
    ? `<img src="${absUrl(tpl.logo)}" style="width:140px;height:60px;object-fit:contain;display:block;margin:0 auto 10px" alt="Logo" />`
    : "";
  const iconImg = tpl.icon
    ? `<img src="${absUrl(tpl.icon)}" style="width:130px;height:45px;object-fit:contain;display:block;margin:0 auto 10px" alt="Icon" />`
    : "";
  const btnHtml = tpl.button_name
    ? `<span style="display:block;text-align:center;margin-top:16px"><a href="${tpl.button_url || "#"}" style="background:#ffa726;color:#fff;padding:8px 20px;display:inline-block;text-decoration:none;font-size:14px;border-radius:4px">${tpl.button_name}</a></span>`
    : "";

  const cmsUrl = (slug) => (footer.siteUrl ? `${footer.siteUrl}/pages/${slug}` : `#/pages/${slug}`);
  const contactUrl = footer.siteUrl ? `${footer.siteUrl}/contact` : "#/contact";

  const dot = `<span style="width:6px;height:6px;border-radius:50%;background:#334257;display:inline-block;margin:0 7px"></span>`;
  const footerLinks = [
    tpl.privacy ? `<a href="${cmsUrl(footer.cmsPages["privacy policy"] || "privacy-policy")}" style="text-decoration:none;color:#334257">Privacy Policy</a>` : "",
    tpl.refund ? `<a href="${cmsUrl(footer.cmsPages["refund policy"] || "refund-policy")}" style="text-decoration:none;color:#334257">Refund Policy</a>` : "",
    tpl.cancelation ? `<a href="${cmsUrl(footer.cmsPages["cancellation policy"] || "cancellation-policy")}" style="text-decoration:none;color:#334257">Cancellation Policy</a>` : "",
    tpl.contact ? `<a href="${contactUrl}" style="text-decoration:none;color:#334257">Contact Us</a>` : "",
  ].filter(Boolean).join(dot);

  const socialIcons = [
    tpl.facebook ? `<a href="${footer.socialLinks.facebook || "#"}" style="margin:0 5px;text-decoration:none"><img src="https://img.icons8.com/color/24/facebook.png" style="width:24px;height:24px" alt="Facebook" /></a>` : "",
    tpl.instagram ? `<a href="${footer.socialLinks.instagram || "#"}" style="margin:0 5px;text-decoration:none"><img src="https://img.icons8.com/color/24/instagram.png" style="width:24px;height:24px" alt="Instagram" /></a>` : "",
    tpl.twitter ? `<a href="${footer.socialLinks.twitter || "#"}" style="margin:0 5px;text-decoration:none"><img src="https://img.icons8.com/color/24/twitter.png" style="width:24px;height:24px" alt="Twitter" /></a>` : "",
    tpl.linkedin ? `<a href="${footer.socialLinks.linkedin || "#"}" style="margin:0 5px;text-decoration:none"><img src="https://img.icons8.com/color/24/linkedin.png" style="width:24px;height:24px" alt="LinkedIn" /></a>` : "",
    tpl.pinterest ? `<a href="${footer.socialLinks.pinterest || "#"}" style="margin:0 5px;text-decoration:none"><img src="https://img.icons8.com/color/24/pinterest.png" style="width:24px;height:24px" alt="Pinterest" /></a>` : "",
  ].join("");

  const footerBlock = `
    <span style="border-top:1px solid #e9ecef;display:block;margin-top:16px"></span>
    <span style="display:block;margin:14px 0;color:#737883;font-size:13px">${tpl.footer_text || "Please contact us for any queries, we are always happy to help."}</span>
    <span style="display:block;color:#334257;font-size:13px">Thanks &amp; Regards,</span>
    <span style="display:block;color:#334257;font-size:13px;margin-bottom:20px"><strong>${footer.companyName}</strong></span>
    ${footerLinks ? `<span style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;margin:10px 0">${footerLinks}</span>` : ""}
    ${socialIcons ? `<span style="display:block;text-align:center;margin:15px 0 8px">${socialIcons}</span>` : ""}
    <span style="text-align:center;display:block;color:#aaa;font-size:11px;margin-top:8px">${tpl.copyright_text || `© ${new Date().getFullYear()} ${footer.companyName}. All rights reserved.`}</span>`;

  const titleH2 = `<h2 style="font-size:17px;font-weight:500;color:#334257;margin:8px 0">${title}</h2>`;
  const titleH3 = `<h3 style="font-size:17px;font-weight:500;color:#334257;margin-top:8px">${title}</h3>`;
  const titleH2b = `<h2 style="font-size:17px;font-weight:500;color:#334257;margin-bottom:15px">${title}</h2>`;
  const bd = `<span style="font-weight:500;display:block;margin:20px 0 11px;color:#737883;font-size:13px;line-height:21px">${bodyContent}</span>`;

  const bannerRow = bannerImg ? `<tr><td style="padding:0;font-size:0;line-height:0">${bannerImg}</td></tr>` : "";

  let bodyHtml = "";

  switch (fmt) {
    case 1:
      bodyHtml = tpl.banner_image
        ? `${bannerRow}<tr><td style="padding:30px 30px 0">${logoImg}${titleH2}${bd}<img src="${absUrl(tpl.banner_image)}" style="width:100%;height:auto;max-height:172px;object-fit:cover;display:block;margin-bottom:10px" alt="" />${btnHtml}${footerBlock}</td></tr>`
        : `${bannerRow}<tr><td style="padding:30px 30px 0">${logoImg}${titleH2}${bd}${btnHtml}${footerBlock}</td></tr>`;
      break;
    case 2:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0">${logoImg}${titleH2}${bd}${btnHtml}${footerBlock}</td></tr>`;
      break;
    case 3:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0">${titleH2b}${bd}${btnHtml}<table style="background:#E3F5F1;padding:10px;width:100%;text-align:center"><tr><td style="padding:10px;text-align:center">${logoImg}<h3 style="margin:0 0 15px;color:#334257">Order Info</h3></td></tr></table>${footerBlock}</td></tr>`;
      break;
    case 4:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0;text-align:center">${iconImg}${titleH3}${bd}<h2 style="font-size:26px;margin:0;letter-spacing:4px;color:#334257">123456</h2></td></tr><tr><td style="padding:0 30px 30px">${btnHtml}${footerBlock}</td></tr>`;
      break;
    case 5:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0;text-align:center">${iconImg}${titleH3}</td></tr><tr><td style="padding:0 30px 30px;text-align:left">${bd}<span style="display:block;margin-bottom:14px"><a href="#" style="color:#0177CD">generated_link</a></span>${footerBlock}${tpl.logo ? `<img src="${absUrl(tpl.logo)}" style="width:100px;display:block;margin:10px auto" alt="Logo" />` : ""}</td></tr>`;
      break;
    case 6:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0;text-align:center">${iconImg}${titleH3}${bd}</td></tr><tr><td style="padding:0 30px"><table style="background:#E3F5F1;padding:10px;width:100%;text-align:center"><thead><tr><th style="padding:5px">SL</th><th style="padding:5px">Transaction ID</th><th style="padding:5px">Time</th><th style="padding:5px">Amount</th></tr></thead><tbody><tr><td style="padding:5px">1</td><td style="padding:5px">TXN123456</td><td style="padding:5px">2026-01-01</td><td style="padding:5px">$100.00</td></tr></tbody></table>${btnHtml}${footerBlock}</td></tr>`;
      break;
    case 7:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0">${logoImg}${titleH2}${bd}${tpl.banner_image ? `<img src="${absUrl(tpl.banner_image)}" style="width:100%;height:auto;max-height:172px;object-fit:cover;display:block;margin-bottom:10px" alt="Banner" />` : ""}${footerBlock}</td></tr>`;
      break;
    case 8:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0">${logoImg}${titleH2}${bd}${tpl.banner_image ? `<img src="${absUrl(tpl.banner_image)}" style="width:100%;height:auto;max-height:172px;object-fit:cover;display:block;margin-bottom:10px" alt="Banner" />` : ""}${btnHtml}${footerBlock}</td></tr>`;
      break;
    case 9:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0">${titleH2b}${bd}<table style="background:#E3F5F1;padding:10px;width:100%"><tr><td style="padding:10px;text-align:center">${logoImg}<h3 style="margin:0 0 15px;color:#334257">Order Info</h3></td></tr></table>${footerBlock}</td></tr>`;
      break;
    case 10:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0">${iconImg}${titleH2}${bd}${tpl.banner_image ? `<img src="${absUrl(tpl.banner_image)}" style="width:100%;height:auto;max-height:172px;object-fit:cover;display:block;margin-bottom:10px" alt="Banner" />` : ""}${btnHtml}<span style="display:block;margin-bottom:5px"><span style="display:block;color:#737883;font-size:13px">Your account credentials:</span><h6 style="color:#334257;margin:5px 0">Email: user@example.com</h6><h6 style="color:#334257;margin:5px 0">Password: ********</h6></span>${tpl.body_2 ? `<span style="display:block;margin-bottom:5px;color:#737883;font-size:13px">${tpl.body_2}</span>` : ""}${footerBlock}</td></tr>`;
      break;
    case 11:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0;text-align:center">${iconImg}${titleH3}</td></tr><tr><td style="padding:0 30px 30px;text-align:left">${bd}${btnHtml}${footerBlock}</td></tr>`;
      break;
    default:
      bodyHtml = `${bannerRow}<tr><td style="padding:30px 30px 0">${logoImg}${titleH2}${bd}${btnHtml}${footerBlock}</td></tr>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Roboto,Arial,sans-serif;width:100%!important;height:100%!important;padding:0!important;margin:0!important;background:#e9ecef;color:#334257;font-size:13px;line-height:1.5}@import url("https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap");table{border-collapse:collapse!important}img{-ms-interpolation-mode:bicubic}</style></head><body style="background-color:#e9ecef;padding:15px"><table style="width:100%;max-width:500px;margin:0 auto;text-align:center;background:#fff">${bodyHtml}</table></body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// IMAGE UPLOAD BOX COMPONENT
// ═══════════════════════════════════════════════════════════════
function ImageUploadBox({ label, value, onChange, isBanner }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post("/admin/email-templates/upload", formData);
      if (data.success && data.url) {
        // Replacing an existing uploaded image? Remove the old file from disk
        // so we don't leave orphaned files in /uploads/email-templates.
        if (value && value !== data.url && /\/uploads\/email-templates\//.test(value)) {
          api.delete("/admin/email-templates/upload", { data: { url: value } }).catch(() => {});
        }
        onChange(data.url);
      } else {
        alert(data.message || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  };

  const deleteImage = async (url) => {
    // Only delete files we uploaded (skip data-URIs / external URLs)
    if (!url || !/\/uploads\/email-templates\//.test(url)) return;
    try {
      await api.delete("/admin/email-templates/upload", { data: { url } });
    } catch { /* ignore — clear the field regardless */ }
  };

  const handleRemove = async () => {
    await deleteImage(value);
    onChange("");
  };

  if (value) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{ height: isBanner ? 60 : 80, borderRadius: 8, overflow: "hidden", border: "1px solid #e8ecf0", background: "#f8f9fa", position: "relative" }}>
          <img src={value} style={{ width: "100%", height: "100%", objectFit: isBanner ? "cover" : "contain" }} alt={label} />
          {uploading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 20, height: 20, border: "2px solid #e8ecf0", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
          )}
        </div>
        <button type="button" onClick={handleRemove} style={{ position: "absolute", top: 4, right: 4, background: "rgba(220,38,38,0.9)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
        <button type="button" onClick={() => inputRef.current?.click()} style={{ position: "absolute", top: 4, left: 4, background: "rgba(124,58,237,0.85)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>↻</button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: isBanner ? 60 : 80, border: `2px dashed ${dragOver ? "#7c3aed" : "#d0d7de"}`,
        borderRadius: 8, cursor: "pointer", background: dragOver ? "#f3f0ff" : "#fafbfc", transition: "all 0.2s",
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
      {uploading ? (
        <div style={{ width: 20, height: 20, border: "2px solid #e8ecf0", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      ) : (
        <>
          <span style={{ fontSize: 18, color: "#9ca3af" }}>{dragOver ? "📥" : "+"}</span>
          <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{dragOver ? "Drop here" : "Upload"}</span>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [category, setCategory] = useState("user");
  const [activeTab, setActiveTab] = useState("registration");
  const [editTemplate, setEditTemplate] = useState(null);
  const [previewKey, setPreviewKey] = useState(0);
  const initialLoadDone = useRef(false);
  const [footerData, setFooterData] = useState(DEFAULT_FOOTER);

  const [fd, setFd] = useState({
    title: "", body: "", body_2: "", button_name: "", button_url: "",
    footer_text: "", copyright_text: "", icon: "", logo: "", banner_image: "",
    email_template: "5", privacy: false, refund: false, cancelation: false,
    contact: false, facebook: false, instagram: false, twitter: false,
    linkedin: false, pinterest: false, status: true,
  });
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmailModal, setTestEmailModal] = useState({ open: false, email: "" });

  // Update a single field + trigger preview refresh
  const u = useCallback((field, value) => {
    setFd(p => ({ ...p, [field]: value }));
    setPreviewKey(k => k + 1);
  }, []);

  const showMessage = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const hydrate = (tpl) => ({
    title: tpl.title || "", body: tpl.body || "", body_2: tpl.body_2 || "",
    button_name: tpl.button_name || "", button_url: tpl.button_url || "",
    footer_text: tpl.footer_text || "", copyright_text: tpl.copyright_text || "",
    icon: tpl.icon || "", logo: tpl.logo || "", banner_image: tpl.banner_image || "",
    email_template: tpl.email_template || "5",
    privacy: !!tpl.privacy, refund: !!tpl.refund, cancelation: !!tpl.cancelation,
    contact: !!tpl.contact, facebook: !!tpl.facebook, instagram: !!tpl.instagram,
    twitter: !!tpl.twitter, linkedin: !!tpl.linkedin, pinterest: !!tpl.pinterest,
    status: !!tpl.status,
  });

  // ─── Fetch footer data (social links + CMS pages + site URL) once ───
  useEffect(() => {
    api.get("/admin/email-templates/footer-data")
      .then(({ data: res }) => { if (res.success && res.data) setFooterData(res.data); })
      .catch(() => {});
  }, []);

  // ─── Auto-select template when tab or templates change ───
  useEffect(() => {
    if (templates.length === 0) return;
    const tpl = templates.find(t => t.email_type === activeTab);
    if (tpl) {
      queueMicrotask(() => setEditTemplate(tpl));
      queueMicrotask(() => setFd(hydrate(tpl)));
      queueMicrotask(() => setPreviewKey(k => k + 1));
    }
  }, [templates, activeTab]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/admin/email-templates?type=${category}`);
      if (res.success && res.data) {
        setTemplates(res.data);
        if (!initialLoadDone.current) {
          const tabs = TABS[category];
          const firstMatch = res.data.find(t => t.email_type === tabs[0].key);
          if (firstMatch) setActiveTab(tabs[0].key);
          initialLoadDone.current = true;
        }
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [category]);

  useEffect(() => {
    const t = setTimeout(() => fetchTemplates(), 0);
    return () => clearTimeout(t);
  }, [category, fetchTemplates]);

  const handleTabClick = (key) => {
    setActiveTab(key);
    setMsg(null);
    const tpl = templates.find(x => x.email_type === key);
    if (tpl) {
      queueMicrotask(() => setEditTemplate(tpl));
      setFd(hydrate(tpl));
      setPreviewKey(k => k + 1);
    } else {
      setEditTemplate(null);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editTemplate) return;
    if (!fd.title || !fd.body) { showMessage("error", "Title and body are required"); return; }
    setSaving(true);
    try {
      const { data: res } = await api.put(`/admin/email-templates/${editTemplate.id}`, {
        ...fd,
        privacy: fd.privacy ? 1 : 0, refund: fd.refund ? 1 : 0,
        cancelation: fd.cancelation ? 1 : 0, contact: fd.contact ? 1 : 0,
        facebook: fd.facebook ? 1 : 0, instagram: fd.instagram ? 1 : 0,
        twitter: fd.twitter ? 1 : 0, linkedin: fd.linkedin ? 1 : 0,
        pinterest: fd.pinterest ? 1 : 0, status: fd.status ? 1 : 0,
      });
      if (res.success) {
        showMessage("success", "✅ Email template saved!");
        // Refresh from DB so preview matches exactly what's saved
        const { data: freshRes } = await api.get(`/admin/email-templates?type=${category}`);
        if (freshRes.success && freshRes.data) {
          setTemplates(freshRes.data);
          const freshTpl = freshRes.data.find(t => t.email_type === activeTab);
          if (freshTpl) {
            setEditTemplate(freshTpl);
            setFd(hydrate(freshTpl));
            setPreviewKey(k => k + 1);
          }
        }
      } else {
        showMessage("error", res.message || "Failed to save");
      }
    } catch {
      showMessage("error", "Network error — is the backend running?");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!editTemplate) return;
    const newStatus = fd.status ? 0 : 1;
    try {
      const { data: res } = await api.patch(`/admin/email-templates/${editTemplate.id}/toggle`, { status: newStatus });
      if (res.success) {
        u("status", !!newStatus);
        showMessage("success", newStatus ? "✅ Email enabled" : "⏸️ Email disabled");
        setTemplates(prev => prev.map(t => t.id === editTemplate.id ? { ...t, status: newStatus } : t));
      }
    } catch { /* ignore */ }
  };

  const handleReset = () => {
    if (!editTemplate) return;
    if (templates.find(t => t.email_type === activeTab)) handleTabClick(activeTab);
  };

  const handleSendTest = async () => {
    if (!editTemplate) return;
    if (!testEmailModal.email) { showMessage("error", "Please enter an email address"); return; }
    setSendingTest(true);
    try {
      const { data: res } = await api.post("/admin/email-templates/send-test",
        { to: testEmailModal.email, templateId: editTemplate.id },
        { timeout: 95_000 }
      );
      if (res.success) {
        showMessage("success", `✅ Test email sent to ${testEmailModal.email}`);
        setTestEmailModal({ open: false, email: "" });
      } else {
        showMessage("error", res.message || "Failed to send test email");
      }
    } catch (err) {
      showMessage("error", err.response?.data?.message || "Network error — is the backend running?");
    } finally {
      setSendingTest(false);
    }
  };

  // Preview HTML — recalculated whenever fd or previewKey changes
  const previewHtml = useMemo(() => generatePreviewHTML(fd, footerData), [fd, previewKey, footerData]);

  const inp = { width: "100%", padding: "10px 14px", border: "1px solid #e8ecf0", borderRadius: 8, fontSize: 14, color: "#1e283a", outline: "none", background: "#fff" };
  const lbl = { display: "block", fontSize: 13, fontWeight: 600, color: "#494e6b", marginBottom: 6 };

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>

      {/* Global spin animation for all upload boxes */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ═══ Header ═══ */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f2f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📧</div>
          <div><h3 style={{ fontSize: 16, color: "#1e283a", fontWeight: 700, margin: 0 }}>Email Templates</h3><p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>Design &amp; customize email templates</p></div>
        </div>
      </div>

      {/* ═══ Category Selector ═══ */}
      <div style={{ padding: "10px 24px", borderBottom: "1px solid #f0f2f5", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#494e6b" }}>Select Template Category:</span>
        <select value={category} onChange={e => { setCategory(e.target.value); setActiveTab(TABS[e.target.value][0].key); setEditTemplate(null); setMsg(null); initialLoadDone.current = false; }} style={{ padding: "6px 14px", border: "1px solid #e8ecf0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#1e283a", background: "#fff", cursor: "pointer", outline: "none" }}>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      {/* ═══ Sub Tabs ═══ */}
      {!loading && (
        <div style={{ display: "flex", gap: 2, padding: "8px 24px", borderBottom: "1px solid #f0f2f5", background: "#fafbfc", overflowX: "auto" }}>
          {TABS[category].map(t => {
            const tpl = templates.find(x => x.email_type === t.key);
            return (
              <button key={t.key} onClick={() => handleTabClick(t.key)}
                style={{ padding: "7px 16px", background: activeTab === t.key ? "#7c3aed" : "transparent", color: activeTab === t.key ? "#fff" : "#67768e", border: "none", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", transition: "all 0.2s" }}>
                {t.icon} {t.label}
                {tpl?.status ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: activeTab === t.key ? "#86efac" : "#22c55e", display: "inline-block" }} /> : null}
              </button>
            );
          })}
        </div>
      )}

      {/* ═══ Status Toggle ═══ */}
      {editTemplate && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px", background: fd.status ? "#e8fdf5" : "#fff0f0", borderBottom: `1px solid ${fd.status ? "#c0f0d0" : "#ffcdd2"}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: fd.status ? "#00875a" : "#d32f2f" }}>{fd.status ? "✅ Receive Mail On This Event" : "⏸️ Email Disabled"}</span>
          <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, cursor: "pointer" }}>
            <input type="checkbox" checked={fd.status} onChange={handleToggleStatus} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: "absolute", cursor: "pointer", inset: 0, background: fd.status ? "#00875a" : "#ccc", borderRadius: 22, transition: "0.3s" }}>
              <span style={{ position: "absolute", height: 16, width: 16, left: fd.status ? 20 : 3, bottom: 3, background: "#fff", borderRadius: "50%", transition: "0.3s" }}></span>
            </span>
          </label>
        </div>
      )}

      {/* ═══ Message ═══ */}
      {msg && (
        <div style={{ margin: "12px 24px 0", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: msg.type === "success" ? "#e8fdf5" : "#fff0f0", color: msg.type === "success" ? "#00875a" : "#d32f2f", border: `1px solid ${msg.type === "success" ? "#c0f0d0" : "#ffcdd2"}` }}>
          {msg.text}
        </div>
      )}

      {/* ═══ Loading ═══ */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center" }}><div style={{ width: 36, height: 36, border: "3px solid #e8ecf0", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} /><p style={{ color: "#9ca3af", fontSize: 13 }}>Loading templates...</p></div>
      ) : editTemplate ? (

        /* ═══ Two Column Layout ═══ */
        <div style={{ display: "flex", minHeight: 600 }}>
          {/* LEFT — Live Preview */}
          <div style={{ width: 440, minWidth: 400, flexShrink: 0, background: "#e9ecef", display: "flex", flexDirection: "column", borderRight: "1px solid #dde1e6" }}>
            {/* Browser chrome */}
            <div style={{ padding: "8px 16px", background: "#f8f9fa", borderBottom: "1px solid #dde1e6", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5f57" }}></span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffbd2e" }}></span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#28ca42" }}></span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginLeft: 8, flex: 1 }}>Live Preview</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#b0b8c4", background: "#fff", padding: "2px 8px", borderRadius: 4, border: "1px solid #dde1e6" }}>Format {fd.email_template || 5}</span>
            </div>
            {/* iframe */}
            <div style={{ flex: 1 }}>
              <iframe key={previewKey} srcDoc={previewHtml} style={{ width: "100%", height: "100%", minHeight: 560, border: "none", display: "block" }} title="Email Preview" />
            </div>
          </div>

          {/* RIGHT — Editor */}
          <div style={{ flex: 1, minWidth: 0, padding: 24, overflowY: "auto", maxHeight: 750 }}>
            <form onSubmit={handleSave}>

              {/* ── Placeholders ── */}
              <div style={{ padding: "10px 14px", background: "#fff8e1", borderRadius: 8, marginBottom: 20, border: "1px solid #ffe082" }}>
                <p style={{ fontSize: 12, color: "#e65100", marginBottom: 6, fontWeight: 700 }}>📋 Available Placeholders</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {PLACEHOLDERS.map(p => (
                    <code key={p} style={{ padding: "2px 8px", background: "#fff", borderRadius: 4, fontSize: 11, color: "#e65100", cursor: "pointer", border: "1px solid #ffe082", fontWeight: 600 }}
                      onClick={() => { navigator.clipboard.writeText("{{" + p + "}}"); showMessage("success", "Copied!"); }}>
                      {"{{"}{p}{"}}"}
                    </code>
                  ))}
                </div>
              </div>

              {/* ── Email Format ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>🎨</span>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: "#1e283a", margin: 0 }}>Email Format</h5>
              </div>
              <select value={fd.email_template} onChange={e => u("email_template", e.target.value)} style={{ ...inp, marginBottom: 24 }}>
                {TEMPLATE_FORMATS.map(f => <option key={f.id} value={f.id}>{f.name} - {f.desc}</option>)}
              </select>

              {/* ── Images ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>🖼️</span>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: "#1e283a", margin: 0 }}>Images</h5>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
                <div>
                  <label style={{ ...lbl, fontSize: 12 }}>Logo</label>
                  <ImageUploadBox label="Logo" value={fd.logo} onChange={url => u("logo", url)} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize: 12 }}>Icon</label>
                  <ImageUploadBox label="Icon" value={fd.icon} onChange={url => u("icon", url)} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize: 12 }}>Banner (Top)</label>
                  <ImageUploadBox label="Banner" value={fd.banner_image} onChange={url => u("banner_image", url)} isBanner />
                </div>
              </div>

              {/* ── Header Content ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>👆</span>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: "#1e283a", margin: 0 }}>Header Content</h5>
              </div>
              <div style={{ background: "#f8f9fc", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Main Title<span style={{ color: "#ff6b6b" }}>*</span></label>
                  <input type="text" placeholder="Main Title or Subject of the Mail" value={fd.title} onChange={e => u("title", e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Mail Body Message<span style={{ color: "#ff6b6b" }}>*</span></label>
                  <CkEditor data={fd.body} onChange={data => u("body", data)} />
                </div>
                {parseInt(fd.email_template) === 10 && (
                  <div style={{ marginTop: 14 }}>
                    <label style={lbl}>Body 2<span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 11 }}> (Additional content for credentials format)</span></label>
                    <textarea value={fd.body_2} onChange={e => u("body_2", e.target.value)} rows={3} style={{ ...inp, resize: "vertical", fontFamily: "monospace" }} placeholder="Additional message after credentials..." />
                  </div>
                )}
              </div>

              {/* ── Button & Link ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>🔗</span>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: "#1e283a", margin: 0 }}>Button &amp; Link</h5>
              </div>
              <div style={{ background: "#f8f9fc", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={lbl}>Button Name</label><input type="text" placeholder="View Details" value={fd.button_name} onChange={e => u("button_name", e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Button URL</label><input type="text" placeholder="https://..." value={fd.button_url} onChange={e => u("button_url", e.target.value)} style={inp} /></div>
                </div>
              </div>

              {/* ── Footer Content ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>👇</span>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: "#1e283a", margin: 0 }}>Footer Content</h5>
              </div>
              <div style={{ background: "#f8f9fc", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Section Text</label>
                  <input type="text" placeholder="Please contact us for any queries..." value={fd.footer_text} onChange={e => u("footer_text", e.target.value)} style={inp} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Copyright Content</label>
                  <input type="text" placeholder="© 2026 TicketFlow..." value={fd.copyright_text} onChange={e => u("copyright_text", e.target.value)} style={inp} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ ...lbl, marginBottom: 8 }}>Page Links</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[{ k: "privacy", l: "Privacy Policy" }, { k: "refund", l: "Refund Policy" }, { k: "cancelation", l: "Cancellation Policy" }, { k: "contact", l: "Contact Us" }].map(i => (
                      <label key={i.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", borderRadius: 8, border: fd[i.k] ? "1px solid #d0e3f7" : "1px solid #eee", cursor: "pointer", fontSize: 13, color: "#494e6b", fontWeight: 600 }}>
                        <input type="checkbox" checked={!!fd[i.k]} onChange={e => u(i.k, e.target.checked)} style={{ width: 16, height: 16, accentColor: "#7c3aed" }} />
                        {i.l}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ ...lbl, marginBottom: 8 }}>Social Media Links</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[{ k: "facebook", l: "Facebook", c: "#1877f2" }, { k: "instagram", l: "Instagram", c: "#e4405f" }, { k: "twitter", l: "Twitter", c: "#000" }, { k: "linkedin", l: "LinkedIn", c: "#0a66c2" }, { k: "pinterest", l: "Pinterest", c: "#e60023" }].map(i => (
                      <label key={i.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", borderRadius: 8, border: fd[i.k] ? "1px solid #d0e3f7" : "1px solid #eee", cursor: "pointer", fontSize: 13, color: "#494e6b", fontWeight: 600 }}>
                        <input type="checkbox" checked={!!fd[i.k]} onChange={e => u(i.k, e.target.checked)} style={{ width: 16, height: 16, accentColor: i.c }} />
                        <span style={{ color: i.c }}>{i.l}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Buttons ── */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #f0f2f5" }}>
                <button type="button" onClick={handleReset} style={{ padding: "10px 20px", background: "#f8f9fa", border: "1px solid #e8ecf0", borderRadius: 8, color: "#67768e", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔄 Reset</button>
                <button type="button" disabled={sendingTest} onClick={() => setTestEmailModal(p => ({ ...p, open: true }))} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #e8ecf0", borderRadius: 8, color: "#1e283a", fontSize: 13, fontWeight: 600, cursor: sendingTest ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {sendingTest ? "⏳ Sending..." : "📤 Send Test"}
                </button>
                <button type="submit" disabled={saving} style={{ padding: "10px 28px", background: saving ? "#ccc" : "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {saving ? "⏳ Saving..." : "💾 Save Template"}
                </button>
              </div>
            </form>

            {/* ── Send Test Email Modal ── */}
            {testEmailModal.open && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setTestEmailModal(p => ({ ...p, open: false }))}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e283a", margin: 0 }}>📤 Send Test Email</h3>
                      <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>Sends a test email using admin SMTP settings</p>
                    </div>
                    <button onClick={() => setTestEmailModal(p => ({ ...p, open: false }))} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af", padding: 4 }}>✕</button>
                  </div>

                  {/* Template info */}
                  <div style={{ background: "#f8f9fc", borderRadius: 10, padding: 12, marginBottom: 16, border: "1px solid #e8ecf0" }}>
                    <p style={{ fontSize: 12, color: "#67768e", margin: 0 }}>Template: <strong style={{ color: "#1e283a" }}>{editTemplate?.title}</strong></p>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>Type: {editTemplate?.template_type} • Format: {fd.email_template} • {fd.status ? "✅ Active" : "⏸️ Disabled"}</p>
                  </div>

                  {/* SMTP status */}
                  <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 12px", marginBottom: 16, border: "1px solid #ffe082", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>⚙️</span>
                    <span style={{ fontSize: 11, color: "#e65100", fontWeight: 600 }}>Uses SMTP credentials from Admin → Brand &amp; SMTP</span>
                  </div>

                  {/* Email input */}
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#494e6b", marginBottom: 6 }}>Recipient Email<span style={{ color: "#ff6b6b" }}>*</span></label>
                  <input
                    type="email"
                    placeholder="test@example.com"
                    value={testEmailModal.email}
                    onChange={e => setTestEmailModal(p => ({ ...p, email: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSendTest(); } }}
                    autoFocus
                    style={{ width: "100%", padding: "12px 16px", border: "1px solid #e8ecf0", borderRadius: 10, fontSize: 14, color: "#1e283a", outline: "none", background: "#fff" }}
                  />

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                    <button onClick={() => setTestEmailModal(p => ({ ...p, open: false }))} style={{ padding: "10px 20px", background: "#f8f9fa", border: "1px solid #e8ecf0", borderRadius: 8, color: "#67768e", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                    <button onClick={handleSendTest} disabled={sendingTest || !testEmailModal.email} style={{ padding: "10px 24px", background: sendingTest ? "#ccc" : "linear-gradient(135deg,#f59e0b,#f97316)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: sendingTest || !testEmailModal.email ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      {sendingTest ? (
                        <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} /> Sending...</>
                      ) : "📤 Send Test Email"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: 60, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <span style={{ fontSize: 28, opacity: 0.3 }}>📧</span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#b0b8c4", margin: 0 }}>Select a Template</h3>
          <p style={{ fontSize: 13, color: "#d0d7de", marginTop: 4 }}>Click a tab above to start editing</p>
        </div>
      )}
    </div>
  );
}
