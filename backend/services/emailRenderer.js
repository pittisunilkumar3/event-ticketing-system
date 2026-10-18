const { html: cleanHtml, url: safeUrl, socialMode } = require('./studioValidation');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const replace = (text, data, encode = true) => String(text || '').replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => encode ? escape(data[key]) : String(data[key] ?? ''));
function renderEmail(config, brand, data = {}, publishedPages = [], socialLinks = {}) {
  const values = { company_name: brand.company_name, support_email: brand.support_email, year: new Date().getFullYear(), ...data };
  const site = brand.site_url.replace(/\/$/, '');
  const absolute = path => path?.startsWith('/uploads/') ? new URL(path, site).href : path;
  const c = config;
  const answers=data.registration_answers||[];
  values.ticket=values.ticket_code||'';values.ticket_qr=values.ticket_code||'';
  values.registration_fields=answers.map(a=>a.label+': '+require('./ticketEmails').answerText(a)).join('; ');
  const qrSource=/^(cid:ticket-qr@ticketflow|data:image\/png;base64,[A-Za-z0-9+/=]+)$/.test(data.ticket_qr_src||'')?data.ticket_qr_src:'';
  const qrImage=qrSource?`<img src="${escape(qrSource)}" alt="Ticket QR code" width="200" height="200" style="display:block;margin:16px auto;max-width:100%" />`:'';
  const ticketBlock=`<div style="margin:20px 0;padding:20px;border:1px solid #d0d5dd;border-radius:12px;text-align:center"><h2>${escape(values.event_title)}</h2><p><strong>${escape(values.attendee_name)}</strong><br>${escape(values.ticket_type)}</p><p>${escape(values.event_date)}<br>${escape([values.venue,values.city].filter(Boolean).join(', '))}</p>${qrImage}<p style="font-family:monospace">${escape(values.ticket_code)}</p></div>`;
  const fieldBlock=`<table role="presentation" width="100%" cellpadding="8" style="border-collapse:collapse;font-size:14px">${answers.map(a=>`<tr><td style="border-bottom:1px solid #eee">${escape(a.label)}</td><td style="border-bottom:1px solid #eee">${escape(require('./ticketEmails').answerText(a))}</td></tr>`).join('')}</table>`;
  const blocks={ticket:ticketBlock,ticket_qr:qrImage,registration_fields:fieldBlock,ticket_pdf:'<p>Your personalized ticket PDF is attached to this email.</p>',attachments:(data.attachment_names||[]).map(name=>'<p>Attached: '+escape(name)+'</p>').join('')};
  const nonce=require('node:crypto').randomBytes(16).toString('hex');
  const markers=Object.fromEntries(Object.keys(blocks).map(k=>[k,'TICKETBLOCK'+nonce+k]));
  const accent = /^#[a-f0-9]{6}$/i.test(c.accent) ? c.accent : '#f97316';
  const img = (src, alt, width) => src ? `<img src="${escape(absolute(safeUrl(src, { image: true })))}" alt="${alt}" width="${width}" style="display:block;width:${width === 600 ? '100%' : width + 'px'};max-width:100%;height:auto;margin:0 auto 18px;border:0" />` : '';
  const logo = img(c.logo || brand.logo, 'Company logo', 130);
  const icon = img(c.icon, 'Email icon', 60);
  const banner = img(c.banner_image, 'Event banner', 600);
  const title = `<h1 style="font-size:26px;line-height:1.25;color:#17202c;margin:0 0 22px">${replace(c.title,values)}</h1>`;
  // Sanitize both before and after substitution; values never become markup.
  const richBody = content => {
    let output=cleanHtml(replace(content,{...values,...markers})).replace(/src="(\/uploads\/[a-zA-Z0-9/._-]+)"/g, (_, path) => `src="${escape(absolute(path))}"`);
    for(const [key,marker] of Object.entries(markers))output=output.replaceAll(marker,blocks[key]);
    return output;
  };
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
  // Saved template styling and copy remain in place; confirmed bookings always include the essentials.
  let bookingDetails='';
  if(data.include_booking_details){
    let ticketUrl='';try{ticketUrl=safeUrl(values.booking_url);}catch{}
    const ticketRows=(data.tickets||[]).map(t=>`<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb"><strong>${escape(t.attendee_name)}</strong><br>${escape(t.type_name)}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;font-family:monospace">${escape(t.ticket_code)}</td></tr>`).join('');
    bookingDetails=`${[6,9].includes(Number(c.format))?'':details}<p style="font-size:13px;color:#536173">Venue: ${escape([values.venue,values.city].filter(Boolean).join(', '))}</p>${ticketRows?`<h2 style="font-size:18px;color:#17202c">Your entry tickets</h2><table role="presentation" width="100%" style="font-size:13px;color:#344054;border-collapse:collapse">${ticketRows}</table>`:''}${ticketUrl?`<p style="font-size:14px"><a href="${escape(ticketUrl)}" style="color:${accent}">Open your booking and QR tickets</a></p>`:''}`;
  }
  const footerLinks = publishedPages.filter(p => c.page_links?.includes(p.slug)).map(p => `<a href="${escape(site + '/pages/' + p.slug)}" style="color:#667085;text-decoration:underline;display:inline-block;margin:5px 8px">${escape(p.title)}</a>`).join('');
  const mode = socialMode(c);
  const links = mode === 'hidden' ? {} : mode === 'custom' ? c.social_links || {} : socialLinks;
  const socialNames = {facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',twitter:'X (Twitter)',pinterest:'Pinterest',youtube:'YouTube'};
  const socials = Object.entries(links).filter(([,v]) => v).map(([label,link]) => `<a href="${escape(safeUrl(link))}" style="color:#667085;margin:0 7px">${escape(socialNames[label] || label)}</a>`).join('');
  return {
    ...(data.attachments?.length?{attachments:data.attachments}:{}),
    subject: replace(c.subject,values,false).replace(/[\r\n]/g,' '),
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#eef0f3;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eef0f3"><tr><td style="padding:30px 12px"><table role="presentation" align="center" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;border-top:5px solid ${accent}"><tr><td style="padding:32px">${formats[c.format] || formats[2]}${bookingDetails}<div style="border-top:1px solid #e7e9ee;margin-top:30px;padding-top:24px;color:#7b8493;font-size:12px;line-height:1.8;text-align:center">${replace(c.footer_text,values)}<p style="color:#344054;font-weight:bold">${escape(brand.company_name)}</p>${footerLinks}<p>${socials}</p><p>${replace(c.copyright_text,values)}</p></div></td></tr></table></td></tr></table></body></html>`,
  };
}
const sampleData = {
  customer_name: 'Alex Morgan', email: 'alex@example.com', event_title: 'Cinematica · An evening of possibilities',
  event_date: '12 December 2026, 6:00 PM', venue: 'Main Exhibition Hall', city: 'Hyderabad',
  booking_ref: 'TKT-PREVIEW', amount: '$120.00', ticket_count: 2, status: 'paid',
};
module.exports = { renderEmail, sampleData, escape, replace };
