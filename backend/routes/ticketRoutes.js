const router = require('express').Router();
const controller = require('../controllers/ticketController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.post('/checkin', controller.checkIn);
router.get('/:code', controller.lookup);

module.exports = router;
