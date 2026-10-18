// Mounted only after the platform administrator authorization middleware.
const router=require('express').Router();
const db=require('../config/db');
const mail=require('./platformMail');
const settings=require('./settings');
const v=require('../services/studioValidation');
const {asyncHandler:wrap}=require('../middleware/errorHandler');
const upload=require('../middleware/upload');
router.post('/upload',upload.single('image'),(req,res)=>{if(!req.file)v.fail('Choose an image.');res.json({success:true,data:{url:upload.url(req)}});});
const ok=(res,data,message)=>res.json({success:true,data,message});
router.get('/',wrap(async(req,res)=>{await mail.initialize();ok(res,{templates:await mail.templates(),placeholders:mail.placeholders,smtp:settings.safe(await settings.getSmtp()),website:await mail.websiteContext(),socialNames:mail.socialNames});}));
router.put('/templates/:key',wrap(async(req,res)=>ok(res,{template:await mail.save(req.params.key,req.body,req.platformAdmin.id)},'Platform template saved.')));
router.post('/preview',wrap(async(req,res)=>{const config=mail.validate(req.body.config,req.body.event_key);ok(res,mail.render(config,await settings.getSmtp(),mail.sample,await mail.websiteContext()));}));
router.post('/test',wrap(async(req,res)=>{
  const recipient=v.emailAddress(req.body.recipient,true),config=mail.validate(req.body.config,req.body.event_key);
  const smtp=await settings.getSmtp(),rendered=mail.render(config,smtp,mail.sample,await mail.websiteContext());rendered.subject='[TEST] '+rendered.subject;
  try{await require('../services/mailer').send(smtp,recipient,rendered);}catch{v.fail('Test email failed. Check platform SMTP settings and the recipient.',502);}
  ok(res,{},'Test email accepted by the platform SMTP server.');
}));
router.get('/deliveries',wrap(async(req,res)=>{
  const [logs]=await db.platform.query('SELECT m.id,m.event_key,m.recipient,m.status,m.attempts,m.error_message,m.created_at,o.name organization_name FROM platform_mail_outbox m LEFT JOIN organizations o ON o.id=m.organization_id ORDER BY m.id DESC LIMIT 100');ok(res,{logs});
}));
router.post('/deliveries/:id/retry',wrap(async(req,res)=>{
  const smtp=await settings.getSmtp();if(!smtp.enabled)v.fail('Enable platform SMTP delivery first.');
  const [[job]]=await db.platform.query('SELECT * FROM platform_mail_outbox WHERE id=?',[req.params.id]);if(!job)v.fail('Message not found.',404);
  const template=(await mail.templates()).find(t=>t.event_key===job.event_key);if(!template?.active)v.fail('Enable this platform email template first.');
  const recipient=template.audience==='platform' ? smtp.notification_email : job.recipient;if(!recipient)v.fail('Set a platform notification email before retrying.');
  const [r]=await db.platform.query("UPDATE platform_mail_outbox SET status='pending',recipient=?,error_message=NULL WHERE id=? AND status IN ('failed','skipped')",[recipient,job.id]);
  if(!r.affectedRows)v.fail('Only failed or skipped messages can be retried.',409);ok(res,{},'Platform email queued for retry.');
}));
module.exports=router;
