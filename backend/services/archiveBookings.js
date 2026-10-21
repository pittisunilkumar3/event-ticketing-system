const db = require('../config/db');
const { fail } = require('./studioValidation');
const { central } = require('./bookingPayments');

// Operational cleanup: retain payment and wallet history without refunding money.
// No public endpoint; callers must explicitly identify the bookings to remove.
async function archiveBookings(ids) {
  if (!db.current()?.id || !Array.isArray(ids) || !ids.length || ids.some(id => !Number.isSafeInteger(id) || id < 1)) fail('Choose bookings to remove.');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [events] = await conn.query('SELECT DISTINCT event_id FROM orders WHERE id IN (?) ORDER BY event_id', [ids]);
    for (const event of events) await conn.query('SELECT id FROM events WHERE id=? FOR UPDATE', [event.event_id]);
    const [payments] = await conn.query(`SELECT status FROM ${central('booking_payments')} WHERE organization_id=? AND order_id IN (?) FOR UPDATE`, [db.current().id, ids]);
    if (payments.some(p => !['paid', 'expired', 'refunded'].includes(p.status))) fail('Resolve pending payments or refunds before removing bookings.', 409);
    const [orders] = await conn.query('SELECT id,status,archived_at FROM orders WHERE id IN (?) FOR UPDATE', [ids]);
    if (orders.length !== new Set(ids).size) fail('Booking not found.', 404);
    const active = orders.filter(o => !o.archived_at);
    if (active.some(o => o.status === 'pending')) fail('Wait for pending bookings to expire first.', 409);
    for (const order of active) {
      const [[sending]] = await conn.query("SELECT COUNT(*) n FROM mail_outbox WHERE order_id=? AND status='sending'", [order.id]);
      if (sending.n) fail('Email delivery is in progress. Try again shortly.', 409);
      const [tickets] = await conn.query("SELECT ticket_type_id,COUNT(*) qty FROM tickets WHERE order_id=? AND status IN ('valid','checked_in') GROUP BY ticket_type_id", [order.id]);
      for (const ticket of tickets) await require('../models/TicketType').release(ticket.ticket_type_id, ticket.qty, conn);
      await conn.query("UPDATE tickets SET status='cancelled',checked_in_at=NULL WHERE order_id=?", [order.id]);
      await conn.query("UPDATE mail_outbox SET status='skipped',error_message='Booking removed by owner request.' WHERE order_id=? AND status IN ('pending','failed')", [order.id]);
      await conn.query('UPDATE orders SET archived_at=NOW() WHERE id=?', [order.id]);
    }
    await conn.query(`INSERT INTO ${central('platform_audit')}(organization_id,action,details_json) VALUES (?,'bookings.archived',?)`, [db.current().id, JSON.stringify({order_ids: active.map(o => o.id), refund_requested: false})]);
    await conn.commit();
    return { archived: active.length };
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
module.exports = archiveBookings;
