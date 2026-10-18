const db = require('../config/db');
const { sqlName } = require('./provision');
const { fail } = require('../services/studioValidation');
const table = name => `${sqlName(db.database)}.${sqlName(name)}`;
async function lockOrganization(conn) {
  const org = db.current();
  if (!org) return null; // maintenance scripts have no HTTP tenant context
  const [[current]] = await conn.query(`SELECT * FROM ${table('organizations')} WHERE id=? FOR UPDATE`, [org.id]);
  if (!current || current.status !== 'active') fail('This organizer cannot create or publish events.',403);
  return current;
}
async function requirePackage(conn, org) {
  if (!org) return;
  if (org.event_balance<1) fail('No event credits remaining. Purchase a package or ask the platform administrator to add credits.',402);
}
async function consume(conn, org, event) {
  if (!org || event.credit_consumed) return;
  await requirePackage(conn,org);
  await conn.query(`UPDATE ${table('organizations')} SET event_balance=event_balance-1 WHERE id=?`,[org.id]);
  await conn.query(`INSERT INTO ${table('event_credits')}(organization_id,amount,kind,reason,reference_key) VALUES (?,-1,'publish',?,?)`,[org.id,`Published: ${event.title}`,`event:${event.id}`]);
  await conn.query('UPDATE events SET credit_consumed=TRUE WHERE id=?',[event.id]);
}
async function adjust(orgId, amount, reason, actorId, requestKey) {
  if(!Number.isInteger(amount) || !amount || Math.abs(amount)>100000) fail('Enter a non-zero whole number of events (up to 100,000).');
  if(typeof reason!=='string' || reason.trim().length<5 || reason.length>500) fail('Enter a reason of 5–500 characters.');
  if(typeof requestKey!=='string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey)) fail('A valid request reference is required.');
  const conn=await db.platform.getConnection();
  try {
    await conn.beginTransaction();
    const [[org]]=await conn.query('SELECT * FROM organizations WHERE id=? FOR UPDATE',[orgId]);
    if(!org) fail('Organizer not found.',404);
    const [[existing]]=await conn.query('SELECT id FROM event_credits WHERE organization_id=? AND reference_key=?',[orgId,'adjust:'+requestKey]);
    if(!existing) {
      if(org.event_balance+amount<0) fail('An adjustment cannot make the event balance negative.',409);
      await conn.query('UPDATE organizations SET event_balance=event_balance+? WHERE id=?',[amount,orgId]);
      await conn.query("INSERT INTO event_credits(organization_id,amount,kind,reason,reference_key,actor_id) VALUES (?,?,'adjustment',?,?,?)",[orgId,amount,reason.trim(),'adjust:'+requestKey,actorId]);
      await conn.query('INSERT INTO platform_audit(actor_id,organization_id,action,details_json) VALUES (?,?,?,?)',[actorId,orgId,'credit.adjust',JSON.stringify({amount,reason})]);
    }
    await conn.commit();
  } catch(e){await conn.rollback();throw e;} finally{conn.release();}
}
module.exports={lockOrganization,requirePackage,consume,adjust};
