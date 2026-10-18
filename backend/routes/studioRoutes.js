const router = require('express').Router();
const db = require('../config/db');
const Studio = require('../models/Studio');
const defaults = require('../services/studioDefaults');
const v = require('../services/studioValidation');
const { renderEmail, sampleData } = require('../services/emailRenderer');
const mailer = require('../services/mailer');
const attachments=require('../services/emailAttachments');
async function checkedConfig(kind,input){const config=v.template(kind,input);if(kind==='email')await attachments.list(config);return config;}
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const { asyncHandler: wrap } = require('../middleware/errorHandler');
const upload = require('../middleware/upload');
const { rateLimit } = require('../saas/tenancy');
router.use(verifyToken, requireSuperAdmin);
router.use((req,res,next)=>{if(req.organization.is_legacy && (['/brand','/social-links'].includes(req.path) || req.path.startsWith('/pages/')))return res.status(403).json({success:false,message:'Manage the platform website in Superadmin → Website & branding or Policies & pages.'});next();});
const ok = (res,data,message='Saved') => res.json({success:true,data,message});

router.get('/bootstrap',wrap(async (req,res) => {
  await Studio.initialize();
  const ticketTemplates = await Studio.templates('ticket');
  const savedLayouts = new Set(ticketTemplates.map(t => t.config.layout));
  const ticketLayouts = [
    ...require('../services/ticketLayouts'),
    ...require('../services/legacyTicketLayouts').filter(layout => savedLayouts.has(layout.id)),
  ];
  const [emailTicketTypes]=await db.query('SELECT t.id,t.name,e.title event_title FROM ticket_types t JOIN events e ON e.id=t.event_id WHERE t.archived_at IS NULL AND e.archived_at IS NULL ORDER BY e.id DESC,t.sort_order,t.id LIMIT 1000');
  const smtp = await Studio.getSetting('smtp');
  ok(res, { brand: await Studio.getSetting('brand'), smtp: require('../services/smtpSettings').safe(smtp),
    emailTicketTypes,ticketTemplates, ticketLayouts, emailTemplates: await Studio.templates('email'),
    pages: await Studio.pages(), socialLinks: await Studio.getSetting('social_links'), defaults: { ticket:defaults.ticket,email:defaults.email }, placeholders:defaults.placeholders });
}));

router.post('/upload',upload.single('image'),wrap(async(req,res)=> {
  if (!req.file) v.fail('Choose an image to upload.');
  ok(res,{url:require('../middleware/upload').url(req)},'Image uploaded');
}));

router.post('/templates',wrap(async(req,res)=> {
  const { kind, name, config } = req.body;
  const saved = await Studio.saveTemplate({kind,name:v.string(name,'Template name',120,true),active:req.body.active !== false,config:await checkedConfig(kind,config)});
  res.status(201); ok(res,{template:saved},'Template created');
}));
router.put('/templates/:id',wrap(async(req,res)=> {
  const existing = await Studio.template(req.params.id);
  if (!existing) v.fail('Template not found.',404);
  const saved = await Studio.saveTemplate({id:existing.id,kind:existing.kind,name:v.string(req.body.name,'Template name',120,true),active:req.body.active !== false,config:await checkedConfig(existing.kind,req.body.config)});
  ok(res,{template:saved},'Template saved');
}));
router.get('/email-fields/:ticketTypeId',wrap(async(req,res)=>{
 const {type,fields}=await require('../services/ticketEmails').context(req.params.ticketTypeId);
 ok(res,{ticketType:{id:type.id,name:type.name,event_title:type.event_title},fields:fields.map(f=>({key:'field_'+f.id,label:f.label,type:f.type}))});
}));
async function emailPreviewData(req,brand){
 const personal=req.body.ticket_type_id?await require('../services/ticketEmails').preview(req.body.ticket_type_id):{...require('../services/ticketEmails').values({attendee_name:'Alex Morgan',attendee_email:'alex@example.test',attendee_phone:'+91 9876543210',type_name:'Sample pass',ticket_code:'TCK-PREVIEW-NOT-VALID'}),...await require('../services/ticketEmails').qr('TCK-PREVIEW-NOT-VALID',true)};
 return {...sampleData,booking_url:brand.site_url.replace(/\/$/,'')+'/confirmation/TKT-PREVIEW',...personal};
}
router.post('/email-attachment',require('multer')({storage:require('multer').memoryStorage(),limits:{fileSize:5*1024*1024,files:1}}).single('file'),wrap(async(req,res)=>{
 ok(res,{attachment:await db.run(req.organization,()=>attachments.upload(req.file))},'PDF uploaded');
}));
router.get('/email-attachments/:id',wrap(async(req,res)=>{
 const file=await attachments.read(req.params.id);res.set({'Content-Type':'application/pdf','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename="attachment.pdf"`});res.send(file.content);
}));
router.post('/email-ticket-preview',wrap(async(req,res)=>{
 const config=await checkedConfig('email',req.body.config),brand=await Studio.getSetting('brand');
 const data=await emailPreviewData(req,brand);const pdf=await require('../services/ticketPdf')(data,brand,config);
 res.set({'Content-Type':'application/pdf','Cache-Control':'no-store','Content-Disposition':'inline; filename="ticket-preview.pdf"'});res.send(pdf);
}));
router.post('/email-preview',wrap(async(req,res)=> {
  const config = await checkedConfig('email',req.body.config);
  const brand = await Studio.getSetting('brand');
  const data=await emailPreviewData(req,brand),files=await attachments.list(config);
  const ticketPdf=attachments.needsTicket(config);
  data.attachment_names=[...(ticketPdf?['ticket-'+data.ticket_code+'.pdf']:[]),...files.map(f=>f.name)];
  const [pages,social]=await Promise.all([Studio.pages(true),Studio.getSetting('social_links')]);
  const preview = renderEmail(config,brand,data,pages,social);
  // Return the same renderer's layouts together so selecting a format is instant.
  const formats=req.body.preview_formats===true?Object.fromEntries(Array.from({length:11},(_,i)=>[i+1,renderEmail({...config,format:i+1},brand,data,pages,social).html])):undefined;
  res.set('Cache-Control','no-store');
  ok(res,{...preview,formats,file_attachments:files,ticket_pdf:ticketPdf},'Preview ready');
}));
// Explicit button presses only; preview and save never send mail.
router.post('/email-test',wrap(async(req,res)=> {
  const recipient = v.emailAddress(req.body.recipient,true);
  const config = await checkedConfig('email',req.body.config);
  const brand = await Studio.getSetting('brand');
  const testData=await emailPreviewData(req,brand);
  if(/{{\s*(ticket|ticket_qr)\s*}}/.test(JSON.stringify(config)))Object.assign(testData,await require('../services/ticketEmails').qr(testData.ticket_code));
  const files=await attachments.build(config,brand,testData);testData.attachments=[...(testData.attachments||[]),...files];testData.attachment_names=files.map(f=>f.filename);
  const rendered = renderEmail(config,brand,testData,await Studio.pages(true),await Studio.getSetting('social_links'));
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
router.get('/brand',wrap(async(req,res)=> {
  ok(res,{brand:await Studio.getSetting('brand')},'Site settings loaded');
}));
router.put('/brand',wrap(async(req,res)=> {
  const current = await Studio.getSetting('brand');
  if(!req.organization.is_legacy) req.body.site_url=req.siteUrl;
  const brand = require('../services/siteSettings').validateSiteSettings(req.body,current);
  await Studio.saveSetting('brand',brand);
  ok(res,{brand},'Site settings saved');
}));
router.put('/smtp',wrap(async(req,res)=>{
  const smtp=require('../services/smtpSettings').validate(req.body,await Studio.getSetting('smtp'));
  await Studio.saveSetting('smtp',smtp);
  ok(res,{smtp:require('../services/smtpSettings').safe(smtp)},'Organization SMTP settings saved.');
}));
router.post('/smtp/test',rateLimit(5,60000),require('../controllers/smtpController').sendTest);
router.post('/smtp/verify',wrap(async(req,res)=>{
  let transport;
  try { transport=mailer.transport(await Studio.getSetting('smtp'));await transport.verify(); }
  catch { v.fail('Connection failed. Check this organization’s saved SMTP settings.',502); }
  finally { transport?.close(); }
  ok(res,{},'Organization connection verified. No email was sent.');
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
  const [logs]=await db.query('SELECT m.id,m.order_id,m.event_key,m.ticket_id,m.status,m.attempts,m.error_message,m.message_id,m.created_at,m.updated_at,m.recipient_key,m.recipient_name,o.booking_ref,COALESCE(m.recipient_email,o.email) email FROM mail_outbox m JOIN orders o ON o.id=m.order_id ORDER BY m.id DESC LIMIT 100');
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
