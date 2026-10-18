const router = require('express').Router();
const controller = require('../controllers/ticketTypeController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);
router.get('/designs', require('../middleware/errorHandler').asyncHandler(async (req, res) => {
  const layouts = require('../services/ticketLayouts');
  const templates = (await require('../models/Studio').templates('ticket')).filter(t => t.active).map(t => ({
    ...t, category: layouts.find(layout => layout.id === t.config.layout?.split('--')[0])?.category || 'Horizontal',
  }));
  res.json({ success: true, data: { templates, defaultDesign: require('../services/studioDefaults').ticket } });
}));

router.get('/email-templates',require('../middleware/errorHandler').asyncHandler(async(req,res)=>{
 const templates=(await require('../models/Studio').templates('email')).filter(t=>t.active&&!t.event_key).map(t=>({id:t.id,name:t.name}));
 res.json({success:true,data:{templates}});
}));
router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.post('/:id/restore', controller.restore);
router.delete('/:id', controller.remove);

module.exports = router;
