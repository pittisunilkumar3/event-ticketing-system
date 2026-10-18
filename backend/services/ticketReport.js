const db = require('../config/db');
const {fail} = require('./studioValidation');

const ticketStatus = "CASE WHEN o.status IN ('cancelled','refunded') THEN 'cancelled' WHEN o.status='pending' THEN 'pending' ELSE t.status END";
const joins = `FROM tickets t JOIN orders o ON o.id=t.order_id
 JOIN events e ON e.id=o.event_id JOIN ticket_types tt ON tt.id=t.ticket_type_id
 LEFT JOIN order_attendees a ON a.id=t.attendee_id AND a.order_id=o.id`;
const columns = `t.id,t.ticket_code,t.order_id,t.ticket_type_id,t.checked_in_at,
 COALESCE(NULLIF(t.attendee_name,''),NULLIF(a.name,''),o.customer_name) AS attendee_name,
 a.email AS attendee_email,a.phone AS attendee_phone,a.answers_json,
 tt.name AS type_name,e.id AS event_id,e.title AS event_title,
 o.booking_ref,o.status AS order_status,o.created_at AS booked_at,
 o.customer_name AS booking_contact,o.email AS booking_email,o.phone AS booking_phone,
 o.payment_method,${ticketStatus} AS ticket_status`;

function filters(query={}) {
 const enumValue=(key,allowed,fallback='')=>{
  const value=query[key]===undefined||query[key]===''?fallback:query[key];
  if(typeof value!=='string'||(value&&!allowed.includes(value)))fail('Invalid '+key.replaceAll('_',' ')+'.');
  return value;
 };
 const integer=(key,fallback,max=Number.MAX_SAFE_INTEGER)=>{
  if(query[key]===undefined||query[key]==='')return fallback;
  if(typeof query[key]!=='string'||!/^\d+$/.test(query[key]))fail('Invalid '+key.replaceAll('_',' ')+'.');
  const value=Number(query[key]);
  if(!Number.isSafeInteger(value)||value<1||value>max)fail('Invalid '+key.replaceAll('_',' ')+'.');
  return value;
 };
 const date=key=>{
  const value=query[key]||'';
  if(typeof value!=='string'||(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)))fail('Choose a valid booking date.');
  return value;
 };
 if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>200))fail('Search must be 200 characters or fewer.');
 const result={booking_group:enumValue('booking_group',['real','test'],'real'),status:enumValue('status',['paid','pending','cancelled','refunded']),ticket_status:enumValue('ticket_status',['valid','checked_in','cancelled','pending']),event_id:integer('event_id',null),ticket_type_id:integer('ticket_type_id',null),search:(query.search||'').trim(),from:date('from'),to:date('to'),page:integer('page',1,1000000),limit:integer('limit',20,100)};
 if(result.from&&result.to&&result.from>result.to)fail('Booking end date must be on or after the start date.');
 return result;
}
function where(filters) {
 const clauses=[filters.booking_group==='test'?"o.payment_method IN ('mock','razorpay_test')":"o.payment_method NOT IN ('mock','razorpay_test')"];
 const values=[];
 for(const [key,column] of [['status','o.status'],['event_id','o.event_id'],['ticket_type_id','t.ticket_type_id'],['ticket_status',ticketStatus]])if(filters[key]){clauses.push(`${column}=?`);values.push(filters[key]);}
 if(filters.from){clauses.push('o.created_at>=?');values.push(filters.from);}
 if(filters.to){clauses.push('o.created_at<DATE_ADD(?,INTERVAL 1 DAY)');values.push(filters.to);}
 if(filters.search){
  const fields=['t.ticket_code','t.attendee_name','a.name','a.email','a.phone','o.booking_ref','o.customer_name','o.email','o.phone'];
  clauses.push('('+fields.map(field=>`${field} LIKE ? ESCAPE '='`).join(' OR ')+')');
  values.push(...fields.map(()=>'%'+filters.search.replace(/[=%_]/g,'=$&')+'%'));
 }
 return {sql:clauses.join(' AND '),values};
}
function publicRow(row) { const {answers_json,...rest}=row;return rest; }
async function list(filters) {
 const {sql,values}=where(filters);
 const [[count]]=await db.query(`SELECT COUNT(*) AS total ${joins} WHERE ${sql}`,values);
 const [rows]=await db.query(`SELECT ${columns} ${joins} WHERE ${sql} ORDER BY t.id DESC LIMIT ? OFFSET ?`,[...values,filters.limit,(filters.page-1)*filters.limit]);
 return {tickets:rows.map(publicRow),pagination:{total:Number(count.total),page:filters.page,limit:filters.limit,pages:Math.ceil(Number(count.total)/filters.limit)}};
}
async function options(filters) {
 const [events]=await db.query('SELECT id,title FROM events ORDER BY start_datetime DESC,id DESC');
 const [ticketTypes]=filters.event_id?await db.query('SELECT id,name FROM ticket_types WHERE event_id=? ORDER BY name,id',[filters.event_id]):[[]];
 return {events,ticketTypes};
}
function csvCell(value) {
 let text=String(value??'');
 // Spreadsheet applications interpret even quoted formula cells on import.
 if(/^[\s\x00-\x1f]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
const exportColumns=[['Ticket number','ticket_code'],['Attendee name','attendee_name'],['Attendee email','attendee_email'],['Attendee phone','attendee_phone'],['Event','event_title'],['Pass','type_name'],['Booking reference','booking_ref'],['Booking status','order_status'],['Ticket status','ticket_status'],['Booked at','booked_at'],['Checked in at','checked_in_at'],['Booking contact','booking_contact'],['Booking email','booking_email'],['Booking phone','booking_phone'],['Payment method','payment_method'],['Registration answers','answers']];
const csvHeader=()=> '\ufeff'+exportColumns.map(([label])=>csvCell(label)).join(',')+'\r\n';
function csvRow(row) {
 let answers=[];
 try{answers=JSON.parse(row.answers_json||'[]');}catch{}
 const readable=Array.isArray(answers)?answers.map(answer=>`${answer.label||answer.id}: ${Array.isArray(answer.value)?answer.value.join('; '):answer.value&&typeof answer.value==='object'?answer.value.name||JSON.stringify(answer.value):answer.value??''}`).join('\n'):'';
 return exportColumns.map(([,key])=>csvCell(key==='answers'?readable:row[key])).join(',')+'\r\n';
}
// One consistent tenant snapshot, fetched in bounded batches, including every
// matching page. Never include file bytes, email snapshots or private settings.
async function* exportRows(filters) {
 const conn=await db.getConnection();
 try{
  await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  const {sql,values}=where(filters);
  let after=0;
  while(true){
   const [rows]=await conn.query(`SELECT ${columns} ${joins} WHERE ${sql} AND t.id>? ORDER BY t.id ASC LIMIT 1000`,[...values,after]);
   if(!rows.length)break;
   for(const row of rows)yield row;
   after=rows.at(-1).id;
  }
 }finally{try{await conn.rollback();}finally{conn.release();}}
}
module.exports={filters,where,list,options,csvCell,csvHeader,csvRow,exportRows};
