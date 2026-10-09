const router = require('express').Router();
const controller = require('../controllers/ticketTypeController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
