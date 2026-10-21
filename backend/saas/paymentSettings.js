const db = require('../config/db');
const {encrypt, decrypt} = require('../services/secrets');
const {fail, string} = require('../services/studioValidation');

async function get(connection=db.platform) {
 const [[row]] = await connection.query("SELECT value_json FROM platform_settings WHERE name='razorpay'");
 if (row) {
  const saved = JSON.parse(row.value_json);
  return {key_id:saved.key_id, key_secret:decrypt(saved.key_secret_encrypted), webhook_secret:decrypt(saved.webhook_secret_encrypted), source:'saved'};
 }
 return {key_id:process.env.RAZORPAY_KEY_ID || '', key_secret:process.env.RAZORPAY_KEY_SECRET || '', webhook_secret:process.env.RAZORPAY_WEBHOOK_SECRET || '', source:'server'};
}
// Completed sandbox payments retain their own encrypted credentials after going live.
async function forPayment(keyId) {
 const current=await get();
 if(current.key_id===keyId)return current;
 if(!/^rzp_test_[a-zA-Z0-9]+$/.test(keyId||''))fail('This payment needs platform support: the gateway account has changed.',409);
 const [[row]]=await db.platform.query('SELECT value_json FROM platform_settings WHERE name=?',['razorpay_test_archive:'+keyId]);
 if(!row)fail('This payment needs platform support: the gateway account has changed.',409);
 const saved=JSON.parse(row.value_json);
 if(saved.key_id!==keyId)fail('Archived test payment configuration is invalid.',409);
 return {key_id:saved.key_id,key_secret:decrypt(saved.key_secret_encrypted),webhook_secret:decrypt(saved.webhook_secret_encrypted),source:'test_archive'};
}
function liveOnly(){return process.env.RAZORPAY_LIVE_ONLY==='true';}
function assertLiveCheckout(config){if(liveOnly()&&!config.key_id?.startsWith('rzp_live_'))fail('This website accepts live payments only. Contact the platform administrator.',503);}
function safe(config) {
 return {provider:'Razorpay', currency:'INR', key_id:config.key_id, mode:config.key_id.startsWith('rzp_live_')?'live':'test', has_key_secret:Boolean(config.key_secret), has_webhook_secret:Boolean(config.webhook_secret), configured:Boolean(config.key_id && config.key_secret && (!liveOnly()||config.key_id.startsWith('rzp_live_'))), live_only:liveOnly(), source:config.source};
}
// Serialize configuration changes with purchase creation, including the first save.
async function lock(connection) {
 await connection.query("INSERT INTO platform_settings(name,value_json) VALUES ('payment_configuration_lock','{}') ON DUPLICATE KEY UPDATE name=VALUES(name)");
}
async function save(input, actor) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid payment configuration.');
 const key_id = string(input.key_id, 'Razorpay key ID', 120, true);
 if (!/^rzp_(test|live)_[a-zA-Z0-9]+$/.test(key_id)) fail('Enter a valid Razorpay test or live key ID.');
 if (!['test','live'].includes(input.mode) || !key_id.startsWith('rzp_'+input.mode+'_')) fail('The key ID must match the selected payment mode.');
 if(liveOnly()&&input.mode!=='live')fail('This website is locked to live Razorpay payments. Test keys cannot be saved.');
 const conn = await db.platform.getConnection();
 try {
  await conn.beginTransaction();
  await lock(conn);
  const current = await get(conn);
  const changed = key_id !== current.key_id;
  const key_secret = string(input.key_secret || '', 'Key secret', 2000) || (!changed ? current.key_secret : '');
  const webhook_secret = string(input.webhook_secret || '', 'Webhook secret', 2000) || (!changed ? current.webhook_secret : '');
  if (!key_secret) fail('Enter the key secret for this Razorpay key ID.');
  if (changed && current.key_id) {
   const [[pending]] = await conn.query("SELECT COUNT(*) total FROM package_purchases WHERE status IN ('pending','review')");
   const goingLive=current.key_id.startsWith('rzp_test_')&&input.mode==='live';
   const [[bookings]]=await conn.query("SELECT COUNT(*) total FROM booking_payments WHERE status NOT IN ('expired','refunded') AND NOT (?=1 AND mode='test' AND key_id=? AND status='paid')",[goingLive?1:0,current.key_id]);
   if(bookings.total) fail('Resolve existing booking payments and refunds before changing the Razorpay account or mode.',409);
   if (pending.total) fail('Resolve pending package payments before changing the Razorpay account or mode.',409);
   if(goingLive){
    if(!webhook_secret)fail('Enter the signing secret from your Live-mode Razorpay webhook before switching to live payments.');
    const archive={key_id:current.key_id,key_secret_encrypted:encrypt(current.key_secret),webhook_secret_encrypted:current.webhook_secret?encrypt(current.webhook_secret):''};
    await conn.query('INSERT INTO platform_settings(name,value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)',['razorpay_test_archive:'+current.key_id,JSON.stringify(archive)]);
   }
  }
  const saved = {key_id, key_secret_encrypted:encrypt(key_secret), webhook_secret_encrypted:webhook_secret?encrypt(webhook_secret):''};
  await conn.query("INSERT INTO platform_settings(name,value_json) VALUES ('razorpay',?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)",[JSON.stringify(saved)]);
  await conn.query("INSERT INTO platform_audit(actor_id,action,details_json) VALUES (?,'settings.payment',?)",[actor,JSON.stringify({provider:'Razorpay',mode:input.mode})]);
  await conn.commit();
  return safe({key_id,key_secret,webhook_secret,source:'saved'});
 } catch(e) {await conn.rollback();throw e;} finally {conn.release();}
}
module.exports = {get, safe, save, lock, forPayment, liveOnly, assertLiveCheckout};
