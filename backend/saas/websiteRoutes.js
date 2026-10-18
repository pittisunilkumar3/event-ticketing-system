// Mounted after platform authentication. No organizer token can write here.
const router=require('express').Router();
const website=require('./website');
const {asyncHandler:wrap}=require('../middleware/errorHandler');
const upload=require('../middleware/upload');
const ok=(res,data,message)=>res.json({success:true,data,message});
router.get('/brand',wrap(async(req,res)=>ok(res,{brand:await website.brand()})));
router.put('/brand',wrap(async(req,res)=>ok(res,{brand:await website.saveBrand(req.body,req.platformAdmin.id)},'Platform website settings saved.')));
router.get('/social-links',wrap(async(req,res)=>ok(res,{socialLinks:await website.social()})));
router.put('/social-links',wrap(async(req,res)=>ok(res,{socialLinks:await website.saveSocial(req.body.socialLinks,req.platformAdmin.id)},'Platform social links saved.')));
router.get('/pages',wrap(async(req,res)=>ok(res,{pages:await website.pages()})));
router.put('/pages/:slug',wrap(async(req,res)=>ok(res,{page:await website.savePage(req.params.slug,req.body,req.platformAdmin.id)},req.body.published?'Platform page published.':'Platform draft saved.')));
router.post('/upload',upload.single('image'),wrap(async(req,res)=>{if(!req.file)return res.status(400).json({success:false,message:'Choose an image to upload.'});ok(res,{url:upload.url(req)},'Platform image uploaded.');}));
module.exports=router;
