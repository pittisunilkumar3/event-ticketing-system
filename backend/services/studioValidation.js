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
  if (placeholder && /^{{\s*(booking_url|submission_url|guidelines_url)\s*}}$/.test(value)) return value;
  if (image && /^\/uploads\/(?:[a-z][a-z0-9-]{2,39}\/)?[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(value)) return value;
  let parsed;
  try { parsed = new URL(value); } catch { fail('Use a complete http:// or https:// URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail('Only HTTP(S) URLs without credentials are allowed.');
  return parsed.href;
}
function html(value) {
  return sanitizeHtml(value || '', {
    allowedTags: ['div','pre','h1','h5','h6','p','br','strong','em','i','b','u','s','sub','sup','span','h2','h3','h4','ul','ol','li','blockquote','a','hr','code','figure','figcaption','img','table','thead','tbody','tfoot','tr','td','th','caption'],
    allowedAttributes: { '*': ['style','dir'], a: ['href','title'], img: ['src','alt','width','height'], figure: ['class'], td: ['colspan','rowspan'], th: ['colspan','rowspan'], ol: ['start','reversed'] },
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
    if (!Array.isArray(c.logos) || c.logos.length > 6) fail('Add up to six additional logos.');
    out.logos = [...new Set(c.logos.map(value => url(value, { image: true })).filter(Boolean))];
    out.full_banner = c.full_banner === true;
    const number = (value, fallback, min, max) => {
      const n = value ?? fallback;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) fail('Choose a valid ticket size or spacing.');
      return n;
    };
    const alignment = value => {
      if (!['left','center','right'].includes(value ?? 'left')) fail('Choose a valid alignment.');
      return value ?? 'left';
    };
    const logoStyle = c.logo_style ?? {};
    if (!logoStyle || typeof logoStyle !== 'object' || Array.isArray(logoStyle)) fail('Invalid logo spacing.');
    out.logo_style = {align:alignment(logoStyle.align),size:number(logoStyle.size,44,24,96),gap:number(logoStyle.gap,8,0,40),
      margin_top:number(logoStyle.margin_top,0,0,64),margin_bottom:number(logoStyle.margin_bottom,0,0,64)};
    const finite=(value,fallback,min,max)=>{
      const n=value??fallback;
      if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)fail('Invalid ticket component position or size.');
      return Math.round(n*10000)/10000;
    };
    if(c.ticket_size!=null&&(!c.ticket_size||typeof c.ticket_size!=='object'||Array.isArray(c.ticket_size)||!Number.isFinite(c.ticket_size.width)||!Number.isFinite(c.ticket_size.height)))fail('Choose a valid ticket size.');
    out.ticket_size=c.ticket_size==null?null:{width:finite(c.ticket_size.width,760,240,1600),height:finite(c.ticket_size.height,600,240,4000)};
    if(out.ticket_size&&(c.ticket_size.contentWidth!=null||c.ticket_size.contentHeight!=null)){
      if(!Number.isFinite(c.ticket_size.contentWidth)||!Number.isFinite(c.ticket_size.contentHeight))fail('Invalid ticket artwork size.');
      out.ticket_size.contentWidth=finite(c.ticket_size.contentWidth,760,24,20000);
      out.ticket_size.contentHeight=finite(c.ticket_size.contentHeight,600,24,40000);
      if(c.ticket_size.referenceWidth!=null)out.ticket_size.referenceWidth=finite(c.ticket_size.referenceWidth,760,240,1600);
      if(Math.abs(out.ticket_size.width/out.ticket_size.contentWidth-out.ticket_size.height/out.ticket_size.contentHeight)>.01)fail('Keep ticket proportions when resizing.');
    }
    if(c.extra_elements!=null&&(!Array.isArray(c.extra_elements)||c.extra_elements.length>36))fail('Add up to 36 extra components.');
    const extraIds=new Set();
    out.extra_elements=(c.extra_elements||[]).map(item=>{
      if(!item||!/^extra_[a-zA-Z0-9_-]{1,44}$/.test(item.id)||extraIds.has(item.id)||!['text','badge','image','qr','field','divider'].includes(item.type))fail('Invalid extra component.');
      extraIds.add(item.id);
      const extra={id:item.id,type:item.type,label:string(item.label||'Component','Component name',100),x:finite(item.x,10,0,100),y:finite(item.y,10,0,100),w:finite(item.w,30,1,100),h:finite(item.h,20,1,100),font_size:number(item.font_size,18,8,100),color:color(item.color||'#ffffff')};
      if(extra.x+extra.w>100||extra.y+extra.h>100)fail('Keep added components inside the ticket.');
      if(item.type==='field'){if(!Object.hasOwn(require('../../shared/ticketText.json'),item.field))fail('Unknown booking field.');extra.field=item.field;}
      if(['text','badge'].includes(item.type))extra.text=string(item.text||'','Component text',1000);
      if(item.type==='image'){extra.src=url(item.src,{image:true});if(!extra.src)fail('Upload a component image.');}
      if(item.appearance!=null){
        const a=item.appearance;
        if(!a||typeof a!=='object'||Array.isArray(a))fail('Invalid copied component style.');
        extra.appearance={};
        for(const [key,allowed] of Object.entries({font:['body','display','mono'],font_style:['normal','italic'],text_transform:['none','uppercase','lowercase','capitalize'],align:['left','center','right'],object_fit:['contain','cover']})){
          if(a[key]!=null){if(!allowed.includes(a[key]))fail('Invalid copied component style.');extra.appearance[key]=a[key];}
        }
        for(const [key,min,max] of [['weight',100,900],['line_height',.5,5],['letter_spacing',-10,40],['padding_x',0,100],['padding_y',0,100],['qr_margin',0,10]])if(a[key]!=null)extra.appearance[key]=finite(a[key],min,min,max);
      }
      return extra;
    });
    const elementNames=new Set([...Object.keys(require('../../shared/ticketText.json')).map(k=>'text_'+k),...Object.keys(require('../../shared/ticketElements.json')),...extraIds,...(Array.isArray(c.layout_blocks)?c.layout_blocks.map(b=>'block_'+b.id):[])]);
    if(c.element_adjustments!=null&&(!c.element_adjustments||typeof c.element_adjustments!=='object'||Array.isArray(c.element_adjustments)))fail('Invalid ticket adjustments.');
    out.element_adjustments={};
    for(const [key,value] of Object.entries(c.element_adjustments||{})){
      if(!elementNames.has(key)||!value||typeof value!=='object'||Array.isArray(value))fail('Unknown ticket element.');
      const a={x:finite(value.x,0,-10000,10000),y:finite(value.y,0,-10000,10000),sx:finite(value.sx,1,.1,10),sy:finite(value.sy,1,.1,10),hidden:value.hidden===true};
      if(value.background!=null)a.background=color(value.background);
      if(value.border_radius!=null)a.border_radius=finite(value.border_radius,6,0,100);
      if(value.box_width!=null)a.box_width=finite(value.box_width,50,1,220);
      if(value.box_height!=null)a.box_height=finite(value.box_height,10,1,520);
      if(value.color!=null)a.color=color(value.color);
      if(value.font_size!=null)a.font_size=finite(value.font_size,18,6,150);
      if(value.line_axis!=null){if(!['horizontal','vertical'].includes(value.line_axis))fail('Invalid divider direction.');a.line_axis=value.line_axis;}
      if(value.line_width!=null)a.line_width=finite(value.line_width,1,1,12);
      if(value.line_style!=null){if(!['solid','dashed','dotted','double'].includes(value.line_style))fail('Choose a valid line style.');a.line_style=value.line_style;}
      if(value.rotation!=null)a.rotation=finite(value.rotation,0,-180,180);
      if(value.opacity!=null)a.opacity=finite(value.opacity,1,0,1);
      if(value.layer!=null)a.layer=finite(value.layer,2,0,20);
      if(value.weight!=null){if(![400,700].includes(value.weight))fail('Choose a valid font weight.');a.weight=value.weight;}
      if(value.align!=null)a.align=alignment(value.align);
      const isQR=(key==='qr'||key==='section_qr')||out.extra_elements.some(e=>e.id===key&&e.type==='qr');
      if(isQR&&a.sx!==a.sy)fail('Keep the QR code square.');
      out.element_adjustments[key]=a;
    }
    out.layout_blocks = null;
    out.canvas = null;
    if (c.canvas != null) {
      if (typeof c.canvas !== 'object' || Array.isArray(c.canvas) || !Array.isArray(c.layout_blocks)) fail('Invalid ticket canvas.');
      out.canvas = {height:number(c.canvas.height,1200,240,6000)};
    }
    if (c.layout_blocks != null) {
      if (!Array.isArray(c.layout_blocks) || (!out.canvas&&!c.layout_blocks.length) || c.layout_blocks.length > 36) fail('Use between 1 and 36 ticket components.');
      const types = require('../../shared/ticketBlocks.json').types;
      const ids = new Set();
      out.layout_blocks = c.layout_blocks.map(block => {
        if (!block || !Object.hasOwn(types,block.type) || typeof block.id !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(block.id) || ids.has(block.id)) fail('Invalid ticket component.');
        ids.add(block.id);
        if (![25,50,100].includes(block.width ?? 100)) fail('Choose a valid component width.');
        const item = {id:block.id,type:block.type,width:block.width ?? 100,align:alignment(block.align),padding:number(block.padding,12,0,48)};
        for (const key of ['margin_top','margin_bottom','margin_left','margin_right']) item[key]=number(block[key],0,0,64);
        if (block.font_size != null) item.font_size=number(block.font_size,14,8,64);
        if (block.type === 'text') item.text=string(block.text ?? '', 'Custom text',1000);
        if (block.type === 'qr') item.qr_size=number(block.qr_size,112,72,240);
        if (block.type === 'partner_logo') item.partner_index=number(block.partner_index,0,0,5);
        if (out.canvas) {
          if (!block.frame || typeof block.frame !== 'object') fail('Choose a position for every component.');
          const f=block.frame;
          item.frame={x:number(f.x,0,0,736),y:number(f.y,0,0,5976),w:number(f.w,100,block.type==='qr'?96:24,760),h:number(f.h,100,block.type==='qr'?120:24,6000)};
          if (item.frame.x+item.frame.w>760 || item.frame.y+item.frame.h>out.canvas.height) fail('Keep components inside the ticket.');
        }
        return item;
      });
    }
    if (!c.text || typeof c.text !== 'object' || Array.isArray(c.text)) fail('Invalid ticket text.');
    const textCatalog = require('../../shared/ticketText.json');
    const allowedTokens=new Set(Object.values(textCatalog).map(entry=>entry.token).filter(Boolean));
    const validateVariables=text=>{for(const [,token] of text.matchAll(/{{\s*([^{}]+?)\s*}}/g))if(!allowedTokens.has(token)&&!["attendee_email","attendee_phone"].includes(token)&&!/^field_f_[a-zA-Z0-9_-]+$/.test(token))fail(`Unknown ticket variable: {{${token}}}`);};
    out.card_background=c.card_background==null?null:color(c.card_background);
    out.text = {};
    for (const [key, value] of Object.entries(c.text)) {
      const entry = textCatalog[key];
      if (!Object.hasOwn(textCatalog, key) || entry.field) fail('Unknown ticket text field.');
      const text = string(value, entry.label, 500);
      validateVariables(text);
      out.text[key] = text;
    }
    for(const text of [...textFields.map(k=>out[k]),...out.extra_elements.filter(e=>['text','badge'].includes(e.type)).map(e=>e.text),...(out.layout_blocks||[]).filter(b=>b.type==='text').map(b=>b.text||'')])validateVariables(text);
    if (![...require('./ticketLayouts'), ...require('./legacyTicketLayouts')].some(layout => layout.id === c.layout)) fail('Choose a ticket layout.');
    out.layout = c.layout; out.background = color(c.background);
    out.show_attendee = Boolean(c.show_attendee); out.show_price = Boolean(c.show_price);
  } else {
    if (!Number.isInteger(Number(c.format)) || c.format < 1 || c.format > 11) fail('Choose email format 1–11.');
    out.format = Number(c.format);
    if (input.show_logo !== undefined) out.show_logo = input.show_logo !== false;
    out.attach_ticket_pdf = c.attach_ticket_pdf === true;
    if(c.attachments!=null && (!Array.isArray(c.attachments)||c.attachments.length>3)) fail('Attach up to three PDF files.');
    out.attachments=(c.attachments||[]).map(a=>{if(!a||typeof a.id!=='string'||!/^[a-f0-9]{32}$/.test(a.id))fail('Choose a valid PDF attachment.');return {id:a.id};});
    if(new Set(out.attachments.map(a=>a.id)).size!==out.attachments.length)fail('Choose each attachment once.');
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
    for (const [,key] of tokens) if (!defaults.placeholders.includes(key)&&!/^field_f_[a-zA-Z0-9_-]{1,45}$/.test(key)) fail(`Unknown placeholder: {{${key}}}`);
  }
  return out;
}
function emailAddress(value, required = false) {
  string(value, 'Email address', 254, required);
  if (value && !/^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(value)) fail('Enter one valid email address.');
  return value;
}
module.exports = { fail, string, url, html, color, template, emailAddress, socialLinks, socialMode };
