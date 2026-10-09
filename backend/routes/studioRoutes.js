const router = require('express').Router();
const db = require('../config/db');
const Studio = require('../models/Studio');
const defaults = require('../services/studioDefaults');
const v = require('../services/studioValidation');
const { encrypt } = require('../services/secrets');
const { renderEmail, sampleData } = require('../services/emailRenderer');
const mailer = require('../services/mailer');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const { asyncHandler: wrap } = require('../middleware/errorHandler');
const upload = require('../middleware/upload');
router.use(verifyToken, requireSuperAdmin);
const ok = (res,data,message='Saved') => res.json({success:true,data,message});

router.get('/bootstrap',wrap(async (req,res) => {
  await Studio.initialize();
  const smtp = await Studio.getSetting('smtp');
  const { password_encrypted, ...safeSmtp } = smtp;
  ok(res, { brand: await Studio.getSetting('brand'), smtp: {...safeSmtp,has_password:Boolean(password_encrypted)},
    ticketTemplates: await Studio.templates('ticket'), emailTemplates: await Studio.templates('email'),
    pages: await Studio.pages(), socialLinks: await Studio.getSetting('social_links'), defaults: { ticket:defaults.ticket,email:defaults.email }, placeholders:defaults.placeholders });
}));

router.post('/upload',upload.single('image'),wrap(async(req,res)=> {
  if (!req.file) v.fail('Choose an image to upload.');
  ok(res,{url:`/uploads/${req.file.filename}`},'Image uploaded');
}));

router.post('/templates',wrap(async(req,res)=> {
  const { kind, name, config } = req.body;
  const saved = await Studio.saveTemplate({kind,name:v.string(name,'Template name',120,true),active:req.body.active !== false,config:v.template(kind,config)});
  res.status(201); ok(res,{template:saved},'Template created');
}));
router.put('/templates/:id',wrap(async(req,res)=> {
  const existing = await Studio.template(req.params.id);
  if (!existing) v.fail('Template not found.',404);
  const saved = await Studio.saveTemplate({id:existing.id,kind:existing.kind,name:v.string(req.body.name,'Template name',120,true),active:req.body.active !== false,config:v.template(existing.kind,req.body.config)});
  ok(res,{template:saved},'Template saved');
}));
router.post('/email-preview',wrap(async(req,res)=> {
  const config = v.template('email',req.body.config);
  const brand = await Studio.getSetting('brand');
  const preview = renderEmail(config,brand,{...sampleData,booking_url:brand.site_url.replace(/\/$/,'')+'/confirmation/TKT-PREVIEW'},await Studio.pages(true),await Studio.getSetting('social_links'));
  ok(res,preview,'Preview ready');
}));
// Explicit button presses only; preview and save never send mail.
router.post('/email-test',wrap(async(req,res)=> {
  const recipient = v.emailAddress(req.body.recipient,true);
  const config = v.template('email',req.body.config);
  const brand = await Studio.getSetting('brand');
  const rendered = renderEmail(config,brand,{...sampleData,booking_url:brand.site_url.replace(/\/$/,'')+'/confirmation/TKT-PREVIEW'},await Studio.pages(true),await Studio.getSetting('social_links'));
  rendered.subject = '[TEST] ' + rendered.subject;
  try { await mailer.send(await Studio.getSetting('smtp'),recipient,rendered); }
  catch { v.fail('Test email failed. Check your SMTP settings and recipient address.',502); }
  ok(res,{},'Test email accepted by your SMTP server.');
}));
router.put('/social-links',wrap(async(req,res)=> {
  const socialLinks = v.socialLinks(req.body.socialLinks);
  await Studio.saveSetting('social_links',socialLinks);
  ok(res,{socialLinks},'Social media links saved.');
}));
router.put('/brand',wrap(async(req,res)=> {
  const b = req.body;
  const brand = {company_name:v.string(b.company_name,'Company name',120,true),site_url:v.url(b.site_url),support_email:v.emailAddress(b.support_email || ''),logo:v.url(b.logo,{image:true})};
  if (!brand.site_url) v.fail('Website URL is required.');
  const parsed = new URL(brand.site_url);
  if (parsed.search || parsed.hash || parsed.pathname !== '/') v.fail('Use the website origin, without a path or query.');
  brand.site_url = parsed.origin;
  await Studio.saveSetting('brand',brand); ok(res,{brand},'Brand settings saved');
}));
router.put('/smtp',wrap(async(req,res)=> {
  const b = req.body;
  const current = await Studio.getSetting('smtp');
  const port = Number(b.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) v.fail('Enter a valid SMTP port.');
  if (!['tls','starttls'].includes(b.encryption)) v.fail('Choose TLS or STARTTLS encryption.');
  const host = v.string(b.host,'SMTP host',255,true);
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) v.fail('Enter an SMTP hostname without a URL prefix.');
  const smtp = { enabled: b.enabled === true, host, port, encryption:b.encryption,
    username:v.string(b.username || '','Username',255),from_name:v.string(b.from_name,'Sender name',120,true),
    from_email:v.emailAddress(b.from_email,true),reply_to:v.emailAddress(b.reply_to || ''),password_encrypted:current.password_encrypted || '' };
  if (b.clear_password === true) smtp.password_encrypted = '';
  if (b.password) { v.string(b.password,'Password',2000,true); smtp.password_encrypted = encrypt(b.password); }
  if (smtp.username && !smtp.password_encrypted) v.fail('Enter an SMTP password for this username.');
  await Studio.saveSetting('smtp',smtp);
  const {password_encrypted,...safe} = smtp;
  ok(res,{smtp:{...safe,has_password:Boolean(password_encrypted)}},'SMTP settings saved');
}));
router.post('/smtp/verify',wrap(async(req,res)=> {
  let transport;
  try { transport=mailer.transport(await Studio.getSetting('smtp')); await transport.verify(); }
  catch { v.fail('Connection failed. Check the saved host, port, encryption, username and password.',502); }
  finally { transport?.close(); }
  ok(res,{},'SMTP connection and authentication verified. No email was sent.');
}));

router.put('/pages/:slug',wrap(async(req,res)=> {
  if (!defaults.pages.some(([slug])=>slug===req.params.slug)) v.fail('Page not found.',404);
  const title=v.string(req.body.title,'Page title',120,true);
  const body=v.html(v.string(req.body.body,'Page content',150000));
  const published=req.body.published===true;
  if (published && !body.replace(/<[^>]*>/g,'').trim()) v.fail('Write page content before publishing.');
  await db.query('UPDATE content_pages SET title=?,body=?,published=? WHERE slug=?',[title,body,published,req.params.slug]);
  ok(res,{page:(await Studio.pages()).find(p=>p.slug===req.params.slug)},published ? 'Page published' : 'Draft saved');
}));
router.get('/mail-log',wrap(async(req,res)=> {
  const [logs]=await db.query('SELECT m.*,o.booking_ref,o.email FROM mail_outbox m JOIN orders o ON o.id=m.order_id ORDER BY m.id DESC LIMIT 100');
  ok(res,{logs});
}));
router.post('/mail-log/:id/retry',wrap(async(req,res)=> {
  const smtp=await Studio.getSetting('smtp');
  if (!smtp.enabled) v.fail('Enable email delivery in SMTP settings first.');
  const [r]=await db.query("UPDATE mail_outbox SET status='pending',error_message=NULL WHERE id=? AND status IN ('failed','skipped')",[req.params.id]);
  if (!r.affectedRows) v.fail('Only failed or skipped messages can be retried.',409);
  ok(res,{},'Message queued for retry');
}));
module.exports=router;
