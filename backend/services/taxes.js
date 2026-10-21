const db=require('../config/db');
const {fail,string}=require('./studioValidation');
const money=require('./eventWallet');
const crypto=require('node:crypto');
const kinds=['CGST','SGST','UTGST','IGST','CESS','OTHER'];
function id(value){if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<1)fail('Choose a valid event or ticket type.');return Number(value);}
function fields(input){
 const event_id=id(input.event_id),name=string(input.name,'Tax name',100,true);
 if(!['exclusive','inclusive'].includes(input.price_mode))fail('Choose whether ticket prices include tax.');
 if(typeof input.enabled!=='boolean')fail('Choose whether this tax is enabled.');
 if(!Array.isArray(input.ticket_type_ids)||input.ticket_type_ids.length>100)fail('Select valid ticket types.');
 if(input.ticket_scope!==undefined&&!['all','selected'].includes(input.ticket_scope))fail('Choose all tickets or selected ticket types.');
 const ids=input.ticket_type_ids.map(id);if(new Set(ids).size!==ids.length)fail('Select each ticket type once.');
 if(input.ticket_scope==='selected'&&!ids.length)fail('Select at least one ticket type.');
 if(input.ticket_scope==='all'&&ids.length)fail('All-ticket scope cannot contain selected ticket types.');
 if(!Array.isArray(input.components)||!input.components.length||input.components.length>8)fail('Add between one and eight tax components.');
 const components=input.components.map(c=>{
  if(!c||!kinds.includes(c.kind))fail('Choose a valid tax component.');
  const rate_bps=money.minorUnits(c.rate);if(rate_bps>10000)fail('Tax rates must be between 0 and 100%.');
  return {kind:c.kind,name:c.kind==='OTHER'?string(c.name,'Tax component name',60,true):c.kind,rate_bps};
 });
 if(components.reduce((sum,c)=>sum+c.rate_bps,0)>10000)fail('Combined tax rates cannot exceed 100%.');
 if(new Set(components.map(c=>c.name.toLowerCase())).size!==components.length)fail('Use each tax component name once.');
 const byKind=Object.fromEntries(components.map(c=>[c.kind,c]));
 if(byKind.IGST&&(byKind.CGST||byKind.SGST||byKind.UTGST))fail('Use IGST or CGST with SGST/UTGST, not both.');
 if(byKind.SGST&&byKind.UTGST)fail('Choose SGST or UTGST, not both.');
 if(Boolean(byKind.CGST)!==Boolean(byKind.SGST||byKind.UTGST))fail('Pair CGST with SGST or UTGST.');
 if(byKind.CGST&&byKind.CGST.rate_bps!==(byKind.SGST||byKind.UTGST).rate_bps)fail('CGST and SGST/UTGST must have matching rates.');
 const legal_name=string(input.legal_name||'','Business name',150),gstin=string(input.gstin||'','GSTIN',15).toUpperCase();
 if(gstin&&!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$/.test(gstin))fail('Enter a valid 15-character GSTIN.');
 return {event_id,name,price_mode:input.price_mode,ticket_type_ids:JSON.stringify(ids),components_json:JSON.stringify(components),legal_name,gstin,enabled:input.enabled};
}
function present(row){return {...row,ticket_type_ids:JSON.parse(row.ticket_type_ids),components:JSON.parse(row.components_json).map(c=>({...c,rate:(c.rate_bps/100).toFixed(2)}))};}
async function list(){const [rows]=await db.query('SELECT p.*,e.title event_title FROM event_tax_profiles p JOIN events e ON e.id=p.event_id WHERE p.deleted_at IS NULL ORDER BY p.id DESC');return rows.map(present);}
async function save(input,profileId){
 const value=fields(input),conn=await db.getConnection();
 try{
  await conn.beginTransaction();
  // Same event lock as order creation: tax changes cannot race a reservation.
  const [[event]]=await conn.query('SELECT id FROM events WHERE id=? AND archived_at IS NULL FOR UPDATE',[value.event_id]);if(!event)fail('Choose an event in your organization.');
  if(profileId){profileId=id(profileId);const [[old]]=await conn.query('SELECT * FROM event_tax_profiles WHERE id=? FOR UPDATE',[profileId]);if(!old||old.deleted_at)fail('Tax profile not found.',404);if(old.event_id!==value.event_id)fail('Create a new tax profile to use another event.');if(old.revision!==Number(input.revision))fail('These taxes changed. Reload before saving.',409);}
  const ids=JSON.parse(value.ticket_type_ids);
  if(ids.length){const [types]=await conn.query('SELECT id FROM ticket_types WHERE event_id=? AND archived_at IS NULL AND id IN (?)',[value.event_id,ids]);if(types.length!==ids.length)fail('Every selected ticket must belong to this event.');}
  if(value.enabled){const [others]=await conn.query('SELECT id,ticket_type_ids FROM event_tax_profiles WHERE event_id=? AND enabled=1 AND deleted_at IS NULL AND id<>?',[value.event_id,profileId||0]);if(others.some(p=>{const other=JSON.parse(p.ticket_type_ids);return !ids.length||!other.length||ids.some(x=>other.includes(x));}))fail('These tickets already have an enabled tax profile. Edit or disable that profile first.',409);}
  if(profileId)await conn.query('UPDATE event_tax_profiles SET ?,revision=revision+1 WHERE id=?',[value,profileId]);else{const [r]=await conn.query('INSERT INTO event_tax_profiles SET ?',value);profileId=r.insertId;}
  await conn.commit();return profileId;
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function remove(profileId,revision){
 profileId=id(profileId);
 const conn=await db.getConnection();
 try{
  await conn.beginTransaction();
  const [[found]]=await conn.query('SELECT event_id FROM event_tax_profiles WHERE id=?',[profileId]);
  if(!found)fail('Tax profile not found.',404);
  // Keep the same lock order as saves and checkout reservations.
  await conn.query('SELECT id FROM events WHERE id=? FOR UPDATE',[found.event_id]);
  const [[profile]]=await conn.query('SELECT * FROM event_tax_profiles WHERE id=? FOR UPDATE',[profileId]);
  if(!profile||profile.deleted_at)fail('Tax profile not found.',404);
  if(profile.revision!==Number(revision))fail('These taxes changed. Reload before deleting.',409);
  await conn.query('UPDATE event_tax_profiles SET deleted_at=NOW(),enabled=0,revision=revision+1 WHERE id=?',[profileId]);
  await conn.commit();
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
function rounded(numerator,denominator){return Number((numerator+denominator/2n)/denominator);}
function allocate(amount,components){
 const weight=components.reduce((sum,c)=>sum+c.rate_bps,0);if(!weight)return components.map(()=>0);
 const values=components.map((c,index)=>({index,amount:Number(BigInt(amount)*BigInt(c.rate_bps)/BigInt(weight)),remainder:BigInt(amount)*BigInt(c.rate_bps)%BigInt(weight)}));
 let rest=amount-values.reduce((sum,v)=>sum+v.amount,0);
 for(const v of [...values].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1)){if(!rest)break;v.amount++;rest--;}
 return values.map(v=>v.amount);
}
function compute(profiles,items,coupon){
 const applied=new Map(),components=new Map();
 const lines=items.map(i=>{
  const subtotal=money.minorUnits(i.ticketType.price)*i.qty;
  const discount=coupon.breakdown?.lines.find(l=>l.ticket_type_id===i.ticketType.id)?.discount_minor||0;
  const gross=subtotal-discount;
  const matches=profiles.filter(p=>!p.ticket_type_ids.length||p.ticket_type_ids.includes(i.ticketType.id));if(matches.length>1)fail('Tax settings overlap. Contact the organizer.',409);
  const profile=matches[0];let tax=0,amounts=[];
  if(profile){applied.set(profile.id,profile);const rate=profile.components.reduce((sum,c)=>sum+c.rate_bps,0);tax=rounded(BigInt(gross)*BigInt(rate),BigInt(profile.price_mode==='inclusive'?10000+rate:10000));amounts=allocate(tax,profile.components);profile.components.forEach((c,index)=>{const key=profile.id+':'+index;const row=components.get(key)||{name:c.name,rate_bps:c.rate_bps,amount_minor:0,included:profile.price_mode==='inclusive',profile_id:profile.id};row.amount_minor+=amounts[index];components.set(key,row);});}
  const included=profile?.price_mode==='inclusive';
  return {ticket_type_id:i.ticketType.id,profile_id:profile?.id||null,price_mode:profile?.price_mode||null,subtotal_minor:subtotal,discount_minor:discount,taxable_minor:included?gross-tax:gross,tax_minor:tax,total_minor:included?gross:gross+tax};
 });
 const snapshot={profiles:[...applied.values()].map(p=>({id:p.id,revision:p.revision,name:p.name,price_mode:p.price_mode,legal_name:p.legal_name,gstin:p.gstin})),components:[...components.values()],lines,taxable_minor:lines.reduce((s,l)=>s+l.taxable_minor,0),tax_minor:lines.reduce((s,l)=>s+l.tax_minor,0),total_minor:lines.reduce((s,l)=>s+l.total_minor,0)};
 money.decimal(snapshot.total_minor);
 return snapshot;
}
async function calculate(conn,eventId,items,coupon){const [rows]=await conn.query('SELECT * FROM event_tax_profiles WHERE event_id=? AND enabled=1 AND deleted_at IS NULL ORDER BY id',[eventId]);return compute(rows.map(present),items,coupon);}
function token(eventId,coupon,tax){return crypto.createHash('sha256').update(JSON.stringify({eventId:Number(eventId),coupon, tax})).digest('hex');}
module.exports={fields,present,list,save,remove,calculate,compute,token};
