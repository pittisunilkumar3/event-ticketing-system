const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { asyncHandler } = require('../middleware/errorHandler');

function signToken(admin) {
  return jwt.sign(
    { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const admin = await Admin.findByEmail(email.toLowerCase().trim());
  if (!admin) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const isMatch = await bcrypt.compare(password, admin.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = signToken(admin);
  const { password_hash, ...safeAdmin } = admin;

  res.json({
    success: true,
    message: 'Login successful',
    data: { token, admin: safeAdmin },
  });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin.id);
  if (!admin) {
    return res.status(404).json({ success: false, message: 'Admin not found.' });
  }
  res.json({ success: true, data: { admin } });
});

/** PATCH /api/auth/profile */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }
  const existing = await Admin.findByEmail(email.toLowerCase().trim());
  if (existing && existing.id !== req.admin.id) {
    return res.status(409).json({ success: false, message: 'Email already in use.' });
  }
  const admin = await Admin.updateProfile(req.admin.id, { name, email: email.toLowerCase().trim() });
  res.json({ success: true, message: 'Profile updated', data: { admin } });
});

/** PATCH /api/auth/password */
const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Current and new password are required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  const admin = await Admin.findByEmail(req.admin.email);
  const isMatch = await bcrypt.compare(current_password, admin.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hash = await bcrypt.hash(new_password, 10);
  await Admin.updatePassword(admin.id, hash);
  res.json({ success: true, message: 'Password changed successfully' });
});

module.exports = { login, me, updateProfile, changePassword };
