const { html: cleanHtml, url: safeUrl, socialMode } = require('./studioValidation');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const replace = (text, data, encode = true) => String(text || '').replace(/{{\s*(\w+)\s*}}/g, (_, key) => encode ? escape(data[key]) : String(data[key] ?? ''));
function renderEmail(config, brand, data = {}, publishedPages = [], socialLinks = {}) {
  const values = { company_name: brand.company_name, support_email: brand.support_email, year: new Date().getFullYear(), ...data };
  const site = brand.site_url.replace(/\/$/, '');
  const absolute = path => path?.startsWith('/uploads/') ? site + path : path;
  const c = config;
  const accent = /^#[a-f0-9]{6}$/i.test(c.accent) ? c.accent : '#f97316';
  const img = (src, alt, width) => src ? `<img src="${escape(absolute(safeUrl(src, { image: true })))}" alt="${alt}" width="${width}" style="display:block;width:${width === 600 ? '100%' : width + 'px'};max-width:100%;height:auto;margin:0 auto 18px;border:0" />` : '';
  const logo = img(c.logo || brand.logo, 'Company logo', 130);
  const icon = img(c.icon, 'Email icon', 60);
  const banner = img(c.banner_image, 'Event banner', 600);
  const title = `<h1 style="font-size:26px;line-height:1.25;color:#17202c;margin:0 0 22px">${replace(c.title,values)}</h1>`;
  // Sanitize both before and after substitution; values never become markup.
  const richBody = content => cleanHtml(replace(content,values)).replace(/src="(\/uploads\/[a-zA-Z0-9._-]+)"/g, (_, path) => `src="${escape(absolute(path))}"`);
  const body = `<div style="color:#536173;font-size:15px;line-height:1.8">${richBody(c.body)}</div>`;
  const secondary = `<div style="margin-top:22px;padding:20px;background:#f5f7fa;border-left:3px solid ${accent};color:#536173;line-height:1.7">${richBody(c.body_2)}</div>`;
  let href = replace(c.button_url, values, false);
  try { href = safeUrl(href); } catch { href = ''; }
  const button = c.button_name && href ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px auto"><tr><td bgcolor="${accent}" style="border-radius:8px;text-align:center"><a href="${escape(href)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold">${replace(c.button_name,values)}</a></td></tr></table>` : '';
  const rows = [['Event',values.event_title],['Booking reference',values.booking_ref],['Date',values.event_date],['Tickets',values.ticket_count],['Total',values.amount]];
  const details = `<table role="presentation" width="100%" cellspacing="0" cellpadding="10" style="margin-top:24px;background:#f7f8fa;border-radius:8px;font-size:13px">${rows.map(([k,v])=>`<tr><td style="color:#687587;border-bottom:1px solid #e5e7eb">${k}</td><td style="color:#17202c;text-align:right;border-bottom:1px solid #e5e7eb">${escape(v)}</td></tr>`).join('')}</table>`;
  const code = `<div style="border:1px dashed ${accent};padding:20px;margin:24px 0;text-align:center;font:700 20px monospace;letter-spacing:2px">${escape(values.booking_ref)}</div>`;
  const formats = {
    1: `${logo}${title}${body}${banner}${button}`,
    2: `${logo}${title}${body}${button}`,
    3: `${title}${body}${button}${secondary}`,
    4: `${icon}${title}${body}${code}${button}`,
    5: `${icon}${title}${body}${button}`,
    6: `${icon}${title}${body}${details}${button}`,
    7: `${logo}${title}${body}${banner}`,
    8: `${banner}${logo}${title}${body}${button}`,
    9: `${title}${body}${secondary}${details}${button}`,
    10: `${icon}${title}${body}${banner}${code}${secondary}${button}`,
    11: `<div style="text-align:center">${icon}${title}${body}${button}</div>`,
  };
  const footerLinks = publishedPages.filter(p => c.page_links?.includes(p.slug)).map(p => `<a href="${escape(site + '/pages/' + p.slug)}" style="color:#667085;text-decoration:underline;display:inline-block;margin:5px 8px">${escape(p.title)}</a>`).join('');
  const mode = socialMode(c);
  const links = mode === 'hidden' ? {} : mode === 'custom' ? c.social_links || {} : socialLinks;
  const socialNames = {facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',twitter:'X (Twitter)',pinterest:'Pinterest',youtube:'YouTube'};
  const socials = Object.entries(links).filter(([,v]) => v).map(([label,link]) => `<a href="${escape(safeUrl(link))}" style="color:#667085;margin:0 7px">${escape(socialNames[label] || label)}</a>`).join('');
  return {
    subject: replace(c.subject,values,false).replace(/[\r\n]/g,' '),
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#eef0f3;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eef0f3"><tr><td style="padding:30px 12px"><table role="presentation" align="center" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;border-top:5px solid ${accent}"><tr><td style="padding:32px">${formats[c.format] || formats[2]}<div style="border-top:1px solid #e7e9ee;margin-top:30px;padding-top:24px;color:#7b8493;font-size:12px;line-height:1.8;text-align:center">${replace(c.footer_text,values)}<p style="color:#344054;font-weight:bold">${escape(brand.company_name)}</p>${footerLinks}<p>${socials}</p><p>${replace(c.copyright_text,values)}</p></div></td></tr></table></td></tr></table></body></html>`,
  };
}
const sampleData = {
  customer_name: 'Alex Morgan', email: 'alex@example.com', event_title: 'Cinematica · An evening of possibilities',
  event_date: '12 December 2026, 6:00 PM', venue: 'Main Exhibition Hall', city: 'Hyderabad',
  booking_ref: 'TKT-PREVIEW', amount: '$120.00', ticket_count: 2, status: 'paid',
};
module.exports = { renderEmail, sampleData, escape, replace };
