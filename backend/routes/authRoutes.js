const router = require('express').Router();
const { login, me, updateProfile, changePassword } = require('../controllers/authController');
const { verifyToken, verifyScannerToken } = require('../middleware/auth');

// Public
router.post('/login', login);

// Protected (JWT required)
router.get('/me', verifyScannerToken, me);
router.patch('/profile', verifyToken, updateProfile);
router.patch('/password', verifyScannerToken, changePassword);

module.exports = router;
