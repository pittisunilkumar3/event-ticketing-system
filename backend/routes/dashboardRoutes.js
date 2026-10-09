const router = require('express').Router();
const controller = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, controller.stats);

module.exports = router;
