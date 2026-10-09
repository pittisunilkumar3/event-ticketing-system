const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const EmailTemplate = require('../models/EmailTemplate');
const { generateTemplateHTML } = require('../services/emailTemplateRenderer');
const Studio = require('../models/Studio');
const mailer = require('../services/mailer');
const { asyncHandler } = require('../middleware/errorHandler');

const uploadDir = path.join(__dirname, '..', 'uploads', 'email-templates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// GET /api/admin/email-templates?type=user|admin — auto-seeds missing first
const list = asyncHandler(async (req, res) => {
  const templateType = req.query.type;
  await EmailTemplate.seedMissing(templateType || undefined);
  const templates = templateType
    ? await EmailTemplate.getByType(templateType)
    : await EmailTemplate.getAll();
  res.json({ success: true, message: 'Templates fetched', data: templates });
});

// GET /api/admin/email-templates/footer-data — social links + CMS pages + brand
const footerData = asyncHandler(async (req, res) => {
  const brand = await Studio.getSetting('brand');
  const socialLinksSetting = await Studio.getSetting('social_links');
  const pages = await Studio.pages(true);

  const socialLinks = {};
  for (const [name, link] of Object.entries(socialLinksSetting || {})) {
    if (link) socialLinks[name.toLowerCase().trim()] = link;
  }

  const cmsPages = {};
  for (const p of pages) {
    cmsPages[String(p.title).toLowerCase().trim()] = p.slug;
  }

  res.json({
    success: true,
    data: {
      siteUrl: (brand && brand.site_url) || '',
      companyName: (brand && brand.company_name) || 'TicketFlow',
      companyLogo: (brand && brand.logo) || '',
      socialLinks,
      cmsPages,
    },
  });
});

// PUT /api/admin/email-templates/:id
const update = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.update(req.params.id, req.body);
  if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
  res.json({ success: true, message: 'Template updated', data: template });
});

// PATCH /api/admin/email-templates/:id/toggle
const toggle = asyncHandler(async (req, res) => {
  const isActive = req.body.status !== undefined ? !!req.body.status : !!req.body.is_active;
  const template = await EmailTemplate.toggleStatus(req.params.id, isActive);
  if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
  res.json({ success: true, message: `Template ${isActive ? 'activated' : 'deactivated'}`, data: template });
});

// POST /api/admin/email-templates/upload — image → /uploads/email-templates/
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file provided' });
  }
  const url = `/uploads/email-templates/${req.file.filename}`;
  res.json({ success: true, url, message: 'Image uploaded successfully' });
});

// DELETE /api/admin/email-templates/upload — { url } removes the file from disk
const deleteImage = asyncHandler(async (req, res) => {
  const url = req.body.url || req.body.path;
  if (!url) {
    return res.status(400).json({ success: false, message: 'No image url provided' });
  }
  const match = String(url).match(/\/uploads\/email-templates\/[^"'\s)]+/i);
  if (!match) {
    return res.status(400).json({ success: false, message: 'Invalid image url' });
  }
  const uploadRoot = path.resolve(uploadDir);
  const filePath = path.resolve(path.join(uploadRoot, '..', match[0]));

  // Containment guard: prevent escaping the upload directory (e.g. via ../)
  if (!filePath.startsWith(uploadRoot + path.sep)) {
    return res.status(400).json({ success: false, message: 'Forbidden path' });
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error; // ENOENT = already gone
  }
  res.json({ success: true, message: 'Image deleted' });
});

// POST /api/admin/email-templates/send-test — { to, templateId }
// Renders with sample data and sends through the studio SMTP settings.
const sendTest = asyncHandler(async (req, res) => {
  const { to, templateId } = req.body;
  if (!to) {
    return res.status(400).json({ success: false, message: "Recipient email 'to' is required" });
  }

  const smtp = await Studio.getSetting('smtp');
  if (!smtp.enabled) {
    return res.status(400).json({
      success: false,
      message: 'Mail service is disabled. Enable it in Admin → Brand & SMTP.',
    });
  }
  if (!smtp.host || !smtp.username || !smtp.password_encrypted) {
    return res.status(400).json({
      success: false,
      message: 'SMTP not configured. Go to Admin → Brand & SMTP and set Host, Username, Password.',
    });
  }

  const template = await EmailTemplate.getById(Number(templateId));
  if (!template) {
    return res.status(404).json({ success: false, message: 'Template not found' });
  }
  if (!template.status) {
    return res.status(400).json({
      success: false,
      message: `Template '${template.email_type}' is disabled. Enable it first.`,
    });
  }

  // Dummy replacements — superset of every placeholder any template uses.
  const testReplacements = {
    name: 'Test User',
    email: to,
    phone: '+1 555-0100',
    customer_name: 'Test Customer',
    booking_id: 'TKT-TEST-001',
    event_title: 'Neon Nights Music Festival',
    event_date: 'November 8, 2026',
    event_time: '6:00 PM',
    venue: 'Central Park Grounds',
    city: 'New York',
    tickets_summary: '2× General Admission, 1× VIP',
    amount: '249.97',
    refund_amount: '249.97',
    status: 'Confirmed',
    reset_url: 'http://localhost:5173/reset-password/test-token',
    transaction_id: 'TXN-TEST-001',
    time: new Date().toLocaleString(),
    message: 'This is a test message from the email template editor.',
    code: '123456',
    otp: '123456',
  };

  const html = await generateTemplateHTML(template, testReplacements);
  try {
    await mailer.send(smtp, to, { subject: template.title || 'Test email', html });
  } catch {
    return res.status(502).json({
      success: false,
      message: 'Test email failed. Check your SMTP settings and recipient address.',
    });
  }

  res.json({ success: true, message: `✅ Test email sent to ${to}` });
});

module.exports = { list, footerData, update, toggle, uploadImage, deleteImage, sendTest, uploadDir };
