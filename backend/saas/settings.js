const db=require('../config/db');
const defaults=require('../services/studioDefaults');
const v=require('../services/studioValidation');
async function getSmtp(){
 const [[row]]=await db.platform.query("SELECT value_json FROM platform_settings WHERE name='smtp'");
 return row?JSON.parse(row.value_json):{...defaults.smtp,enabled:false};
}
const {safe,validate}=require('../services/smtpSettings');
async function saveSmtp(b,actor){
 const smtp=validate(b,await getSmtp());
 smtp.notification_email=v.emailAddress(b.notification_email ?? (await getSmtp()).notification_email ?? '');
 const conn=await db.platform.getConnection();
 try{await conn.beginTransaction();await conn.query("INSERT INTO platform_settings(name,value_json) VALUES ('smtp',?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)",[JSON.stringify(smtp)]);await conn.query("INSERT INTO platform_audit(actor_id,action,details_json) VALUES (?,'settings.smtp','{}')",[actor]);await conn.commit();}catch(e){await conn.rollback();throw e;}finally{conn.release();}
 return safe(smtp);
}
module.exports={getSmtp,saveSmtp,safe};
