const router = require('express').Router();
const controller = require('../controllers/emailTemplateController');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');

// Superadmin-only, same as the hostel reference (adminMiddleware)
router.use(verifyToken, requireSuperAdmin);

const upload = require('../middleware/upload');

router.get('/', controller.list);
router.get('/footer-data', controller.footerData);
router.put('/:id', controller.update);
router.patch('/:id/toggle', controller.toggle);
router.post('/upload', upload.single('image'), controller.uploadImage);
router.delete('/upload', controller.deleteImage);
router.post('/send-test', controller.sendTest);

module.exports = router;
