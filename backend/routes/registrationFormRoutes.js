const router=require('express').Router();
const db=require('../config/db');
const forms=require('../services/registrationForms');
const {verifyToken,requireSuperAdmin}=require('../middleware/auth');
const {asyncHandler:wrap}=require('../middleware/errorHandler');
const v=require('../services/studioValidation');
router.use(verifyToken,requireSuperAdmin);
const ok=(res,data)=>res.json({success:true,data});
router.get('/templates',wrap(async(req,res)=>{const [rows]=await db.query('SELECT id,name,config_json FROM registration_form_templates ORDER BY id DESC LIMIT 100');ok(res,{templates:rows.map(({config_json,...row})=>({...row,config:JSON.parse(config_json)}))});}));
router.post('/templates',wrap(async(req,res)=>{const config=forms.validate(req.body.config),name=v.string(req.body.name,'Template name',120,true);const [result]=await db.query('INSERT INTO registration_form_templates(name,config_json) VALUES (?,?)',[name,JSON.stringify(config)]);res.status(201);ok(res,{template:{id:result.insertId,name,config}});}));
router.get('/events/:id',wrap(async(req,res)=>{if(!await require('../models/Event').findById(req.params.id))v.fail('Event not found.',404);ok(res,{form:await forms.get(req.params.id)});}));
router.put('/events/:id',wrap(async(req,res)=>ok(res,{form:await forms.save(req.params.id,req.body)})));
router.get('/events/:id/tickets/:typeId',wrap(async(req,res)=>ok(res,{form:await forms.ticket(req.params.id,req.params.typeId)})));
router.put('/events/:id/tickets/:typeId',wrap(async(req,res)=>ok(res,{form:await forms.saveTicket(req.params.id,req.params.typeId,req.body)})));
router.get('/events/:id/responses',wrap(async(req,res)=>{
 if(!await require('../models/Event').findById(req.params.id))v.fail('Event not found.',404);
 const page=Number(req.query.page||1);if(!Number.isSafeInteger(page)||page<1||page>100000)v.fail('Choose a valid response page.');
 const source=`SELECT o.id,CONCAT('booking-',o.id) response_id,o.booking_ref,o.customer_name COLLATE utf8mb4_unicode_ci customer_name,o.email COLLATE utf8mb4_unicode_ci email,o.created_at,a.answers_json COLLATE utf8mb4_unicode_ci answers_json,NULL ticket_type FROM orders o JOIN order_registration_answers a ON a.order_id=o.id WHERE o.archived_at IS NULL AND o.event_id=?
 UNION ALL SELECT o.id,CONCAT('attendee-',a.id) response_id,o.booking_ref,a.name COLLATE utf8mb4_unicode_ci customer_name,a.email COLLATE utf8mb4_unicode_ci email,o.created_at,a.answers_json COLLATE utf8mb4_unicode_ci answers_json,tt.name ticket_type FROM order_attendees a JOIN orders o ON o.id=a.order_id JOIN ticket_types tt ON tt.id=a.ticket_type_id WHERE o.archived_at IS NULL AND o.event_id=? AND a.answers_json IS NOT NULL`;
 const [rows]=await db.query('SELECT * FROM ('+source+') responses ORDER BY id DESC,response_id LIMIT 50 OFFSET ?',[req.params.id,req.params.id,(page-1)*50]);
 const [[{total}]]=await db.query('SELECT COUNT(*) total FROM ('+source+') responses',[req.params.id,req.params.id]);
 ok(res,{responses:rows.map(({answers_json,...r})=>({...r,answers:JSON.parse(answers_json)})),total,page});
}));
module.exports=router;
