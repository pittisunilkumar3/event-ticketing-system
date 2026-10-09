const router = require('express').Router();
const controller = require('../controllers/ticketTypeController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);
router.get('/designs', require('../middleware/errorHandler').asyncHandler(async (req, res) => {
  const templates = (await require('../models/Studio').templates('ticket')).filter(t => t.active);
  res.json({ success: true, data: { templates } });
}));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
