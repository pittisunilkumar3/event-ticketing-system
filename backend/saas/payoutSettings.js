const db=require('../config/db');
const {encrypt,decrypt}=require('../services/secrets');
const {fail,string}=require('../services/studioValidation');
async function get(conn=db.platform){
 const [[row]]=await conn.query("SELECT value_json FROM platform_settings WHERE name='razorpayx'");
 if(!row)return {enabled:false,key_id:'',key_secret:'',webhook_secret:'',account_number:''};
 const s=JSON.parse(row.value_json);return {...s,key_secret:decrypt(s.key_secret),webhook_secret:decrypt(s.webhook_secret),account_number:decrypt(s.account_number)};
}
function safe(c){return {enabled:c.enabled,key_id:c.key_id,has_key_secret:!!c.key_secret,has_webhook_secret:!!c.webhook_secret,account_last4:c.account_number.slice(-4),configured:!!(c.key_id&&c.key_secret&&c.webhook_secret&&c.account_number)};}
async function lock(conn){await conn.query("INSERT INTO platform_settings(name,value_json) VALUES ('payout_configuration_lock','{}') ON DUPLICATE KEY UPDATE name=VALUES(name)");}
async function save(input,actor){
 const conn=await db.platform.getConnection();try{
  await conn.beginTransaction();await lock(conn);const old=await get(conn);
  const key_id=string(input.key_id,'RazorpayX live key ID',120,true);
  if(!/^rzp_live_[a-zA-Z0-9]+$/.test(key_id))fail('Use live RazorpayX credentials for withdrawals of real funds.');
  const next={enabled:input.enabled===true,key_id,key_secret:string(input.key_secret||'','Key secret',2000)||old.key_secret,webhook_secret:string(input.webhook_secret||'','Webhook secret',2000)||old.webhook_secret,account_number:string(input.account_number||'','RazorpayX funding account',40)||old.account_number};
  if(key_id!==old.key_id&&!input.key_secret)fail('Enter the secret for this key ID.');
  if(!next.key_secret||!next.webhook_secret||!/^\d{5,40}$/.test(next.account_number))fail('Enter the key secret, webhook secret and numeric RazorpayX funding account.');
  if(old.key_id&&['key_id','webhook_secret','account_number'].some(k=>old[k]!==next[k])){
   const [[active]]=await conn.query("SELECT COUNT(*) n FROM wallet_payouts WHERE status NOT IN ('failed','cancelled','rejected','reversed')");
   if(active.n)fail('Existing transfers still use these credentials, including transfers that may be returned. Contact support before replacing the payout account or secrets.',409);
  }
  await conn.query("INSERT INTO platform_settings(name,value_json) VALUES ('razorpayx',?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)",[JSON.stringify({...next,key_secret:encrypt(next.key_secret),webhook_secret:encrypt(next.webhook_secret),account_number:encrypt(next.account_number)})]);
  await conn.query("INSERT INTO platform_audit(actor_id,action,details_json) VALUES (?,'settings.payouts',?)",[actor,JSON.stringify({enabled:next.enabled,key_id})]);
  await conn.commit();return safe(next);
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
module.exports={get,safe,save,lock};
