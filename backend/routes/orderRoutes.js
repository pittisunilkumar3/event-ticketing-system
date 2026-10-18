const router = require('express').Router();
const controller = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.use('/tickets', require('./ticketReportRoutes'));
router.get('/', controller.list);
router.get('/:id', controller.detail);
router.get('/:id/registration-files/:field',require('../middleware/errorHandler').asyncHandler(async(req,res)=>{
 const [[file]]=await require('../config/db').query('SELECT file_name,mime_type,file_data FROM registration_answer_files WHERE order_id=? AND field_id=?',[req.params.id,req.params.field]);
 if(!file)return res.status(404).json({success:false,message:'Attachment not found.'});
 res.attachment(file.file_name);res.set('Content-Type',file.mime_type);res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','private, no-store');res.send(file.file_data);
}));
router.get('/:id/attendees/:attendeeId/files/:field',require('../middleware/errorHandler').asyncHandler(async(req,res)=>{
 const [[file]]=await require('../config/db').query('SELECT f.file_name,f.mime_type,f.file_data FROM attendee_registration_files f JOIN order_attendees a ON a.id=f.attendee_id WHERE a.order_id=? AND a.id=? AND f.field_id=?',[req.params.id,req.params.attendeeId,req.params.field]);
 if(!file)return res.status(404).json({success:false,message:'Attachment not found.'});
 res.attachment(file.file_name);res.set('Content-Type',file.mime_type);res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','private, no-store');res.send(file.file_data);
}));
router.patch('/:id/cancel', controller.cancel);
router.patch('/:id/refund', controller.refund);

module.exports = router;
