const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { asyncHandler } = require('../middleware/errorHandler');

function signToken(admin) {
  return jwt.sign(
    { id: admin.id, name: admin.name, email: admin.email, role: admin.role, organization_id: require('../config/db').current()?.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

/** Main sign-in finds verified accounts; branded sites remain tenant-scoped. */
const login = asyncHandler(async (req, res) => {
  const { email, password, workspace_id } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || email.length > 150 || typeof password !== 'string' || !password || Buffer.byteLength(password)>72) {
    return res.status(400).json({ success:false,message:'Enter a valid email address and password.' });
  }
  const db=require('../config/db');
  const address=email.toLowerCase().trim();
  const sharedEntry=req.organization.is_legacy && !req.organizationSlug;
  let candidates;
  if (sharedEntry) {
    if (workspace_id !== undefined && (!Number.isSafeInteger(workspace_id) || workspace_id<1)) return res.status(400).json({success:false,message:'Choose a valid workspace.'});
    [candidates]=await db.platform.query(`SELECT o.* FROM organizations o JOIN organizer_login_directory d ON d.organization_id=o.id WHERE d.email=? AND o.status IN ('active','suspended') ${workspace_id!==undefined?'AND o.id=?':''} ORDER BY o.id LIMIT 26`,workspace_id!==undefined?[address,workspace_id]:[address]);
    if(candidates.length>25) return res.status(409).json({success:false,message:'Please sign in from your organizer’s own website.'});
  } else candidates=[req.organization];
  const matches=[];
  for(const org of candidates) {
    const admin=await db.run(org,()=>Admin.findByEmail(address));
    // The directory only locates accounts. Always verify the current tenant record.
    if(admin && ['super_admin','staff'].includes(admin.role) && await bcrypt.compare(password,admin.password_hash)) matches.push({org,admin});
  }
  if(!matches.length) return res.status(401).json({success:false,message:'Invalid email or password.'});
  const workspace=org=>({id:org.id,name:org.name,slug:org.slug,is_legacy:Boolean(org.is_legacy),path:org.is_legacy?'/admin':`/o/${org.slug}/admin`});
  if(matches.length>1) return res.json({success:true,data:{workspaces:matches.map(({org})=>workspace(org))}});
  const {org,admin}=matches[0];
  const {password_hash,...safeAdmin}=admin;
  const token=db.run(org,()=>signToken(admin));
  res.json({success:true,message:'Login successful',data:{token,admin:safeAdmin,workspace:workspace(org)}});
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
  const input = req.body || {};
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 100) {
    return res.status(400).json({ success: false, message: 'Enter a name between 1 and 100 characters.' });
  }
  if (typeof input.email !== 'string' || input.email.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const existing = await Admin.findByEmail(email);
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

  const identity = await Admin.findById(req.admin.id);
  if (!identity) return res.status(404).json({ success: false, message: 'Admin not found.' });
  const admin = await Admin.findByEmail(identity.email);
  const isMatch = await bcrypt.compare(current_password, admin.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hash = await bcrypt.hash(new_password, 10);
  await Admin.updatePassword(admin.id, hash);
  res.json({ success: true, message: 'Password changed successfully' });
});

module.exports = { login, me, updateProfile, changePassword };
