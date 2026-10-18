const express=require('express');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const db=require('../config/db');
const {asyncHandler:wrap}=require('../middleware/errorHandler');
const {verifyToken,requireSuperAdmin}=require('../middleware/auth');
const {fail,string,emailAddress}=require('../services/studioValidation');
const {signup,siteUrl}=require('./provision');
const {rateLimit}=require('./tenancy');
const payments=require('./payments');
const paymentSettings=require('./paymentSettings');
const ok=(res,data={})=>res.json({success:true,data});
const publicRouter=express.Router();
publicRouter.post('/signup',rateLimit(5,3600000),wrap(async(req,res)=>{res.status(201);ok(res,{organization:await signup(req.body)});}));
publicRouter.get('/packages',wrap(async(req,res)=>{const [packages]=await db.platform.query('SELECT id,name,event_count,price_paise FROM event_packages WHERE active=TRUE ORDER BY event_count');ok(res,{packages,payments_ready:await payments.configured()});}));
const organizer=express.Router();
organizer.use(verifyToken);
organizer.get('/account',wrap(async(req,res)=>{
 const [[org]]=await db.platform.query('SELECT id,name,slug,event_balance,status FROM organizations WHERE id=?',[req.organization.id]);
 const [ledger]=await db.platform.query('SELECT id,amount,kind,reason,created_at FROM event_credits WHERE organization_id=? ORDER BY id DESC LIMIT 100',[org.id]);
 const [purchases]=await db.platform.query('SELECT id,package_name,event_count,amount_paise,currency,status,provider_order_id,created_at,paid_at FROM package_purchases WHERE organization_id=? ORDER BY created_at DESC LIMIT 100',[org.id]);
 const [packages]=await db.platform.query('SELECT id,name,event_count,price_paise FROM event_packages WHERE active=TRUE ORDER BY event_count');
 const [[totals]]=await db.platform.query(`SELECT
   (SELECT COALESCE(SUM(event_count),0) FROM package_purchases WHERE organization_id=? AND status='paid') purchased_events,
   (SELECT COALESCE(-SUM(amount),0) FROM event_credits WHERE organization_id=? AND kind='publish') used_events,
   (SELECT COALESCE(SUM(amount),0) FROM event_credits WHERE organization_id=? AND kind='adjustment') adjusted_events`,[org.id,org.id,org.id]);
 const [[latestPurchase]]=await db.platform.query("SELECT id,package_name,event_count,amount_paise,currency,paid_at FROM package_purchases WHERE organization_id=? AND status='paid' ORDER BY paid_at DESC,id DESC LIMIT 1",[org.id]);
 const allowed=org.status==='active'&&org.event_balance>0;
 const subscription={...totals,remaining_events:org.event_balance,latest_purchase:latestPurchase||null,can_create:allowed,can_publish:allowed};
 ok(res,{organization:{...org,site_url:siteUrl(req.organization)},subscription,ledger,purchases,packages,payments_ready:await payments.configured()});
}));
organizer.post('/purchases',requireSuperAdmin,wrap(async(req,res)=>ok(res,await payments.createPurchase(req.organization.id,req.body.package_id,req.body.request_key))));
organizer.post('/purchases/verify',requireSuperAdmin,wrap(async(req,res)=>{await payments.verify(req.organization.id,req.body);ok(res);}));
organizer.post('/purchases/:id/reconcile',requireSuperAdmin,wrap(async(req,res)=>ok(res,await payments.reconcile(req.params.id,req.organization.id))));
organizer.get('/team',requireSuperAdmin,wrap(async(req,res)=>{const [members]=await db.query('SELECT id,name,email,role FROM admins ORDER BY id');ok(res,{members});}));
organizer.post('/team',requireSuperAdmin,wrap(async(req,res)=>{
 const name=string(req.body.name,'Name',100,true),email=emailAddress(string(req.body.email,'Email',150,true),true).toLowerCase();
 if(typeof req.body.password!=='string' || req.body.password.length<12 || Buffer.byteLength(req.body.password)>72) fail('Use a password of 12 or more characters, up to 72 bytes.');
 // Owner and manager only for this release. Check-in-only event assignment is a separate role, never simulated by hiding navigation.
 if(!['staff','super_admin'].includes(req.body.role)) fail('Choose an owner or manager role.');
 const member=await require('../models/Admin').create({name,email,passwordHash:await bcrypt.hash(req.body.password,12),role:req.body.role});
 ok(res,{member});
}));
organizer.delete('/team/:id',requireSuperAdmin,wrap(async(req,res)=>{
 if(Number(req.params.id)===req.admin.id) fail('You cannot remove your own account.');
 if(!/^[1-9]\d*$/.test(req.params.id))fail('Team member not found.',404);
 await require('../models/Admin').remove(req.params.id,req.admin.id);ok(res);
}));
const platform=express.Router();
platform.post('/login',rateLimit(15,15*60000),wrap(async(req,res)=>{
 const email=String(req.body.email || '').toLowerCase().trim();
 const [[admin]]=await db.platform.query('SELECT * FROM platform_admins WHERE email=? AND active=TRUE',[email]);
 if(!admin || typeof req.body.password!=='string' || !await bcrypt.compare(req.body.password,admin.password_hash)) fail('Invalid email or password.',401);
 ok(res,{token:jwt.sign({id:admin.id,type:'platform'},process.env.JWT_SECRET,{expiresIn:'4h'}),admin:{id:admin.id,name:admin.name}});
}));
platform.use(wrap(async(req,res,next)=>{
 try {
  const decoded=jwt.verify((req.get('Authorization') || '').replace(/^Bearer /,''),process.env.JWT_SECRET);
  if(decoded.type!=='platform') fail('Platform administrator access required.',403);
  const [[admin]]=await db.platform.query('SELECT id,name,email FROM platform_admins WHERE id=? AND active=TRUE',[decoded.id]);
  if(!admin) fail('Platform account unavailable.',401);
  req.platformAdmin=admin;
 }catch(e){return res.status(e.statusCode || 401).json({success:false,message:'Platform administrator sign-in required.'});}
 next();
}));

const withdrawals=require('../services/withdrawals');
platform.get('/withdrawals',wrap(async(req,res)=>{const [organizations]=await db.platform.query('SELECT id,name FROM organizations');ok(res,{withdrawals:await withdrawals.list(),organizations});}));
platform.get('/withdrawals/:id/bank',wrap(async(req,res)=>{res.set('Cache-Control','no-store');ok(res,await withdrawals.detail(req.params.id,req.platformAdmin.id));}));
platform.post('/withdrawals/:id/review',wrap(async(req,res)=>ok(res,await withdrawals.review(req.params.id,req.body,req.platformAdmin.id))));
platform.post('/withdrawals/:id/sync',wrap(async(req,res)=>{await require('../services/bankPayouts').reconcile(req.params.id);ok(res);}));
platform.get('/settings/payouts',wrap(async(req,res)=>{res.set('Cache-Control','no-store');ok(res,{payout:require('./payoutSettings').safe(await require('./payoutSettings').get()),site_url:process.env.PUBLIC_SITE_URL||'http://localhost:5173'});}));
platform.put('/settings/payouts',wrap(async(req,res)=>ok(res,{payout:await require('./payoutSettings').save(req.body,req.platformAdmin.id)})));
platform.get('/booking-payments',wrap(async(req,res)=>{const [payments]=await db.platform.query('SELECT p.id,p.organization_id,p.event_id,p.order_id,p.mode,p.amount_minor,p.currency,p.status,p.provider_order_id,p.provider_payment_id,p.created_at,o.name organization_name FROM booking_payments p JOIN organizations o ON o.id=p.organization_id ORDER BY p.created_at DESC LIMIT 100');ok(res,{payments});}));
platform.post('/booking-payments/:id/refund',wrap(async(req,res)=>ok(res,await require('../services/bookingPayments').refund(req.params.id))));
platform.post('/purchases/:id/reconcile',wrap(async(req,res)=>ok(res,await payments.reconcile(req.params.id))));
platform.get('/settings',wrap(async(req,res)=>ok(res,{smtp:require('./settings').safe(await require('./settings').getSmtp()),payments_ready:await payments.configured(),webhook_ready:Boolean((await paymentSettings.get()).webhook_secret),site_url:process.env.PUBLIC_SITE_URL||'http://localhost:5173'})));
platform.put('/settings/smtp',wrap(async(req,res)=>ok(res,{smtp:await require('./settings').saveSmtp(req.body,req.platformAdmin.id)})));
platform.post('/settings/smtp/verify',wrap(async(req,res)=>{let transport;try{transport=require('../services/mailer').transport(await require('./settings').getSmtp());await transport.verify();}catch{fail('Connection failed. Check the saved mail configuration.',502);}finally{transport?.close();}ok(res);}));
platform.post('/settings/smtp/test',rateLimit(5,60000),wrap(async(req,res)=>{
 const recipient=emailAddress(req.body.recipient,true);
 const smtp=await require('./settings').getSmtp();
 if(!smtp.host || !smtp.from_email) fail('Save your SMTP host and sender email before sending a test.');
 try {
  // An explicit test is allowed before automatic notifications are enabled.
  await require('../services/mailer').send({...smtp,enabled:true},recipient,{subject:'[TEST] Platform SMTP connection',html:'<h2>Your SMTP test email</h2><p>This email was sent using your saved platform SMTP settings.</p><p>You can now configure your automatic platform emails.</p>'});
 }catch{fail('Test email could not be sent. Check your saved SMTP settings and recipient address.',502);}
 ok(res,{message:'Test email accepted by the SMTP server. Check your inbox and spam folder.'});
}));
platform.get('/settings/payments',wrap(async(req,res)=>ok(res,{payment:paymentSettings.safe(await paymentSettings.get()),site_url:process.env.PUBLIC_SITE_URL||'http://localhost:5173'})));
platform.put('/settings/payments',wrap(async(req,res)=>ok(res,{payment:await paymentSettings.save(req.body,req.platformAdmin.id)})));
platform.use('/website',require('./websiteRoutes'));
platform.use('/email',require('./platformMailRoutes'));
platform.get('/overview',wrap(async(req,res)=>{
 const [[stats]]=await db.platform.query(`SELECT (SELECT COUNT(*) FROM organizations WHERE status IN ('active','suspended')) organizers,(SELECT COALESCE(SUM(amount_paise),0) FROM package_purchases WHERE status='paid') revenue_paise,(SELECT COALESCE(SUM(event_balance),0) FROM organizations) remaining_events,(SELECT COUNT(*) FROM event_credits WHERE kind='publish') published_events`);
 const [organizations]=await db.platform.query('SELECT id,name,slug,owner_email,status,event_balance,is_legacy,created_at FROM organizations ORDER BY id DESC LIMIT 200');
 const [packages]=await db.platform.query('SELECT * FROM event_packages ORDER BY id');
 const [purchases]=await db.platform.query('SELECT p.*,o.name organization_name FROM package_purchases p JOIN organizations o ON o.id=p.organization_id ORDER BY p.created_at DESC LIMIT 200');
 const [audit]=await db.platform.query('SELECT a.*,o.name organization_name FROM platform_audit a LEFT JOIN organizations o ON o.id=a.organization_id ORDER BY a.id DESC LIMIT 100');
 ok(res,{stats,organizations:organizations.map(o=>({...o,site_url:siteUrl(o)})),packages,purchases,audit,payments_ready:await payments.configured(),webhook_ready:Boolean((await paymentSettings.get()).webhook_secret)});
}));
platform.post('/packages',wrap(async(req,res)=>{
 const name=string(req.body.name,'Package name',100,true),count=Number(req.body.event_count),price=Number(req.body.price_paise);
 if(!Number.isInteger(count)||count<1||count>100000||!Number.isInteger(price)||price<100||price>100000000) fail('Enter 1–100,000 events and a price between ₹1 and ₹10,00,000.');
 const conn=await db.platform.getConnection();
 try{await conn.beginTransaction();
  let id=req.body.id;
  if(id){const [r]=await conn.query('UPDATE event_packages SET name=?,event_count=?,price_paise=?,active=? WHERE id=?',[name,count,price,req.body.active===true,id]);if(!r.affectedRows) fail('Package not found.',404);}
  else{const [r]=await conn.query('INSERT INTO event_packages(name,event_count,price_paise,active) VALUES (?,?,?,?)',[name,count,price,req.body.active===true]);id=r.insertId;}
  await conn.query("INSERT INTO platform_audit(actor_id,action,details_json) VALUES (?,'package.save',?)",[req.platformAdmin.id,JSON.stringify({id,name,event_count:count,price_paise:price,active:req.body.active===true})]);
  await conn.commit();ok(res,{id});
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));
platform.post('/organizations/:id/credits',wrap(async(req,res)=>{await require('./credits').adjust(Number(req.params.id),Number(req.body.amount),req.body.reason,req.platformAdmin.id,req.body.request_key);ok(res);}));
platform.patch('/organizations/:id/status',wrap(async(req,res)=>{
 if(!['active','suspended'].includes(req.body.status)) fail('Choose active or suspended.');
 const reason=string(req.body.reason,'Reason',500,true);
 const conn=await db.platform.getConnection();
 try{await conn.beginTransaction();
  const [[before]]=await conn.query('SELECT * FROM organizations WHERE id=? FOR UPDATE',[req.params.id]);
  const [r]=await conn.query("UPDATE organizations SET status=? WHERE id=? AND status IN ('active','suspended')",[req.body.status,req.params.id]);
  if(!r.affectedRows) fail('Organizer not found or provisioning incomplete.',404);
  await conn.query("INSERT INTO platform_audit(actor_id,organization_id,action,details_json) VALUES (?,?,'organization.status',?)",[req.platformAdmin.id,req.params.id,JSON.stringify({status:req.body.status,reason})]);
  if(before.status!==req.body.status){
    await require('./platformMail').enqueue(conn,req.body.status==='active'?'organization_reactivated':'organization_suspended',before.id,before.owner_email,{organization_name:before.name,owner_name:before.name,workspace_url:siteUrl(before)+'/admin',reason},'status:'+require('node:crypto').randomUUID());
  }
  await conn.commit();ok(res);
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));
platform.get('/organizations/:id/events',wrap(async(req,res)=>{
 const [[org]]=await db.platform.query("SELECT * FROM organizations WHERE id=? AND status IN ('active','suspended')",[req.params.id]);
 if(!org) fail('Organizer not found.',404);
 const events=await db.run(org,()=>require('../models/Event').findAll({limit:100}));
 await db.platform.query("INSERT INTO platform_audit(actor_id,organization_id,action,details_json) VALUES (?,?,'events.view','{}')",[req.platformAdmin.id,org.id]);
 ok(res,{events});
}));
platform.get('/organizations/:id',wrap(async(req,res)=>{
 if(!/^[1-9]\d*$/.test(req.params.id)||!Number.isSafeInteger(Number(req.params.id)))fail('Organizer not found.',404);
 const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE id=?',[req.params.id]);
 if(!org)fail('Organizer not found.',404);
 const [purchases]=await db.platform.query('SELECT id,organization_id,package_name,event_count,amount_paise,currency,status,provider_payment_id,provider_order_id,created_at,paid_at FROM package_purchases WHERE organization_id=? ORDER BY created_at DESC LIMIT 100',[org.id]);
 const [ledger]=await db.platform.query('SELECT id,organization_id,amount,kind,reason,created_at FROM event_credits WHERE organization_id=? ORDER BY id DESC LIMIT 100',[org.id]);
 const [audit]=await db.platform.query('SELECT id,organization_id,action,details_json,created_at FROM platform_audit WHERE organization_id=? ORDER BY id DESC LIMIT 100',[org.id]);
 const [[paymentsSummary]]=await db.platform.query("SELECT COUNT(*) purchases,COALESCE(SUM(CASE WHEN status='paid' THEN amount_paise ELSE 0 END),0) total_paid_paise FROM package_purchases WHERE organization_id=?",[org.id]);
 let events=[],eventStats={total_events:0,published_events:0,tickets_sold:0};
 const workspaceReady=['active','suspended'].includes(org.status);
 if(workspaceReady){
  await db.run(org,async()=>{
   events=await require('../models/Event').findAll({limit:100});
   const [[stats]]=await db.query("SELECT (SELECT COUNT(*) FROM events WHERE archived_at IS NULL) total_events,(SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND status='published') published_events,(SELECT COALESCE(SUM(tt.sold),0) FROM ticket_types tt JOIN events e ON e.id=tt.event_id WHERE e.archived_at IS NULL) tickets_sold");
   eventStats=stats;
  });
 }
 // Return only account fields intended for the superadmin UI, never database credentials.
 const {id,name,slug,owner_email,status,event_balance,is_legacy,created_at}=org;
 ok(res,{organization:{id,name,slug,owner_email,status,event_balance,is_legacy,created_at,site_url:siteUrl(org)},workspace_ready:workspaceReady,stats:{...eventStats,...paymentsSummary},events,purchases,ledger,audit});
}));
module.exports={publicRouter,organizer,platform};
