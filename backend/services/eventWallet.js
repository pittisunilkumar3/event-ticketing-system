const db = require('../config/db');
const { fail } = require('./studioValidation');

function minorUnits(value) {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) fail('Invalid booking amount.');
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}
function decimal(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 9999999999) fail('Booking total exceeds the supported amount.');
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
// These run in the SAME transaction as the order, tickets and inventory.
// A unique order/type key makes retries unable to credit or reverse twice.
async function credit(conn, orderId) {
  await conn.query(`INSERT INTO event_wallet_entries(event_id,order_id,entry_type,reason,mode,currency,amount)
    SELECT event_id,id,'booking','booking',CASE payment_method WHEN 'mock' THEN 'demo' WHEN 'razorpay_live' THEN 'live' WHEN 'razorpay_test' THEN 'test' ELSE 'recorded' END,currency,total_amount
    FROM orders WHERE id=? AND status='paid'`, [orderId]);
}
async function reverse(conn, orderId, reason) {
  if (!['cancelled','refunded'].includes(reason)) fail('Invalid wallet reversal.');
  await conn.query(`INSERT INTO event_wallet_entries(event_id,order_id,entry_type,reason,mode,currency,amount)
    SELECT event_id,order_id,'reversal',?,mode,currency,-amount
    FROM event_wallet_entries WHERE order_id=? AND entry_type='booking'`, [reason, orderId]);
}
function positive(value, label) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)<1) fail(`Choose a valid ${label}.`);
  return Number(value);
}
async function overview(query) {
  const eventId = query.event_id ? positive(query.event_id, 'event') : null;
  const page = positive(query.page || 1, 'page');
  if (page > 100000) fail('Choose a valid page.');
  const mode = query.mode || 'live';
  const currency=query.currency||'INR';
  if(!['INR','USD'].includes(currency))fail('Choose a valid currency.');
  if (!['demo','recorded','test','live'].includes(mode)) fail('Choose a valid payment type.');
  if (query.include_archived !== undefined && !['true','false'].includes(query.include_archived)) fail('Choose a valid archived event filter.');
  let includeArchived = query.include_archived === 'true';
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (eventId) {
      const [[event]] = await conn.query('SELECT id,archived_at FROM events WHERE id=?', [eventId]);
      if (!event) fail('Event not found.', 404);
      if (event.archived_at) includeArchived = true;
    }
    const filter = (eventId ? ' AND w.event_id=?' : '') + (includeArchived ? '' : ' AND e.archived_at IS NULL');
    const args = eventId ? [mode,currency,eventId] : [mode,currency];
    const [[summary]] = await conn.query(`SELECT COALESCE(SUM(amount),0) balance,
      COALESCE(SUM(IF(entry_type='booking',amount,0)),0) credits,
      COALESCE(-SUM(IF(entry_type='reversal',amount,0)),0) reversals,
      COALESCE(-SUM(IF(entry_type IN ('withdrawal','payout_reversal'),amount,0)),0) withdrawn,
      COUNT(IF(entry_type='booking',1,NULL)) bookings, COUNT(*) entries
      FROM event_wallet_entries w JOIN events e ON e.id=w.event_id WHERE w.mode=? AND w.currency=?${filter}`, args);
    const [events] = await conn.query(`SELECT e.id,e.title,e.status,e.archived_at,
      COALESCE(w.balance,0) balance,COALESCE(w.credits,0) credits,COALESCE(w.reversals,0) reversals,
      COALESCE(w.bookings,0) bookings
      FROM events e LEFT JOIN (
        SELECT event_id,SUM(amount) balance,SUM(IF(entry_type='booking',amount,0)) credits,
        -SUM(IF(entry_type='reversal',amount,0)) reversals,COUNT(IF(entry_type='booking',1,NULL)) bookings
        FROM event_wallet_entries WHERE mode=? AND currency=? GROUP BY event_id
      ) w ON w.event_id=e.id ${includeArchived?'':'WHERE e.archived_at IS NULL'} ORDER BY e.id DESC`, [mode,currency]);
    const [entries] = await conn.query(`SELECT w.*,o.booking_ref,e.title event_title
      FROM event_wallet_entries w LEFT JOIN orders o ON o.id=w.order_id JOIN events e ON e.id=w.event_id
      WHERE w.mode=? AND w.currency=?${filter} ORDER BY w.id DESC LIMIT 25 OFFSET ?`, [...args,(page-1)*25]);
    let held='0.00',refundHeld='0.00';
    if(mode==='live') {
      const central=require('./bookingPayments').central;
      const withdrawals=central('wallet_withdrawals');
      const [refunds]=await conn.query(`SELECT p.event_id,SUM(p.amount_minor)/100 amount FROM ${central('booking_payments')} p JOIN orders o ON o.id=p.order_id WHERE p.organization_id=? AND p.mode='live' AND p.currency=? AND p.status IN ('refund_pending','review') AND o.status='paid' GROUP BY p.event_id`,[db.current().id,currency]);
      const [holds]=await conn.query(`SELECT event_id,SUM(amount) held FROM ${withdrawals} WHERE organization_id=? AND currency=? AND status IN ('pending','approved') GROUP BY event_id`,[db.current().id,currency]);
      for(const event of events){event.held=holds.find(h=>h.event_id===event.id)?.held||'0.00';event.refund_held=refunds.find(r=>r.event_id===event.id)?.amount||'0.00';event.available=(Number(event.balance)-Number(event.held)-Number(event.refund_held)).toFixed(2);}
      const visibleIds=new Set(events.filter(e=>!eventId||e.id===eventId).map(e=>e.id));
      refundHeld=refunds.filter(r=>visibleIds.has(r.event_id)).reduce((sum,r)=>sum+Number(r.amount),0).toFixed(2);
      held=holds.filter(h=>visibleIds.has(h.event_id)).reduce((sum,h)=>sum+Number(h.held),0).toFixed(2);
    }
    summary.held=held;summary.refund_held=refundHeld;summary.available=(Number(summary.balance)-Number(held)-Number(refundHeld)).toFixed(2);
    await conn.commit();
    return {currency,mode,event_id:eventId,include_archived:includeArchived,summary,events,entries,
      pagination:{page,pages:Math.ceil(Number(summary.entries)/25),total:Number(summary.entries)}};
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
module.exports = { minorUnits, decimal, credit, reverse, overview };
