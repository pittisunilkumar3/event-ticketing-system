const router = require('express').Router();
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
router.use(verifyToken, requireSuperAdmin,(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/', asyncHandler(async (req, res) => {
  res.json({success:true,data:await require('../services/eventWallet').overview(req.query)});
}));

const withdrawals=require('../services/withdrawals');
router.get('/withdrawals',asyncHandler(async(req,res)=>res.json({success:true,data:{withdrawals:await withdrawals.list(req.organization.id)}})));
router.post('/withdrawals',asyncHandler(async(req,res)=>res.status(201).json({success:true,data:await withdrawals.request(req.body,req.admin.id)})));
router.post('/withdrawals/:id/cancel',asyncHandler(async(req,res)=>res.json({success:true,data:await withdrawals.review(req.params.id,{action:'cancel'},req.admin.id,req.organization.id)})));
module.exports = router;
