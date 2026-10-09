const router = require('express').Router();
const controller = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', controller.list);
router.get('/:id', controller.detail);
router.patch('/:id/cancel', controller.cancel);
router.patch('/:id/refund', controller.refund);

module.exports = router;
