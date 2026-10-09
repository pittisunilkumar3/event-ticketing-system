const sanitizeHtml = require('sanitize-html');
const defaults = require('./studioDefaults');
function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }
function string(value, label, max = 255, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label} is invalid.`);
  return value.trim();
}
function url(value, { image = false, placeholder = false } = {}) {
  if (!value) return '';
  string(value, 'URL', 2048);
  if (placeholder && value === '{{booking_url}}') return value;
  if (image && /^\/uploads\/[a-zA-Z0-9._-]+$/.test(value)) return value;
  let parsed;
  try { parsed = new URL(value); } catch { fail('Use a complete http:// or https:// URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail('Only HTTP(S) URLs without credentials are allowed.');
  return parsed.href;
}
function html(value) {
  return sanitizeHtml(value || '', {
    allowedTags: ['p','br','strong','em','i','b','u','s','sub','sup','span','h2','h3','h4','ul','ol','li','blockquote','a','hr','code','figure','figcaption','img','table','thead','tbody','tfoot','tr','td','th','caption'],
    allowedAttributes: { '*': ['style'], a: ['href','title'], img: ['src','alt','width','height'], figure: ['class'], td: ['colspan','rowspan'], th: ['colspan','rowspan'], ol: ['start','reversed'] },
    allowedClasses: { figure: ['table','image','image_resized','image-style-side','image-style-block'] },
    allowedStyles: { '*': {
      color: [/^#[\da-f]{3,8}$/i, /^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)$/i, /^hsl\(\s*\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%\s*\)$/i],
      'background-color': [/^#[\da-f]{3,8}$/i, /^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)$/i, /^hsl\(\s*\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%\s*\)$/i],
      'font-family': [/^[a-z\s,'"-]+$/i],
      'font-size': [/^\d{1,2}px$/],
      'text-align': [/^(left|right|center|justify)$/],
      'margin-left': [/^\d{1,3}px$/],
      width: [/^\d{1,3}%$/, /^\d{1,4}px$/],
      'max-width': [/^100%$/],
      height: [/^auto$/],
      'border-collapse': [/^collapse$/],
      border: [/^1px solid #d1d5db$/],
      padding: [/^8px$/],
    } },
    // Inline table defaults also render in email clients without editor CSS.
    transformTags: {
      img: (tagName, attribs) => {
        let src = '';
        try { src = url(attribs.src, { image: true }); } catch { /* Drop unsafe image sources. */ }
        return { tagName, attribs: { ...attribs, src, style: `${attribs.style || ''};max-width:100%;height:auto` } };
      },
      table: sanitizeHtml.simpleTransform('table', { style: 'border-collapse:collapse;width:100%' }),
      td: sanitizeHtml.simpleTransform('td', { style: 'border:1px solid #d1d5db;padding:8px' }),
      th: sanitizeHtml.simpleTransform('th', { style: 'border:1px solid #d1d5db;padding:8px' }),
    },
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
    allowedSchemes: ['http','https','mailto'], allowProtocolRelative: false,
  });
}
function color(value) { if (!/^#[a-fA-F0-9]{6}$/.test(value)) fail('Choose a valid color.'); return value; }
function socialLinks(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid social media links.');
  return Object.fromEntries(Object.keys(defaults.social_links).map(network => {
    const value = string(input[network] ?? '', `${network} link`, 2048);
    return [network, url(value)];
  }));
}
function socialMode(config) {
  return config.social_mode ?? (Object.values(config.social_links || {}).some(Boolean) ? 'custom' : 'brand');
}
function template(kind, input) {
  if (!['ticket','email'].includes(kind) || !input || typeof input !== 'object') fail('Invalid template.');
  const c = { ...defaults[kind], ...input };
  const out = {};
  const textFields = kind === 'ticket' ? ['brand','heading','footer_text'] : ['subject','title','button_name','footer_text','copyright_text'];
  textFields.forEach(k => { out[k] = string(c[k], k, k === 'footer_text' ? 1000 : 255, ['brand','subject','title'].includes(k)); });
  out.accent = color(c.accent);
  for (const k of (kind === 'ticket' ? ['logo','banner_image'] : ['logo','icon','banner_image'])) out[k] = url(c[k], { image: true });
  if (kind === 'ticket') {
    if (!['classic','minimal','badge'].includes(c.layout)) fail('Choose a ticket layout.');
    out.layout = c.layout; out.background = color(c.background);
    out.show_attendee = Boolean(c.show_attendee); out.show_price = Boolean(c.show_price);
  } else {
    if (!Number.isInteger(Number(c.format)) || c.format < 1 || c.format > 11) fail('Choose email format 1–11.');
    out.format = Number(c.format);
    out.body = html(string(c.body, 'Message', 50000, true));
    out.body_2 = html(string(c.body_2, 'Additional message', 20000));
    if (!sanitizeHtml(out.body, { allowedTags: [], allowedAttributes: {} }).trim()) fail('Write an email message.');
    out.button_url = url(c.button_url, { placeholder: true });
    if (out.button_name && !out.button_url) fail('Provide a button URL or remove the button label.');
    out.page_links = defaults.pages.map(([slug]) => slug).filter(slug => Array.isArray(c.page_links) && c.page_links.includes(slug));
    out.social_links = socialLinks(c.social_links);
    out.social_mode = socialMode(input);
    if (!['brand','custom','hidden'].includes(out.social_mode)) fail('Choose a valid social media option.');
    const tokens = JSON.stringify(out).matchAll(/{{\s*([^{}]+?)\s*}}/g);
    for (const [,key] of tokens) if (!defaults.placeholders.includes(key)) fail(`Unknown placeholder: {{${key}}}`);
  }
  return out;
}
function emailAddress(value, required = false) {
  string(value, 'Email address', 254, required);
  if (value && !/^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(value)) fail('Enter one valid email address.');
  return value;
}
module.exports = { fail, string, url, html, color, template, emailAddress, socialLinks, socialMode };
