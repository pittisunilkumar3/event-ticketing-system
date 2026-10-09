const crypto = require('crypto');
const db = require('../config/db');
const TicketType = require('./TicketType');
const Ticket = require('./Ticket');

function generateBookingRef() {
  return 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. TKT-8F3K2A91
}

const Order = {
  /**
   * Create order + issue tickets inside a DB transaction.
   * items: [{ ticket_type_id, qty }]
   */
  async createWithTickets({ event_id, customer_name, email, phone, items }) {
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Validate event exists & is published
      const [eventRows] = await conn.query(
        "SELECT id, title, status FROM events WHERE id = ? AND status = 'published' LIMIT 1",
        [event_id]
      );
      if (!eventRows.length) {
        const err = new Error('Event not found or not available for booking');
        err.statusCode = 404;
        throw err;
      }

      // 2. Validate ticket types belong to event, are on sale, reserve inventory
      let total = 0;
      const resolvedItems = [];
      for (const item of items) {
        const [rows] = await conn.query('SELECT * FROM ticket_types WHERE id = ? AND event_id = ? LIMIT 1', [
          item.ticket_type_id,
          event_id,
        ]);
        const tt = rows[0];
        if (!tt) {
          const err = new Error(`Ticket type ${item.ticket_type_id} not found for this event`);
          err.statusCode = 400;
          throw err;
        }
        const qty = Number(item.qty);
        if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
          const err = new Error('Quantity must be between 1 and 10');
          err.statusCode = 400;
          throw err;
        }
        const now = new Date();
        if (tt.sales_start && new Date(tt.sales_start) > now) {
          const err = new Error(`Sales for "${tt.name}" have not started yet`);
          err.statusCode = 400;
          throw err;
        }
        if (tt.sales_end && new Date(tt.sales_end) < now) {
          const err = new Error(`Sales for "${tt.name}" have ended`);
          err.statusCode = 400;
          throw err;
        }
        const reserved = await TicketType.reserve(tt.id, qty, conn);
        if (!reserved) {
          const err = new Error(`Not enough tickets available for "${tt.name}"`);
          err.statusCode = 409;
          throw err;
        }
        total += Number(tt.price) * qty;
        resolvedItems.push({ ticketType: tt, qty });
      }

      // 3. Create order (mock payment => instantly paid)
      const bookingRef = generateBookingRef();
      const [orderResult] = await conn.query(
        `INSERT INTO orders (event_id, booking_ref, customer_name, email, phone, total_amount, status, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, 'paid', 'mock')`,
        [event_id, bookingRef, customer_name, email, phone || null, total]
      );
      const orderId = orderResult.insertId;

      // 4. Issue tickets
      const tickets = [];
      for (const { ticketType, qty } of resolvedItems) {
        for (let i = 0; i < qty; i++) {
          const ticket = await Ticket.create(
            {
              order_id: orderId,
              ticket_type_id: ticketType.id,
              attendee_name: customer_name,
            },
            conn
          );
          tickets.push(ticket);
        }
      }

      await conn.commit();

      const order = await this.findById(orderId);
      return { order, tickets };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async findAll({ status, event_id, search, limit = 50, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }
    if (event_id) {
      where.push('o.event_id = ?');
      params.push(event_id);
    }
    if (search) {
      where.push('(o.booking_ref LIKE ? OR o.customer_name LIKE ? OR o.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(
      `SELECT o.*, e.title AS event_title, e.start_datetime AS event_start,
              (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) AS ticket_count
       FROM orders o
       JOIN events e ON e.id = o.event_id
       ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
    return rows;
  },

  async countAll({ status, event_id, search } = {}) {
    const where = [];
    const params = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (event_id) {
      where.push('event_id = ?');
      params.push(event_id);
    }
    if (search) {
      where.push('(booking_ref LIKE ? OR customer_name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(`SELECT COUNT(*) AS total FROM orders ${whereSql}`, params);
    return rows[0].total;
  },

  async findById(id, connection = db) {
    const [rows] = await connection.query(
      `SELECT o.*, e.title AS event_title, e.venue, e.city, e.start_datetime AS event_start, e.end_datetime AS event_end
       FROM orders o JOIN events e ON e.id = o.event_id
       WHERE o.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByRef(ref, connection = db) {
    const [rows] = await connection.query(
      `SELECT o.*, e.title AS event_title, e.venue, e.city, e.start_datetime AS event_start, e.end_datetime AS event_end
       FROM orders o JOIN events e ON e.id = o.event_id
       WHERE o.booking_ref = ? LIMIT 1`,
      [ref]
    );
    return rows[0] || null;
  },

  /**
   * Cancel/refund: invalidates tickets and releases inventory atomically.
   */
  async cancel(id, newStatus) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const order = await this.findById(id, conn);
      if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }
      if (['cancelled', 'refunded'].includes(order.status)) {
        const err = new Error(`Order is already ${order.status}`);
        err.statusCode = 409;
        throw err;
      }

      // 1. Invalidate ALL tickets (valid + already checked-in) — refund voids them
      await conn.query(
        "UPDATE tickets SET status = 'cancelled', checked_in_at = NULL WHERE order_id = ? AND status IN ('valid', 'checked_in')",
        [id]
      );

      // 2. Release inventory for every ticket on the order
      const [ttRows] = await conn.query(
        `SELECT ticket_type_id, COUNT(*) AS qty FROM tickets
         WHERE order_id = ? GROUP BY ticket_type_id`,
        [id]
      );
      for (const row of ttRows) {
        await TicketType.release(row.ticket_type_id, row.qty, conn);
      }

      // 3. Update order status
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, id]);

      await conn.commit();
      return this.findById(id);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = Order;
