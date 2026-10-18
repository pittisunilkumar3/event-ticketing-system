const Studio = require('../models/Studio');
const mailer = require('../services/mailer');
const v = require('../services/studioValidation');
const { asyncHandler } = require('../middleware/errorHandler');

exports.sendTest = asyncHandler(async (req, res) => {
  const recipient = v.emailAddress(v.string(req.body?.recipient, 'Recipient email', 254, true), true);
  const smtp = await Studio.getSetting('smtp');
  if (!smtp.host || !smtp.from_email) v.fail('Save your SMTP host and sender email before sending a test.');
  try {
    // An explicit test does not enable automatic delivery or change saved settings.
    await mailer.send({...smtp, enabled:true}, recipient, {
      subject:'[TEST] Your SMTP email delivery',
      html:'<h2>Your SMTP test email</h2><p>This message was sent using your organization’s saved SMTP settings.</p><p>If you can read this, the test message reached your inbox.</p><p>This is a test only. No booking was created and your automatic email settings have not changed.</p>',
    });
  } catch {
    v.fail('Test email could not be sent. Check your saved SMTP settings and recipient address, then try again.', 502);
  }
  res.json({success:true, data:{recipient}, message:'Test email accepted by your SMTP server. Check your inbox and spam folder.'});
});
