const jwt = require('jsonwebtoken');

/** Verify JWT and attach admin to req — protects admin routes. */
async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.organization_id && decoded.type !== 'platform') return res.status(401).json({success:false,message:'Please sign in again to load your organizer workspace.'});
    if(decoded.type==='platform' || !req.organization || decoded.organization_id!==req.organization.id) {
      return res.status(403).json({success:false,code:'TENANT_MISMATCH',message:'Sign in to this organizer’s workspace.'});
    }
    const admin=await require('../models/Admin').findById(decoded.id);
    if(!admin) return res.status(401).json({success:false,message:'Account no longer available.'});
    if(!['super_admin','staff'].includes(admin.role)) return res.status(403).json({success:false,message:'This account does not have access to the organization dashboard.'});
    req.admin = admin;
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
