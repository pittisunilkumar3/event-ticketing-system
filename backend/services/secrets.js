const crypto = require('crypto');
function key() {
  const value = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw Object.assign(new Error('Set SETTINGS_ENCRYPTION_KEY to a persistent 64-character hex key before saving SMTP credentials.'), { statusCode: 503 });
  return Buffer.from(value,'hex');
}
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm',key(),iv);
  const encrypted = Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64')).join('.');
}
function decrypt(value) {
  if (!value) return '';
  const [iv,tag,encrypted] = value.split('.').map(s=>Buffer.from(s,'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm',key(),iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8');
}
module.exports = { encrypt, decrypt };
