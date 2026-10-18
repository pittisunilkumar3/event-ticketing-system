const v = require('./studioValidation');
const { encrypt } = require('./secrets');
function safe(smtp) {
  const { password_encrypted, password, ...rest } = smtp;
  return { ...rest, has_password: Boolean(password_encrypted) };
}
function validate(input, current) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) v.fail('Invalid SMTP settings.');
  const b = { ...current, ...input }, port = Number(b.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) v.fail('Enter a valid SMTP port.');
  if (!['tls', 'starttls'].includes(b.encryption)) v.fail('Choose TLS or STARTTLS.');
  const host = v.string(b.host || '', 'SMTP host', 255, b.enabled === true);
  if (host && !/^[a-zA-Z0-9.-]+$/.test(host)) v.fail('Enter an SMTP hostname without a URL prefix.');
  const smtp = { enabled: b.enabled === true, host, port, encryption: b.encryption,
    username: v.string(b.username || '', 'Username', 255), from_name: v.string(b.from_name || '', 'Sender name', 120, b.enabled === true),
    from_email: v.emailAddress(b.from_email || '', b.enabled === true), reply_to: v.emailAddress(b.reply_to || ''),
    password_encrypted: current.password_encrypted || '' };
  if (input.clear_password === true) smtp.password_encrypted = '';
  if (input.password) { v.string(input.password, 'Password', 2000, true); smtp.password_encrypted = encrypt(input.password); }
  if (smtp.enabled && smtp.username && !smtp.password_encrypted) v.fail('Enter an SMTP password.');
  return smtp;
}
module.exports = { safe, validate };
