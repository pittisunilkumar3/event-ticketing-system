const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { siteUrl } = require('./provision');
const resolveTenant = asyncHandler(async (req,res,next) => {
  let slug = req.organizationSlug;
  const hostname = req.hostname.toLowerCase();
  const base = process.env.BASE_DOMAIN?.toLowerCase();
  if (!slug && base && hostname.endsWith('.' + base)) slug = hostname.slice(0, -(base.length+1));
  if (!slug && base && ![base,'localhost','127.0.0.1'].includes(hostname)) return res.status(404).json({success:false,message:'Website not found.'});
  const [rows] = await db.platform.query(slug ? 'SELECT * FROM organizations WHERE slug=?' : 'SELECT * FROM organizations WHERE is_legacy=TRUE LIMIT 1', slug ? [slug] : []);
  const org = rows[0];
  if (!org || !['active','suspended'].includes(org.status)) return res.status(404).json({success:false,message:'Website not found.'});
  // Suspended accounts retain read access and check-in. New bookings and other writes stop.
  if (org.status==='suspended' && !['GET','HEAD'].includes(req.method) && !['/auth/login','/admin/tickets/checkin','/admin/scanner/verify','/admin/scanner/checkin','/booking-payments/verify','/booking-payments/status'].includes(req.path)) return res.status(403).json({success:false,message:'This organizer is suspended. New sales and changes are paused. Contact support.'});
  req.organization=org;
  req.siteUrl=siteUrl(org);
  db.run(org, next);
});
function rateLimit(limit, windowMs) {
  const attempts = new Map();
  return (req,res,next) => {
    const now = Date.now(), key = req.ip;
    if (attempts.size > 10000) for (const [k,v] of attempts) if(v.until<now) attempts.delete(k);
    const value = attempts.get(key);
    if (!value || value.until<now) { attempts.set(key,{count:1,until:now+windowMs});return next(); }
    if (++value.count>limit) { res.set('Retry-After',String(Math.ceil((value.until-now)/1000)));return res.status(429).json({success:false,message:'Too many attempts. Please try again later.'}); }
    next();
  };
}
module.exports={resolveTenant,rateLimit};
