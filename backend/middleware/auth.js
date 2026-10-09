const jwt = require('jsonwebtoken');

/** Verify JWT and attach admin to req — protects admin routes. */
function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // { id, name, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/** Read the current role from the database; an old JWT cannot retain revoked privileges. */
async function requireSuperAdmin(req, res, next) {
  try {
    const admin = await require('../models/Admin').findById(req.admin.id);
    if (!admin || admin.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Superadmin access is required.' });
    req.admin = admin;
    next();
  } catch (err) { next(err); }
}

module.exports = { verifyToken, requireSuperAdmin };
