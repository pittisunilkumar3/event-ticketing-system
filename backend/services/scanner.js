const db = require('../config/db');
const {fail} = require('./studioValidation');
function eventId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail('Choose a valid event.');
  return Number(value);
}
function ticketCode(value) {
  if (typeof value !== 'string' || !/^TCK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(value.trim())) fail('Scan a TicketFlow ticket QR or enter its TCK code.');
  return value.trim().toUpperCase();
}
const joins = `FROM tickets t JOIN orders o ON o.id=t.order_id JOIN events e ON e.id=o.event_id
 JOIN ticket_types tt ON tt.id=t.ticket_type_id`;
const fields = `t.ticket_code,t.attendee_name,t.status,t.checked_in_at,o.booking_ref,o.customer_name,
 o.status AS order_status,o.payment_method,o.event_id,e.title AS event_title,e.status AS event_status,
 e.archived_at AS event_archived_at,e.venue,e.city,e.start_datetime,e.schedule_text,e.entry_instructions,tt.name AS type_name`;
async function find(code) {
 const [rows] = await db.query(`SELECT ${fields} ${joins} WHERE t.ticket_code=? AND o.archived_at IS NULL LIMIT 1`,[code]);
 return rows[0] || null;
}
function verdict(ticket, selectedEvent) {
 if(!ticket) return {valid:false,reason:'not_found',message:'Ticket not found in this organization.'};
 if(Number(ticket.event_id)!==selectedEvent) return {valid:false,reason:'wrong_event',message:'This ticket is for a different event.'};
 const result=(reason,message,valid=false)=>({valid,reason,message,ticket});
 if(ticket.event_archived_at || ticket.event_status!=='published') return result('event_unavailable','This event is not open for entry.');
 if(['cancelled','refunded'].includes(ticket.order_status)||ticket.status==='cancelled')return result('cancelled','This ticket has been cancelled or refunded.');
 if(['mock','razorpay_test'].includes(ticket.payment_method))return result('test_ticket','Test bookings cannot be used for venue entry.');
 if(ticket.order_status!=='paid')return result('unpaid','Payment has not been completed.');
 if(ticket.status==='checked_in')return result('already_used','This ticket has already been used.');
 if(ticket.status!=='valid')return result('invalid','This ticket is not valid for entry.');
 return result('valid','Ticket is valid. Entry has not been recorded.',true);
}
async function verify(input) {return verdict(await find(ticketCode(input.ticket_code)),eventId(input.event_id));}
async function checkIn(input) {
 const code=ticketCode(input.ticket_code),id=eventId(input.event_id);
 const before=verdict(await find(code),id);
 if(!before.valid)return before;
 // One conditional update serializes competing scanners and rechecks all mutable
 // eligibility fields, including payment, event and archive state at admission.
 const [updated]=await db.query(`UPDATE tickets t JOIN orders o ON o.id=t.order_id JOIN events e ON e.id=o.event_id
 SET t.status='checked_in',t.checked_in_at=NOW()
 WHERE t.ticket_code=? AND o.event_id=? AND o.archived_at IS NULL AND e.archived_at IS NULL
 AND e.status='published' AND o.status='paid' AND o.payment_method NOT IN ('mock','razorpay_test') AND t.status='valid'`,[code,id]);
 const ticket=await find(code);
 if(updated.affectedRows===1)return {valid:true,reason:'checked_in',message:'Entry recorded. Admit this guest.',ticket};
 const current=verdict(ticket,id);
 return current.valid?{valid:false,reason:'changed',message:'Ticket changed. Validate it again.'}:current;
}
async function events(query) {
 const search=typeof query.search==='string'?query.search.trim():'';
 if(search.length>100)fail('Search must be 100 characters or fewer.');
 const page=eventId(query.page||1),limit=30;
 const where="e.archived_at IS NULL AND e.status='published' AND e.title LIKE ?";
 const pattern='%'+search.replace(/[=%_]/g,'=$&')+'%';
 const [rows]=await db.query(`SELECT e.id,e.title,e.venue,e.city,e.start_datetime,e.end_datetime,e.schedule_text,e.entry_instructions,
 (SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.event_id=e.id AND o.archived_at IS NULL AND o.status='paid' AND o.payment_method NOT IN ('mock','razorpay_test') AND t.status IN ('valid','checked_in')) AS total,
 (SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.event_id=e.id AND o.archived_at IS NULL AND o.status='paid' AND o.payment_method NOT IN ('mock','razorpay_test') AND t.status='checked_in') AS checked_in
 FROM events e WHERE ${where.replace('LIKE ?',"LIKE ? ESCAPE '='")} ORDER BY e.start_datetime DESC,e.id DESC LIMIT ? OFFSET ?`,[pattern,limit,(page-1)*limit]);
 const [[count]]=await db.query(`SELECT COUNT(*) total FROM events e WHERE ${where.replace('LIKE ?',"LIKE ? ESCAPE '='")}`,[pattern]);
 return {events:rows,page,pages:Math.ceil(Number(count.total)/limit)};
}
async function guests(query) {
 const id=eventId(query.event_id),page=eventId(query.page||1),limit=30;
 const search=query.search||'';
 if(typeof search!=='string'||search.length>100)fail('Search must be 100 characters or fewer.');
 if(query.status && !['checked_in','valid'].includes(query.status))fail('Invalid entry filter.');
 const pattern='%'+search.trim().replace(/[=%_]/g,'=$&')+'%';
 const where=`o.event_id=? AND o.archived_at IS NULL AND e.archived_at IS NULL AND o.status='paid' AND o.payment_method NOT IN ('mock','razorpay_test')
 AND t.status IN ('valid','checked_in') ${query.status?'AND t.status=?':''}
 AND (t.attendee_name LIKE ? ESCAPE '=' OR o.customer_name LIKE ? ESCAPE '=' OR t.ticket_code LIKE ? ESCAPE '=' OR o.booking_ref LIKE ? ESCAPE '=')`;
 const params=[id,...(query.status?[query.status]:[]),pattern,pattern,pattern,pattern];
 const [tickets]=await db.query(`SELECT ${fields} ${joins} WHERE ${where} ORDER BY t.checked_in_at DESC,t.id DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
 const [[count]]=await db.query(`SELECT COUNT(*) total ${joins} WHERE ${where}`,params);
 return {tickets,total:Number(count.total),page,pages:Math.ceil(Number(count.total)/limit)};
}
module.exports={eventId,ticketCode,verdict,verify,checkIn,events,guests};
