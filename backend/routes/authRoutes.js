const router = require('express').Router();
const { login, me, updateProfile, changePassword } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Public
router.post('/login', login);

// Protected (JWT required)
router.get('/me', verifyToken, me);
router.patch('/profile', verifyToken, updateProfile);
router.patch('/password', verifyToken, changePassword);

module.exports = router;
