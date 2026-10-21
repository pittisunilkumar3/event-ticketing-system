const db=require('../config/db');
const {fail}=require('./studioValidation');
const money=require('./eventWallet');
const {availability}=require('./eventValidation');
function code(value){
 if(typeof value!=='string'||!/^[A-Z0-9_-]{3,40}$/.test(value.trim().toUpperCase()))fail('Use a coupon code with 3–40 letters, numbers, hyphens or underscores.');
 return value.trim().toUpperCase();
}
function positive(value,label,optional=false){
 if(optional&&(value===''||value===null||value===undefined))return null;
 if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>100000000)fail('Enter a valid '+label+'.');
 return Number(value);
}
function date(value){
 if(!value)return null;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))fail('Choose a valid date and time.');
 return new Date(value).toISOString().slice(0,19).replace('T',' ');
}
function fields(input){
 if(!['fixed','percentage'].includes(input.kind))fail('Choose percentage or fixed discount.');
 const units=money.minorUnits(input.value);
 if(units<1||(input.kind==='percentage'&&units>10000))fail('Enter a discount above zero. Percentage discounts cannot exceed 100%.');
 const ids=input.ticket_type_ids||[];
 if(!Array.isArray(ids)||ids.length>100||new Set(ids).size!==ids.length)fail('Choose valid ticket types.');
 const event=positive(input.event_id,'event',true);
 if(input.ticket_scope==='selected'&&(!event||!ids.length))fail('Select an event and at least one ticket type.');
 if(input.ticket_scope==='all'&&ids.length)fail('All tickets cannot include a selected-ticket restriction.');
 if(ids.length&&!event)fail('Choose an event before restricting ticket types.');
 const start=date(input.starts_at),end=date(input.ends_at);
 if(start&&end&&start>=end)fail('Expiry must be after the start date.');
 if(typeof input.enabled!=='boolean')fail('Choose whether the coupon is enabled.');
 return {code:code(input.code),kind:input.kind,value_units:units,event_id:event,ticket_type_ids:JSON.stringify(ids.map(id=>positive(id,'ticket type'))),min_subtotal_minor:money.minorUnits(input.min_subtotal||0),max_discount_minor:input.max_discount?money.minorUnits(input.max_discount):null,usage_limit:positive(input.usage_limit,'total usage limit',true),per_email_limit:positive(input.per_email_limit,'per-email limit',true),starts_at:start,ends_at:end,enabled:input.enabled};
}
function present(row){return {...row,ticket_type_ids:JSON.parse(row.ticket_type_ids),value:(Number(row.value_units)/100).toFixed(2),min_subtotal:money.decimal(Number(row.min_subtotal_minor)),max_discount:row.max_discount_minor===null?'':money.decimal(Number(row.max_discount_minor)),starts_at:row.starts_at?row.starts_at.replace(' ','T')+'Z':null,ends_at:row.ends_at?row.ends_at.replace(' ','T')+'Z':null};}
async function save(input,id){
 const value=fields(input),conn=await db.getConnection();
 try{
  await conn.beginTransaction();
  if(value.event_id){const [[event]]=await conn.query('SELECT id FROM events WHERE id=? AND archived_at IS NULL',[value.event_id]);if(!event)fail('Choose an event in your organization.');}
  const ids=JSON.parse(value.ticket_type_ids);
  if(ids.length){const [types]=await conn.query('SELECT id FROM ticket_types WHERE event_id=? AND archived_at IS NULL AND id IN (?)',[value.event_id,ids]);if(types.length!==ids.length)fail('Every selected pass must belong to this event.');}
  if(id){
   id=positive(id,'coupon');const [[prior]]=await conn.query('SELECT * FROM discount_coupons WHERE id=? FOR UPDATE',[id]);if(!prior)fail('Coupon not found.',404);
   if(Number(input.revision)!==prior.revision)fail('This coupon changed. Reload it before saving.',409);
   if(value.code!==prior.code)fail('Coupon codes cannot be renamed. Create a new code instead.');
   await conn.query('UPDATE discount_coupons SET ?,revision=revision+1 WHERE id=?',[value,id]);
  }else{const [result]=await conn.query('INSERT INTO discount_coupons SET ?',value);id=result.insertId;}
  await conn.commit();return id;
 }catch(e){await conn.rollback();if(e.code==='ER_DUP_ENTRY')fail('This coupon code already exists in your organization.',409);throw e;}finally{conn.release();}
}
async function list(query={}){
 const page=positive(query.page||1,'page'),search=typeof query.search==='string'?query.search.trim().slice(0,40):'';
 const [rows]=await db.query(`SELECT c.*,e.title event_title,
 (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id=c.id AND r.status='redeemed') used,
 (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id=c.id AND r.status='reserved') reserved
 FROM discount_coupons c LEFT JOIN events e ON e.id=c.event_id WHERE c.code LIKE ? ORDER BY c.id DESC LIMIT 20 OFFSET ?`,['%'+search+'%',(page-1)*20]);
 const [[count]]=await db.query('SELECT COUNT(*) total FROM discount_coupons WHERE code LIKE ?',['%'+search+'%']);
 return {coupons:rows.map(present),total:Number(count.total),page};
}
// Called with the coupon row locked while reserving a booking. Preview is advisory.
async function calculate(conn,input,items,{lock=false,email=''}={}){
 const subtotal=items.reduce((sum,i)=>sum+money.minorUnits(i.ticketType.price)*i.qty,0);
 money.decimal(subtotal);
 if(!input.coupon_code)return {subtotal_minor:subtotal,discount_minor:0,total_minor:subtotal,coupon:null};
 const normalized=code(input.coupon_code);
 const [[coupon]]=await conn.query('SELECT *,UTC_TIMESTAMP() now_utc FROM discount_coupons WHERE code=?'+(lock?' FOR UPDATE':''),[normalized]);
 if(!coupon||!coupon.enabled)fail('This coupon code is invalid or disabled.',400);
 if(input.coupon_revision!==undefined&&Number(input.coupon_revision)!==coupon.revision)fail('This coupon changed. Apply the code again.',409);
 if(coupon.starts_at&&coupon.now_utc<coupon.starts_at)fail('This coupon is not active yet.');
 if(coupon.ends_at&&coupon.now_utc>=coupon.ends_at)fail('This coupon has expired.');
 if(coupon.event_id&&coupon.event_id!==Number(input.event_id))fail('This coupon is not valid for this event.');
 if(subtotal<Number(coupon.min_subtotal_minor))fail('This coupon requires a booking subtotal of ₹'+money.decimal(Number(coupon.min_subtotal_minor))+'.');
 const types=JSON.parse(coupon.ticket_type_ids);
 const eligible=items.filter(i=>!types.length||types.includes(i.ticketType.id)).reduce((sum,i)=>sum+money.minorUnits(i.ticketType.price)*i.qty,0);
 if(!eligible)fail('This coupon does not apply to the selected tickets.');
 if(lock&&coupon.per_email_limit&&!email.trim())fail('This coupon requires an attendee email address.');
 const [[usage]]=await conn.query("SELECT COUNT(*) total,COALESCE(SUM(email=?),0) customer FROM coupon_redemptions WHERE coupon_id=? AND status IN ('reserved','redeemed')",[email.trim().toLowerCase(),coupon.id]);
 if(coupon.usage_limit&&usage.total>=coupon.usage_limit)fail('This coupon has reached its usage limit.',409);
 if(email&&coupon.per_email_limit&&usage.customer>=coupon.per_email_limit)fail('This email address has already used this coupon the allowed number of times.',409);
 let discount=coupon.kind==='fixed'?Number(coupon.value_units):Number(BigInt(eligible)*BigInt(coupon.value_units)/10000n);
 discount=Math.min(eligible,discount,coupon.max_discount_minor===null?eligible:Number(coupon.max_discount_minor));
 if(discount<1)fail('This coupon does not reduce the selected ticket total.');
 const total=subtotal-discount;

 // Allocate a capped/fixed discount proportionally, preserving every paise.
 const lines=items.map(i=>{const amount=money.minorUnits(i.ticketType.price)*i.qty,applies=!types.length||types.includes(i.ticketType.id);const numerator=BigInt(discount)*BigInt(applies?amount:0);return {ticket_type_id:i.ticketType.id,eligible:applies,subtotal_minor:amount,discount_minor:Number(numerator/BigInt(eligible)),remainder:numerator%BigInt(eligible)};});
 let remaining=discount-lines.reduce((sum,line)=>sum+line.discount_minor,0);
 const ranked=[...lines].sort((a,b)=>a.remainder===b.remainder?a.ticket_type_id-b.ticket_type_id:a.remainder>b.remainder?-1:1);
 for(const line of ranked){if(!remaining)break;if(line.eligible&&line.subtotal_minor){line.discount_minor++;remaining--;}}
 const breakdown={scope:types.length?'selected':'all',eligible_subtotal_minor:eligible,lines:lines.map(({remainder,...line})=>({...line,total_minor:line.subtotal_minor-line.discount_minor}))};
 return {subtotal_minor:subtotal,discount_minor:discount,total_minor:total,breakdown,coupon:{id:coupon.id,code:coupon.code,revision:coupon.revision}};
}
async function resolveCart(input,conn=db){
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>50||new Set(input.items.map(i=>Number(i.ticket_type_id))).size!==input.items.length)fail('Choose valid tickets.');
 const [[event]]=await conn.query("SELECT * FROM events WHERE id=? AND status='published' AND archived_at IS NULL",[positive(input.event_id,'event')]);
 if(!event)fail('Event not available for booking.',404);
 const items=[];
 for(const item of [...input.items].sort((a,b)=>Number(a.ticket_type_id)-Number(b.ticket_type_id))){const [[type]]=await conn.query('SELECT * FROM ticket_types WHERE id=? AND event_id=?',[positive(item.ticket_type_id,'ticket type'),event.id]);const qty=positive(item.qty,'ticket quantity');
  if(!type||availability(event,type)!=='on_sale'||qty<type.min_per_order||qty>type.max_per_order||qty>type.quantity-type.sold)fail('Review your ticket availability and quantities.',409);
  items.push({ticketType:type,qty});
 }
 return items;
}
async function preview(input){return require('./pricing').preview(input);}
async function reserve(conn,quote,orderId,email,pending){
 if(!quote.coupon)return;
 await conn.query('INSERT INTO coupon_redemptions(coupon_id,order_id,email,status,discount_minor) VALUES (?,?,?,?,?)',[quote.coupon.id,orderId,email.trim().toLowerCase(),pending?'reserved':'redeemed',quote.discount_minor]);
}
async function transition(conn,orderId,status){
 const [[row]]=await conn.query('SELECT coupon_id FROM coupon_redemptions WHERE order_id=?',[orderId]);if(!row)return;
 await conn.query('SELECT id FROM discount_coupons WHERE id=? FOR UPDATE',[row.coupon_id]);
 await conn.query("UPDATE coupon_redemptions SET status=? WHERE order_id=? AND status='reserved'",[status,orderId]);
}
module.exports={code,fields,save,list,preview,resolveCart,calculate,reserve,transition};
