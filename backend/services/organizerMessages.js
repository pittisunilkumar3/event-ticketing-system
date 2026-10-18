const crypto=require('node:crypto');
const db=require('../config/db'),Studio=require('../models/Studio'),v=require('./studioValidation');
const {replace}=require('./emailRenderer');
const fields=['customer_name','event_title','event_date','venue','city'];
const maxRecipients=500;
function draft(input){
 const subject=v.string(input.subject,'Subject',255,true),body=v.html(v.string(input.body,'Message',50000,true));
 if(/[\r\n]/.test(subject))v.fail('Use a single line for the subject.');
 if(!body.replace(/<[^>]*>/g,'').trim()&&!body.includes('<img'))v.fail('Write a message first.');
 for(const [,key] of (subject+' '+body).matchAll(/{{\s*([^{}]+?)\s*}}/g))if(!fields.includes(key))v.fail('Unsupported field: '+key+'. Use the fields shown in this editor.');
 return {subject,body};
}
async function event(id){
 if(!Number.isSafeInteger(Number(id))||Number(id)<1)v.fail('Choose an event.');
 const [[row]]=await db.query('SELECT id,title,start_datetime,venue,city FROM events WHERE id=?',[id]);
 if(!row)v.fail('Event not found.',404);return row;
}
async function ticketFilter(eventId,ticketTypeId){
 if(ticketTypeId===undefined||ticketTypeId===null||ticketTypeId==='')return null;
 const id=Number(ticketTypeId);
 if(!Number.isSafeInteger(id)||id<1)v.fail('Choose a valid ticket type.');
 const [[row]]=await db.query('SELECT id FROM ticket_types WHERE id=? AND event_id=?',[id,eventId]);
 if(!row)v.fail('Ticket type not found for this event.',404);return id;
}
function ticketClause(id){return id?" AND EXISTS (SELECT 1 FROM tickets t WHERE t.order_id=o.id AND t.ticket_type_id=? AND t.status IN ('valid','checked_in'))":'';}
async function matching(eventId,ticketTypeId,search=''){
 const q=v.string(search,'Search',120);
 const [rows]=await db.query("SELECT LOWER(TRIM(o.email)) email,MIN(o.customer_name) name,COUNT(*) bookings FROM orders o WHERE o.event_id=? AND o.status='paid' AND o.email<>''"+ticketClause(ticketTypeId)+" AND (o.email LIKE ? OR o.customer_name LIKE ?) GROUP BY LOWER(TRIM(o.email)) ORDER BY email",[eventId,...(ticketTypeId?[ticketTypeId]:[]),'%'+q+'%','%'+q+'%']);
 return rows.filter(r=>{try{v.emailAddress(r.email,true);return true;}catch{return false;}});
}
async function audience(eventId,search='',ticketTypeId){
 await event(eventId);const id=await ticketFilter(eventId,ticketTypeId);
 const [ticketTypes]=await db.query('SELECT id,name FROM ticket_types WHERE event_id=? ORDER BY sort_order,id',[eventId]);
 const rows=await matching(eventId,id,search);
 return {recipients:rows.slice(0,maxRecipients),total:rows.length,has_more:rows.length>maxRecipients,max_recipients:maxRecipients,ticket_types:ticketTypes};
}
function selectionHash(rows){return crypto.createHash('sha256').update(JSON.stringify(rows.map(r=>r.email).sort())).digest('hex');}
async function selection(input){
 const e=await event(input.event_id),id=await ticketFilter(e.id,input.ticket_type_id);
 let rows;
 if(input.select_all===true){
  rows=await matching(e.id,id,input.search||'');
  if(!rows.length)v.fail('No confirmed booking contacts match these filters.');
 }else{
  if(!Array.isArray(input.recipients)||!input.recipients.length||input.recipients.length>maxRecipients)v.fail('Select booking contacts or choose Select all.');
  const emails=[...new Set(input.recipients.map(value=>v.emailAddress(value,true).toLowerCase()))].sort();
  [rows]=await db.query("SELECT LOWER(TRIM(o.email)) email,MIN(o.customer_name) name FROM orders o WHERE o.event_id=? AND o.status='paid'"+ticketClause(id)+" AND LOWER(TRIM(o.email)) IN (?) GROUP BY LOWER(TRIM(o.email)) ORDER BY email",[e.id,...(id?[id]:[]),emails]);
  if(rows.length!==emails.length)v.fail('Some contacts no longer have a confirmed booking for these filters. Refresh the recipients.',409);
 }
 return {event:e,recipients:rows};
}
function render(config,brand,e,recipient){
 const values={customer_name:recipient.name,event_title:e.title,event_date:new Intl.DateTimeFormat('en-IN',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(e.start_datetime.replace(' ','T')+'+05:30')),venue:e.venue,city:e.city};
 let body=v.html(replace(config.body,values));
 body=body.replace(/src="(\/uploads\/[a-zA-Z0-9/._-]+)"/g,(_,path)=>'src="'+new URL(path,brand.site_url).href+'"');
 return {subject:replace(config.subject,values,false).replace(/[\r\n]/g,' '),html:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#fff"><div style="max-width:640px;margin:auto;font:15px/1.7 Arial,sans-serif;color:#17202c">'+body+'</div></body></html>'};
}
async function preview(input){
 const config=draft(input),selected=await selection(input),brand=await Studio.getSetting('brand');
 return {...render(config,brand,selected.event,selected.recipients[0]),recipients:selected.recipients,count:selected.recipients.length,selection_hash:selectionHash(selected.recipients)};
}
async function enqueue(input,adminId){
 const config=draft(input);
 if(!/^[a-f0-9-]{36}$/i.test(input.request_key||''))v.fail('Invalid send request. Reload this page.');
 const emails=Array.isArray(input.recipients)?[...new Set(input.recipients)].sort():[];
 const hash=crypto.createHash('sha256').update(JSON.stringify({event:Number(input.event_id),ticket_type_id:input.ticket_type_id||null,select_all:input.select_all===true,search:input.select_all?input.search||'':'',selection_hash:input.select_all?input.selection_hash:null,config,emails})).digest('hex');
 const conn=await db.getConnection();
 try{
  await conn.beginTransaction();
  // Unique key serializes retries and concurrent double-clicks before queuing.
  const [insert]=await conn.query('INSERT IGNORE INTO organizer_messages(event_id,ticket_type_id,created_by,request_key,payload_hash,subject,body) VALUES (?,?,?,?,?,?,?)',[input.event_id,input.ticket_type_id||null,adminId,input.request_key,hash,config.subject,config.body]);
  const [[batch]]=await conn.query('SELECT id,payload_hash FROM organizer_messages WHERE request_key=? FOR UPDATE',[input.request_key]);
  if(batch.payload_hash!==hash)v.fail('This send request was already used for another message.',409);
  if(insert.affectedRows){
   const smtp=await Studio.getSetting('smtp');if(!smtp.enabled||!smtp.host||!smtp.from_email)v.fail('Configure and enable Organization SMTP before sending.');
   const chosen=await selection(input),brand=await Studio.getSetting('brand');
   if(input.select_all===true&&input.selection_hash!==selectionHash(chosen.recipients))v.fail('The matching contacts have changed. Review the email again before sending.',409);
   const values=chosen.recipients.map(r=>{const mail=render(config,brand,chosen.event,r);return[batch.id,r.email,r.name,mail.subject,mail.html];});
   for(let i=0;i<values.length;i+=100)await conn.query('INSERT INTO organizer_message_recipients(message_id,email,name,subject,html) VALUES ?',[values.slice(i,i+100)]);
  }
  await conn.commit();return {id:batch.id};
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function list(){
 const [messages]=await db.query("SELECT m.id,m.subject,m.event_id,m.paused,m.created_at,e.title event_title,COUNT(r.id) total,SUM(r.status='pending') pending,SUM(r.status='sending') sending,SUM(r.status='sent') sent,SUM(r.status='failed') failed,SUM(r.status='skipped') skipped FROM organizer_messages m LEFT JOIN events e ON e.id=m.event_id LEFT JOIN organizer_message_recipients r ON r.message_id=m.id GROUP BY m.id ORDER BY m.id DESC LIMIT 50");return messages;
}
async function detail(id){
 const [[message]]=await db.query('SELECT id,subject,paused FROM organizer_messages WHERE id=?',[id]);if(!message)v.fail('Message not found.',404);
 const [recipients]=await db.query('SELECT id,email,name,status,attempts,error_message,updated_at FROM organizer_message_recipients WHERE message_id=? ORDER BY id',[id]);return {message,recipients};
}
async function action(id,action){
 await detail(id);
 if(!['cancel','retry'].includes(action))v.fail('Invalid action.');
 const conn=await db.getConnection();
 try{await conn.beginTransaction();await conn.query('SELECT id FROM organizer_messages WHERE id=? FOR UPDATE',[id]);
  if(action==='cancel'){
   await conn.query('UPDATE organizer_messages SET paused=1 WHERE id=?',[id]);
   await conn.query("UPDATE organizer_message_recipients SET status='skipped',error_message='Cancelled by organizer.' WHERE message_id=? AND status='pending'",[id]);
  }else{
   const smtp=await Studio.getSetting('smtp');if(!smtp.enabled)v.fail('Enable Organization SMTP first.');
   await conn.query("UPDATE organizer_message_recipients SET status='pending',error_message=NULL WHERE message_id=? AND status='failed'",[id]);
   await conn.query('UPDATE organizer_messages SET paused=0 WHERE id=?',[id]);
  }
  await conn.commit();
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function processOutbox(){
 const smtp=await Studio.getSetting('smtp');if(!smtp.enabled)return;
 const conn=await db.getConnection();let lock=false;
 try{
  const [[l]]=await conn.query('SELECT GET_LOCK(?,0) acquired',['booker-mail-'+db.current().id]);lock=!!l.acquired;if(!lock)return;
  // Never silently retry an interrupted delivery; its SMTP outcome is unknown.
  await conn.query("UPDATE organizer_messages m JOIN organizer_message_recipients r ON r.message_id=m.id SET m.paused=1,r.status='failed',r.error_message='Delivery interrupted. Check the recipient inbox before retrying.' WHERE r.status='sending' AND r.updated_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)");
  const [[automated]]=await conn.query("SELECT id FROM mail_outbox WHERE status IN ('pending','sending') LIMIT 1");if(automated)return;
  const [[recent]]=await conn.query("SELECT id FROM organizer_message_recipients WHERE attempts>0 AND updated_at>DATE_SUB(NOW(),INTERVAL 10 SECOND) LIMIT 1");if(recent)return;
  await conn.beginTransaction();
  const [[job]]=await conn.query("SELECT r.*,m.event_id,m.ticket_type_id FROM organizer_message_recipients r JOIN organizer_messages m ON m.id=r.message_id WHERE r.status='pending' AND m.paused=0 ORDER BY r.id LIMIT 1 FOR UPDATE");
  if(!job){await conn.commit();return;}
  const [[eligible]]=await conn.query("SELECT o.id FROM orders o WHERE o.event_id=? AND o.status='paid' AND LOWER(TRIM(o.email))=?"+ticketClause(job.ticket_type_id)+" LIMIT 1",[job.event_id,job.email,...(job.ticket_type_id?[job.ticket_type_id]:[])]);
  if(!eligible){await conn.query("UPDATE organizer_message_recipients SET status='skipped',error_message='No confirmed booking remains for this contact.' WHERE id=?",[job.id]);await conn.commit();return;}
  await conn.query("UPDATE organizer_message_recipients SET status='sending',attempts=attempts+1 WHERE id=?",[job.id]);await conn.commit();
  try{
   await require('./mailer').send(smtp,job.email,{subject:job.subject,html:job.html},`<organizer-message-${db.current().id}-${job.id}@${new URL((await Studio.getSetting('brand')).site_url).hostname}>`);
   await conn.query("UPDATE organizer_message_recipients SET status='sent',error_message=NULL WHERE id=?",[job.id]);
  }catch{
   await conn.query("UPDATE organizer_message_recipients SET status='failed',error_message='Delivery failed. Check SMTP and the inbox before retrying.' WHERE id=?",[job.id]);
   await conn.query('UPDATE organizer_messages SET paused=1 WHERE id=?',[job.message_id]);
  }
 }catch(e){await conn.rollback();throw e;}finally{if(lock)await conn.query('SELECT RELEASE_LOCK(?)',['booker-mail-'+db.current().id]);conn.release();}
}
module.exports={draft,render,fields,audience,preview,enqueue,list,detail,action,processOutbox};
