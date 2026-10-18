const db = require('../config/db');
const v = require('../services/studioValidation');
const { escape, replace } = require('../services/emailRenderer');
const settings = require('./settings');
const definitions = [
  {key:'organization_welcome',name:'Organization welcome',audience:'owner',description:'Sent to the owner after registration.',layout:'welcome',subject:'Welcome to {{platform_name}}, {{organization_name}}',title:'Your next chapter starts here.',eyebrow:'WELCOME ABOARD',body:'<p>Hi {{owner_name}},</p><p>Your <strong>{{organization_name}}</strong> workspace is ready. Create your first event, design your tickets, and make every guest feel welcome.</p><p>Start by adding your brand and configuring your organization’s own email delivery.</p>',button_name:'Open my workspace',button_url:'{{workspace_url}}'},
  {key:'registration_alert',name:'New organization alert',audience:'platform',description:'Sent to the platform notification email after registration.',layout:'notice',subject:'New organization: {{organization_name}}',title:'A new organizer has joined.',eyebrow:'ORGANIZATION REGISTRATION',body:'<p><strong>{{organization_name}}</strong> has registered on {{platform_name}}.</p><p>Owner: {{owner_name}}<br>Email: {{owner_email}}</p>',button_name:'View organizers',button_url:'{{platform_url}}'},
  {key:'payment_receipt',name:'Package payment receipt',audience:'owner',description:'Sent once after a verified package payment.',layout:'receipt',subject:'Payment received — {{package_name}}',title:'More room for great events.',eyebrow:'PAYMENT CONFIRMED',body:'<p>Hi {{owner_name}},</p><p>We received your payment for <strong>{{package_name}}</strong>. {{event_count}} event credits have been added to {{organization_name}}.</p>',button_name:'View event credits',button_url:'{{workspace_url}}/event-packages'},
  {key:'payment_alert',name:'Package payment alert',audience:'platform',description:'Sent to the platform notification email after a verified payment.',layout:'receipt',subject:'{{organization_name}} purchased {{package_name}}',title:'A new package purchase.',eyebrow:'PLATFORM PAYMENT',body:'<p><strong>{{organization_name}}</strong> purchased {{package_name}}.</p><p>The payment was verified and {{event_count}} event credits were added to their workspace.</p>',button_name:'View payments',button_url:'{{platform_url}}'},
  {key:'organization_suspended',name:'Organization suspended',audience:'owner',description:'Sent when the platform suspends an organization.',layout:'notice',subject:'An update about {{organization_name}}',title:'Your workspace is paused.',eyebrow:'ACCOUNT UPDATE',body:'<p>Hi {{owner_name}},</p><p>New bookings and changes for {{organization_name}} are paused. Existing records and guest check-in remain available.</p><p><strong>Reason:</strong> {{reason}}</p><p>Please contact platform support for help.</p>',button_name:'Open workspace',button_url:'{{workspace_url}}'},
  {key:'organization_reactivated',name:'Organization restored',audience:'owner',description:'Sent when a suspended organization is restored.',layout:'welcome',subject:'{{organization_name}} is ready to go',title:'Welcome back. Let’s get going.',eyebrow:'WORKSPACE RESTORED',body:'<p>Hi {{owner_name}},</p><p>Your {{organization_name}} workspace is active again. You can manage events, welcome new bookings, and get back to creating great experiences.</p>',button_name:'Open workspace',button_url:'{{workspace_url}}'},
];
const placeholders = ['platform_name','organization_name','owner_name','owner_email','workspace_url','site_url','platform_url','support_email','package_name','event_count','amount','purchase_id','payment_id','paid_at','reason','year'];
const sample = {organization_name:'Northstar Experiences',owner_name:'Alex Morgan',owner_email:'alex@example.test',workspace_url:'https://events.example.com/o/northstar/admin',site_url:'https://events.example.com/o/northstar',package_name:'Growth',event_count:10,amount:'₹2,499.00',purchase_id:'PKG-PREVIEW',payment_id:'pay_preview',paid_at:'14 October 2026',reason:'Please contact our team to review your account details.'};
const socialNames={facebook:'Facebook',instagram:'Instagram',twitter:'X (Twitter)',linkedin:'LinkedIn',pinterest:'Pinterest',youtube:'YouTube'};
const base = {icon:'',banner_image:'',page_links:[],social_channels:[],copyright_text:'© {{year}} {{platform_name}}',accent:'#ae673c',logo:'',preheader:'A little less admin. A lot more possibility.',footer_text:'You received this email about your organization’s account on {{platform_name}}.'};
function definition(key) { const d=definitions.find(d=>d.key===key);if(!d)v.fail('Platform email template not found.',404);return d; }
async function initialize(conn=db.platform) {
  for (const {key,name,audience,description,...config} of definitions) await conn.query('INSERT IGNORE INTO platform_email_templates(event_key,name,config_json) VALUES (?,?,?)',[key,name,JSON.stringify({...base,...config})]);
}
const parse = row => ({event_key:row.event_key,name:row.name,active:Boolean(row.active),config:{...base,...JSON.parse(row.config_json)},audience:definition(row.event_key).audience,description:definition(row.event_key).description});
async function templates() { const [rows]=await db.platform.query('SELECT * FROM platform_email_templates ORDER BY event_key');return rows.map(parse).sort((a,b)=>definitions.findIndex(d=>d.key===a.event_key)-definitions.findIndex(d=>d.key===b.event_key)); }
function validate(input,key) {
  const d=definition(key);if(!input || typeof input!=='object' || Array.isArray(input))v.fail('Invalid email design.');
  const c={...base,...d,...input},out={};
  for(const [field,max,required] of [['subject',255,true],['title',255,true],['eyebrow',80,false],['preheader',255,false],['button_name',80,false],['footer_text',1000,false],['copyright_text',300,false]]) out[field]=v.string(c[field]??'',field.replaceAll('_',' '),max,required);
  out.body=v.html(v.string(c.body,'Message',50000,true));
  if(!out.body.replace(/<[^>]*>/g,'').trim())v.fail('Write an email message.');
  if(!['welcome','receipt','notice'].includes(c.layout))v.fail('Choose a valid email layout.');
  out.layout=c.layout;out.accent=v.color(c.accent);out.logo=v.url(c.logo,{image:true});out.icon=v.url(c.icon,{image:true});out.banner_image=v.url(c.banner_image,{image:true});
  for(const [field,allowed] of [['page_links',require('../services/studioDefaults').pages.map(([slug])=>slug)],['social_channels',Object.keys(socialNames)]]){if(!Array.isArray(c[field])||c[field].some(k=>!allowed.includes(k)))v.fail('Choose valid footer links.');out[field]=[...new Set(c[field])];}
  out.button_url=v.string(c.button_url||'','Button URL',2048);
  if(out.button_url && !/^{{(workspace_url|site_url|platform_url)}}(?:\/[a-zA-Z0-9/-]*)?$/.test(out.button_url))out.button_url=v.url(out.button_url);
  if(out.button_name&&!out.button_url)v.fail('Provide a button destination or remove the button label.');
  for(const value of Object.values(out))for(const match of String(value).matchAll(/{{\s*([^{}]+?)\s*}}/g))if(!placeholders.includes(match[1]))v.fail('Unknown placeholder: '+match[1]);
  return out;
}
async function save(key,input,actor) {
  definition(key);const config=validate(input.config,key);
  await db.platform.query('UPDATE platform_email_templates SET name=?,active=?,config_json=? WHERE event_key=?',[v.string(input.name,'Template name',120,true),input.active===true,JSON.stringify(config),key]);
  await db.platform.query("INSERT INTO platform_audit(actor_id,action,details_json) VALUES (?,'email.template.save',?)",[actor,JSON.stringify({event_key:key})]);
  return (await templates()).find(t=>t.event_key===key);
}
async function websiteContext(){const website=require('./website');const [brand,pages,social]=await Promise.all([website.brand(),website.pages(true),website.social()]);return {brand,pages,social};}
function render(config, smtp, values={},website={}) {
  config={...base,...config};
  const origin=(process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/,'');
  const data={platform_name:website.brand?.company_name || smtp.from_name || 'TicketFlow',support_email:website.brand?.support_email || smtp.reply_to || smtp.from_email || '',platform_url:origin+'/superadmin',year:new Date().getFullYear(),...values};
  const text=value=>replace(value,data),accent=config.accent;
  const body=v.html(text(config.body)).replace(/src="(\/uploads\/[^"<>]+)"/g,(_,p)=>`src="${escape(origin+p)}"`);
  let href='';try{href=v.url(replace(config.button_url,data,false));}catch{/* Omit invalid destinations. */}
  const logo=config.logo?`<img alt="${escape(data.platform_name)}" src="${escape(config.logo.startsWith('/uploads/')?origin+config.logo:config.logo)}" width="130" style="max-width:130px;max-height:60px;object-fit:contain;display:block;margin-bottom:24px">`:'';
  const imageUrl=value=>escape(value.startsWith('/uploads/')?origin+value:value);
  const icon=config.icon?`<img src="${imageUrl(config.icon)}" alt="" width="48" style="display:block;margin-bottom:16px;max-width:48px">`:'';
  const banner=config.banner_image?`<tr><td><img src="${imageUrl(config.banner_image)}" alt="" width="600" style="display:block;width:100%;height:auto"></td></tr>`:'';
  const pageLinks=(website.pages||[]).filter(p=>p.published&&config.page_links.includes(p.slug)).map(p=>`<a href="${escape(origin+'/pages/'+p.slug)}" style="color:${accent}">${escape(p.title)}</a>`);
  const socialLinks=config.social_channels.filter(key=>website.social?.[key]).map(key=>`<a href="${escape(v.url(website.social[key]))}" style="color:${accent}">${socialNames[key]}</a>`);
  const links=[...pageLinks,...socialLinks];
  const footerLinks=links.length?`<p>${links.join(' &nbsp;·&nbsp; ')}</p>`:'';
  const brand=`${logo}${icon}<p style="font-size:15px;font-weight:bold;letter-spacing:1px;margin:0 0 30px">${escape(data.platform_name)}</p>`;
  const title=`<p style="font-size:10px;font-weight:bold;letter-spacing:2px;color:${accent};margin:0 0 16px">${text(config.eyebrow)}</p><h1 style="font-family:Georgia,serif;font-size:36px;font-weight:normal;line-height:1.16;letter-spacing:-1px;margin:0 0 24px">${text(config.title)}</h1>`;
  const message=`<div style="font-size:15px;line-height:1.8;color:#625e56">${body}</div>`;
  const button=config.button_name&&href?`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td bgcolor="${accent}" style="border-radius:6px"><a href="${escape(href)}" style="display:inline-block;padding:15px 24px;color:white;font-size:13px;font-weight:bold;text-decoration:none">${text(config.button_name)} &rarr;</a></td></tr></table>`:'';
  const rows=[['Organization',data.organization_name],['Package',data.package_name],['Event credits',data.event_count],['Payment reference',data.payment_id],['Purchase reference',data.purchase_id],['Paid on',data.paid_at]].filter(([,value])=>value!==undefined&&value!=='');
  const receipt=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid #e8e0d5">${rows.map(([label,value])=>`<tr><td style="padding:13px 0;border-bottom:1px solid #e8e0d5;font-size:12px;color:#817463">${label}</td><td style="padding:13px 0 13px 12px;border-bottom:1px solid #e8e0d5;font-size:12px;text-align:right;color:#302e29;word-break:break-word">${escape(value)}</td></tr>`).join('')}${data.amount?`<tr><td style="padding-top:22px;font-size:13px">Amount paid</td><td style="padding-top:22px;text-align:right;font-size:26px;font-family:Georgia,serif">${escape(data.amount)}</td></tr>`:''}</table>`;
  const layouts={
    welcome:`<tr><td style="padding:36px 32px 28px;background:#222b25;color:#f6eddf">${brand}${title}<p style="font-size:11px;letter-spacing:2px;color:#d0bd9f;margin:32px 0 0">CREATE. CONNECT. CELEBRATE.</p></td></tr><tr><td style="padding:30px 32px">${message}${button}</td></tr>`,
    receipt:`<tr><td style="padding:32px;border-bottom:1px dashed #cabbab">${brand}${title}${message}</td></tr><tr><td style="padding:4px 32px 32px;background:#fdfaf5">${receipt}${button}</td></tr>`,
    notice:`<tr><td style="height:8px;background:${accent}"></td></tr><tr><td style="padding:36px 32px">${brand}${title}<div style="border-left:3px solid ${accent};padding-left:20px">${message}</div>${button}</td></tr>`,
  };
  return {subject:replace(config.subject,data,false).replace(/[\r\n]/g,' '),html:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#eeeae3;font-family:Arial,Helvetica,sans-serif;color:#292d27"><div style="display:none;max-height:0;overflow:hidden">${text(config.preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eeeae3"><tr><td style="padding:32px 12px"><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">${banner}${layouts[config.layout]}<tr><td style="padding:24px 32px;border-top:1px solid #e9e3d9;font-size:11px;line-height:1.8;color:#8a8174">${text(config.footer_text)}${footerLinks}${data.support_email?`<p>Need a hand? <a style="color:${accent}" href="mailto:${escape(data.support_email)}">${escape(data.support_email)}</a></p>`:''}<p style="margin:20px 0 0">${text(config.copyright_text)}</p></td></tr></table></td></tr></table></body></html>`};
}
async function enqueue(conn,key,orgId,recipient,data,reference) {
  const d=definition(key),smtp=await settings.getSmtp();
  const [[template]]=await conn.query('SELECT active FROM platform_email_templates WHERE event_key=?',[key]);
  const to=d.audience==='platform' ? smtp.notification_email || '' : recipient || '';
  const enabled=smtp.enabled && template?.active && to;
  await conn.query('INSERT IGNORE INTO platform_mail_outbox(organization_id,event_key,recipient,data_json,reference_key,status,error_message) VALUES (?,?,?,?,?,?,?)',[orgId,key,to,JSON.stringify(data),reference,enabled?'pending':'skipped',enabled?null:!to?'No notification recipient is configured.':'Platform email delivery or this template was disabled.']);
}
let working=false;
async function processOutbox() {
  if(working)return;working=true;
  try {
    const smtp=await settings.getSmtp();if(!smtp.enabled)return;
    await db.platform.query("UPDATE platform_mail_outbox SET status='failed',error_message='Delivery interrupted. Check the recipient before retrying.' WHERE status='sending' AND updated_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)");
    const [jobs]=await db.platform.query("SELECT * FROM platform_mail_outbox WHERE status='pending' ORDER BY id LIMIT 10");
    for(const job of jobs){
      const [claim]=await db.platform.query("UPDATE platform_mail_outbox SET status='sending',attempts=attempts+1 WHERE id=? AND status='pending'",[job.id]);if(!claim.affectedRows)continue;
      try {
        const [[template]]=await db.platform.query('SELECT * FROM platform_email_templates WHERE event_key=? AND active=TRUE',[job.event_key]);
        if(!template){await db.platform.query("UPDATE platform_mail_outbox SET status='skipped',error_message='Template disabled before delivery.' WHERE id=?",[job.id]);continue;}
        if(!job.recipient)throw new Error('No recipient');
        const rendered=render(JSON.parse(template.config_json),smtp,JSON.parse(job.data_json),await websiteContext());
        const messageId=await require('../services/mailer').send(smtp,job.recipient,rendered,`<platform-${job.id}@${new URL(process.env.PUBLIC_SITE_URL || 'http://localhost:5173').hostname}>`);
        await db.platform.query("UPDATE platform_mail_outbox SET status='sent',message_id=?,error_message=NULL WHERE id=?",[messageId,job.id]);
      }catch{await db.platform.query("UPDATE platform_mail_outbox SET status='failed',error_message='Delivery failed. Verify platform SMTP settings and recipient, then retry.' WHERE id=?",[job.id]);}
    }
  }finally{working=false;}
}
module.exports={websiteContext,socialNames,definitions,placeholders,sample,initialize,templates,save,validate,render,enqueue,processOutbox};
