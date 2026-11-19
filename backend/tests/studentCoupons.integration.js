// Isolated database only. Exercises real order transactions without calling a
// payment provider, starting workers, or sending email.
require('dotenv').config();
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const mysql=require('mysql2/promise');
const database='tf_student_test_'+crypto.randomBytes(8).toString('hex');
process.env.DB_NAME=database;
process.env.RAZORPAY_LIVE_ONLY='false';
process.env.RAZORPAY_KEY_ID='rzp_test_StudentFieldsFixture';
process.env.RAZORPAY_KEY_SECRET=crypto.randomBytes(24).toString('hex');
process.env.RAZORPAY_WEBHOOK_SECRET=crypto.randomBytes(24).toString('hex');
process.env.SETTINGS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
const db=require('../config/db');
const {migrateTenant,migratePlatform,sqlName}=require('../saas/provision');
const coupons=require('../services/coupons');
const pricing=require('../services/pricing');
const taxes=require('../services/taxes');
const Order=require('../models/Order');
let server;
let created=false;
async function fixtures(){
 const [e]=await db.query("INSERT INTO events(title,slug,start_datetime,status) VALUES ('Student coupon test',?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY),'published')",['student-'+crypto.randomUUID()]);
 const ids=[];
 for(const [name,price,offer=null] of [['Explorer',999],['Creators',1499],['Day',699,499],['Other',499]]){
  const [t]=await db.query('INSERT INTO ticket_types(event_id,name,price,offer_price,quantity,is_active,min_per_order,max_per_order) VALUES (?,?,?,?,100,1,1,10)',[e.insertId,name,price,offer]);ids.push(t.insertId);
 }
 const id=await coupons.save({code:'EDU-'+e.insertId,kind:'fixed',value:'500',event_id:e.insertId,ticket_scope:'selected',ticket_type_ids:ids.slice(0,3),enabled:true,student_fields:true});
 await db.query('UPDATE discount_coupons SET fixed_per_ticket=1,tax_free_unit_max_minor=49900,fixed_ticket_discounts_minor=? WHERE id=?',[JSON.stringify({[ids[2]]:10000}),id]);
 await taxes.save({event_id:e.insertId,name:'GST',price_mode:'exclusive',enabled:true,ticket_scope:'selected',ticket_type_ids:ids.slice(0,3),components:[{kind:'CGST',rate:'9'},{kind:'SGST',rate:'9'}]});
 return {event_id:e.insertId,ids,code:'EDU-'+e.insertId};
}
const person=(id)=>({registration_answers:{},college_name:'  Verification College  ',student_id:id});
function input(f,groups,code=f.code){
 return {event_id:f.event_id,contact_source:'attendee',request_key:crypto.randomUUID(),coupon_code:code,items:groups.map(([index,people])=>({ticket_type_id:f.ids[index],qty:people.length,form_version:'event:0:ticket:0',attendees:people}))};
}
async function quoted(payload){
 const q=await pricing.preview({event_id:payload.event_id,coupon_code:payload.coupon_code,items:payload.items.map(({ticket_type_id,qty})=>({ticket_type_id,qty}))});
 return {...payload,pricing_token:q.pricing_token,coupon_revision:q.coupon?.revision};
}
async function reserve(payload){
 return Order.createWithTickets({...payload,payment:{id:crypto.randomUUID(),request_hash:crypto.createHash('sha256').update(payload.request_key).digest('hex')}});
}
async function state(){
 const [[row]]=await db.query('SELECT (SELECT COUNT(*) FROM orders) orders_count,(SELECT COALESCE(SUM(sold),0) FROM ticket_types) sold,(SELECT COUNT(*) FROM event_student_registrations) students');return row;
}
(async()=>{
 const connection=await mysql.createConnection(db.options);
 try{await connection.query('CREATE DATABASE '+sqlName(database));created=true;}finally{await connection.end();}
 await migrateTenant(database);await migratePlatform();
 const [[org]]=await db.platform.query('SELECT * FROM organizations WHERE is_legacy=TRUE');
 await db.run(org,async()=>{
  const f=await fixtures();
  await require('../services/udyam').saveSettings(f.event_id,{enabled:true,mode:'manual',per_ticket_minor:10000,placeholder:'UDYAM-TS-09-0216688',revision:0},null);
  const app=require('../server');server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/o/legacy';
  const publicQuote=await fetch(base+'/checkout/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:f.event_id,coupon_code:f.code,items:[{ticket_type_id:f.ids[0],qty:1},{ticket_type_id:f.ids[1],qty:1}]})});
  assert.equal(publicQuote.status,200);const q=(await publicQuote.json()).data;
  assert.equal(q.student_id_required,true);assert.equal(q.total_minor,167782);assert.equal(q.tax.tax_minor,17982);assert.equal(q.student_attendees,undefined);
  const day=await pricing.preview({event_id:f.event_id,coupon_code:f.code,items:[{ticket_type_id:f.ids[2],qty:1}]});
  assert.equal(day.student_id_required,true);assert.equal(day.discount_minor,10000);assert.equal(day.total_minor,39900);assert.equal(day.tax.tax_minor,0);
  const mixed=await pricing.preview({event_id:f.event_id,coupon_code:f.code,items:[{ticket_type_id:f.ids[0],qty:1},{ticket_type_id:f.ids[1],qty:1},{ticket_type_id:f.ids[2],qty:2}]});
  assert.equal(mixed.total_minor,247582);assert.equal(mixed.tax.tax_minor,17982);
  assert.deepEqual(mixed.breakdown.lines.map(l=>[l.discount_minor,l.total_minor]),[[50000,49900],[50000,99900],[20000,79800]]);
  const missing=await quoted(input(f,[[2,[{}]]]));const before=await state();
  const rejected=await fetch(base+'/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...missing,student_id_required:false})});
  assert.equal(rejected.status,400);assert.match((await rejected.json()).message,/college name and student ID/);assert.deepEqual(await state(),before);
  for(const pass of [0,1,2]){
   await assert.rejects(reserve(await quoted(input(f,[[pass,[{student_id:'ID-001'}]]]))),/college name and student ID/);
   await assert.rejects(reserve(await quoted(input(f,[[pass,[{college_name:'College'}]]]))),/college name and student ID/);
   for(const field of ['college_name','student_id']){
    const blank={...person('ID-001'),[field]:'   '};
    await assert.rejects(reserve(await quoted(input(f,[[pass,[blank]]]))),/college name and student ID/);
   }
  }
  for(const [first,second] of [[0,1],[0,2],[1,2]]){
   await assert.rejects(reserve(await quoted(input(f,[[first,[person(' ID-001 ')]],[second,[person('id-001')]]]))),/more than once/);
  }
  await assert.rejects(reserve(await quoted(input(f,[[2,[person('ID-001'),{}]]]))),/college name and student ID/);
  const bothDiscounts=input(f,[[0,[{...person('ID-001'),udyam_number:'UDYAM-TS-09-0216688'}]]]);
  await assert.rejects(pricing.preview(bothDiscounts),/either a coupon or the Udyam discount/);
  await assert.rejects(reserve(await quoted(bothDiscounts)),/either a coupon or the Udyam discount/);
  assert.deepEqual(await state(),before);
  console.log('PASS: HTTP quote preserves pricing; required fields cannot be bypassed; missing/duplicate attendees roll back stock and orders.');

  const payload=await quoted(input(f,[[0,[person(' ID-001 ')]],[1,[person('ID-002')]],[2,[person('ID-003')]],[3,[{}]]]));
  const booked=await reserve(payload);assert.equal(booked.order.status,'pending');assert.equal(Number(booked.order.total_amount),2575.82);
  const saved=await require('../services/attendees').forOrder(booked.order.id);
  for(const [id,student] of [[f.ids[0],'ID-001'],[f.ids[1],'ID-002'],[f.ids[2],'ID-003']]){
   const answers=saved.find(p=>p.ticket_type_id===id).answers;
   assert.equal(answers.find(a=>a.id==='f_college_name').value,'Verification College');assert.equal(answers.find(a=>a.id==='f_student_id').value,student);
  }
  assert.equal(saved.find(p=>p.ticket_type_id===f.ids[3]).answers.length,0);
  const [[udyamRegistrations]]=await db.query('SELECT COUNT(*) n FROM event_udyam_registrations WHERE order_id=?',[booked.order.id]);
  assert.equal(udyamRegistrations.n,0);
  await assert.rejects(reserve({...payload}),e=>e.code==='ER_DUP_ENTRY');
  for(const [pass,student] of [[1,' id-001 '],[2,'id-001'],[2,'id-002'],[0,'id-003'],[1,'id-003']]){
   await assert.rejects(reserve(await quoted(input(f,[[pass,[person(student)]]]))),e=>e.statusCode===409&&/already been used/.test(e.message));
  }
  const [[registered]]=await db.query('SELECT COUNT(*) n FROM event_student_registrations WHERE order_id=?',[booked.order.id]);assert.equal(registered.n,3);
  const c=await db.getConnection();try{await assert.rejects(coupons.reserveStudentIds(c,f.event_id,booked.order.id,[{student_id:'iD-001',college_name:'Another college',ticket_type_id:f.ids[1],position:8}]),e=>e.statusCode===409);}finally{c.release();}
  console.log('PASS: Day gets ₹100 off its offer price; Explorer/Creators retain ₹500 off; student answers persist and duplicate IDs are rejected across all three passes.');

  const race=await Promise.all([0,1,2].map(pass=>quoted(input(f,[[pass,[person(pass===1?'race-id':'RACE-ID')]]]))));
  const results=await Promise.allSettled(race.map(reserve));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const failures=results.filter(r=>r.status==='rejected');assert.equal(failures.length,2);assert(failures.every(r=>r.reason.statusCode===409));
  const [[unique]]=await db.query('SELECT COUNT(*) n FROM event_student_registrations WHERE event_id=? AND student_id=?',[f.event_id,'RACE-ID']);assert.equal(unique.n,1);
  const plain=await reserve(await quoted(input(f,[[0,[{}]]],null)));
  assert.equal(Number(plain.order.total_amount),1178.82);
  const [[plainIds]]=await db.query('SELECT COUNT(*) n FROM event_student_registrations WHERE order_id=?',[plain.order.id]);assert.equal(plainIds.n,0);
  const other=await fixtures();
  const anotherEvent=await reserve(await quoted(input(other,[[0,[person('ID-001')]]])));
  assert.equal(Number(anotherEvent.order.total_amount),499);
  const {coupons:configured}=await coupons.list({search:f.code});
  const setting=configured.find(c=>c.code===f.code);
  await coupons.save({...setting,enabled:true,student_fields:false},setting.id);
  const ordinaryQuote=await pricing.preview({event_id:f.event_id,coupon_code:f.code,items:[{ticket_type_id:f.ids[0],qty:1}]});
  assert.equal(ordinaryQuote.student_id_required,undefined);assert.equal(ordinaryQuote.total_minor,49900);
  const savedDay=await pricing.preview({event_id:f.event_id,coupon_code:f.code,items:[{ticket_type_id:f.ids[2],qty:1}]});
  assert.equal(savedDay.student_id_required,undefined);assert.equal(savedDay.total_minor,39900);
  console.log('PASS: concurrent use accepts only one booking; no-code checkout is unchanged; uniqueness is per event; the admin toggle controls the requirement.');
 });
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 if(server)await new Promise(resolve=>server.close(resolve));
 await db.end();
 if(created){assert.match(database,/^tf_student_test_[a-f0-9]{16}$/);const connection=await mysql.createConnection(db.options);try{await connection.query('DROP DATABASE '+sqlName(database));console.log('Removed isolated student-coupon test database.');}finally{await connection.end();}}
});
