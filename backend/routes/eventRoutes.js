const router = require('express').Router();
const controller = require('../controllers/eventController');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(verifyToken); // all admin event routes require auth

router.get('/', controller.list);
router.get('/:id', controller.detail);
router.post('/', upload.single('banner'), controller.create);
router.put('/:id', upload.single('banner'), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
