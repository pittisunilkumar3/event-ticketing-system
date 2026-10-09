const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const controller = require('../controllers/emailTemplateController');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');

// Superadmin-only, same as the hostel reference (adminMiddleware)
router.use(verifyToken, requireSuperAdmin);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, controller.uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    cb(null, `email_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'].includes(file.mimetype);
    if (ok) return cb(null, true);
    cb(new Error('Only jpeg, png, gif, webp, svg allowed'));
  },
});

router.get('/', controller.list);
router.get('/footer-data', controller.footerData);
router.put('/:id', controller.update);
router.patch('/:id/toggle', controller.toggle);
router.post('/upload', upload.single('image'), controller.uploadImage);
router.delete('/upload', controller.deleteImage);
router.post('/send-test', controller.sendTest);

module.exports = router;
