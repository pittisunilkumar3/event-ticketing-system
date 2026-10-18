const router=require('express').Router(),db=require('../config/db'),messages=require('../services/organizerMessages');
const {verifyToken,requireSuperAdmin}=require('../middleware/auth'),{asyncHandler:wrap}=require('../middleware/errorHandler');
const {rateLimit}=require('../saas/tenancy');
router.use(verifyToken,requireSuperAdmin);
router.use((req,res,next)=>req.organization.is_legacy?res.status(403).json({success:false,message:'This feature is available in organizer accounts.'}):next());
const ok=(res,data)=>res.json({success:true,data});
router.get('/',wrap(async(req,res)=>{
 const [events]=await db.query('SELECT id,title FROM events ORDER BY id DESC LIMIT 1000');
 const smtp=await require('../models/Studio').getSetting('smtp');
 ok(res,{events,messages:await messages.list(),fields:messages.fields,smtp_enabled:!!(smtp.enabled&&smtp.host&&smtp.from_email)});
}));
router.get('/recipients',wrap(async(req,res)=>ok(res,await messages.audience(req.query.event_id,req.query.search||'',req.query.ticket_type_id))));
router.post('/preview',wrap(async(req,res)=>ok(res,await messages.preview(req.body))));
router.post('/',rateLimit(10,60000),wrap(async(req,res)=>ok(res,await messages.enqueue(req.body,req.admin.id))));
router.get('/:id',wrap(async(req,res)=>ok(res,await messages.detail(req.params.id))));
router.post('/:id/:action',rateLimit(10,60000),wrap(async(req,res)=>{await messages.action(req.params.id,req.params.action);ok(res,{});}));
module.exports=router;
