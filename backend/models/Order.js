const crypto = require('crypto');
const db = require('../config/db');
const wallet = require('../services/eventWallet');
const TicketType = require('./TicketType');
const Ticket = require('./Ticket');
const Studio = require('./Studio');
const { enqueue } = require('../services/mailer');
const { availability } = require('../services/eventValidation');
const { fail } = require('../services/studioValidation');
const defaultTicketDesign = require('../services/studioDefaults').ticket;

function generateBookingRef() {
  return 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. TKT-8F3K2A91
}

const Order = {
  /**
   * Create order + issue tickets inside a DB transaction.
   * items: [{ ticket_type_id, qty }]
   */
  async createWithTickets({ event_id, customer_name, email, phone, contact_source, items, registration_answers, form_revision, registration_files=[], payment=null }) {
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();
      const gateway = payment ? await require('../services/bookingPayments').lockedConfig(conn) : null;

      // 1. Validate event exists & is published
      const [eventRows] = await conn.query(
        "SELECT * FROM events WHERE id = ? AND status = 'published' AND archived_at IS NULL LIMIT 1 FOR UPDATE",
        [event_id]
      );
      if (!eventRows.length) {
        const err = new Error('Event not found or not available for booking');
        err.statusCode = 404;
        throw err;
      }

      const forms=require('../services/registrationForms');
      const registrationForm=await forms.get(event_id,conn);
      const ticketForms=await forms.forTickets(event_id,conn);
      forms.checkVersions(items,ticketForms,registrationForm,form_revision);
      const perAttendee = contact_source==='attendee' || Boolean(payment) || items.some(item=>item.attendees!==undefined);
      if(!perAttendee&&items.some(item=>ticketForms.get(Number(item.ticket_type_id))?.source==='ticket'))fail('Enter one attendee for every selected ticket.');
      const attendees = perAttendee ? require('../services/attendees').validate(items,ticketForms,registration_files) : null;
      if(contact_source==='attendee')({customer_name,email,phone}=require('../services/attendees').bookingContact(attendees));
      const answers = perAttendee ? [] : forms.answersFor(registrationForm.config,registration_answers,registration_files);

      // 2. Validate ticket types belong to event, are on sale, reserve inventory
      let total = 0;
      const resolvedItems = [];
      if(items.length>50 || new Set(items.map(i=>Number(i.ticket_type_id))).size!==items.length) fail('Select each ticket type once, up to 50 types.');
      for (const item of [...items].sort((a,b)=>a.ticket_type_id-b.ticket_type_id)) {
        const [rows] = await conn.query('SELECT * FROM ticket_types WHERE id = ? AND event_id = ? LIMIT 1 FOR UPDATE', [
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
        if (!Number.isInteger(qty) || qty < tt.min_per_order || qty > tt.max_per_order) {
          const err = new Error(`Choose between ${tt.min_per_order} and ${tt.max_per_order} tickets for "${tt.name}".`);
          err.statusCode = 400;
          throw err;
        }
        const saleStatus=availability(eventRows[0],tt);
        if(saleStatus!=='on_sale') fail(`"${tt.name}" is not available for booking (${saleStatus.replace('_',' ')}).`,409);
        const reserved = await TicketType.reserve(tt.id, qty, conn);
        if (!reserved) {
          const err = new Error(`Not enough tickets available for "${tt.name}"`);
          err.statusCode = 409;
          throw err;
        }
        total += wallet.minorUnits(tt.price) * qty;
        resolvedItems.push({ ticketType: tt, qty });
      }

      // Paid checkout holds stock; tickets and credit wait for verified capture.
      const pending = Boolean(payment && total > 0);
      if (pending && (!gateway.key_id || !gateway.key_secret || !gateway.webhook_secret)) fail('Online booking payments are not configured yet. Please contact the organizer.',503);
      const method = payment ? (pending ? 'razorpay_'+(gateway.key_id.startsWith('rzp_live_')?'live':'test') : 'free') : 'mock';
      // 3. Create order
      const bookingRef = generateBookingRef();
      const [orderResult] = await conn.query(
        `INSERT INTO orders (event_id, booking_ref, customer_name, email, phone, total_amount, status, payment_method, checkout_request_hash, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [event_id, bookingRef, customer_name, email, phone || null, wallet.decimal(total), pending ? 'pending' : 'paid', method, payment?.request_hash || null, payment ? 'INR' : 'USD']
      );
      const orderId = orderResult.insertId;
      if (pending) await require('../services/bookingPayments').register(conn, { ...payment, event_id, order_id:orderId, amount_minor:total, currency:'INR', gateway });
      else await wallet.credit(conn, orderId);

      // 4. Issue tickets
      const tickets = [];
      for (const { ticketType, qty } of resolvedItems) {
        const template = ticketType.template_id ? await Studio.template(ticketType.template_id, conn) : null;
        const design = { ...(template?.active && template.kind === 'ticket' ? template.config : defaultTicketDesign), type_name: ticketType.name, price: ticketType.price, currency:payment?'INR':'USD' };
        const emailSnapshot=await require('../services/ticketEmails').snapshot(ticketType,conn);
        const people = attendees ? await require('../services/attendees').save(conn,orderId,ticketType.id,attendees.get(ticketType.id),ticketForms.get(ticketType.id)) : null;
        if (pending) {
          await conn.query('INSERT INTO booking_reserved_items(order_id,ticket_type_id,qty,design_json,email_snapshot) VALUES (?,?,?,?,?)',[orderId,ticketType.id,qty,JSON.stringify(design),JSON.stringify(emailSnapshot)]);
          continue;
        }
        for (let i = 0; i < qty; i++) {
          const ticket = await Ticket.create(
            {
              order_id: orderId,
              ticket_type_id: ticketType.id,
              attendee_name: people ? people[i].name : customer_name,
              attendee_id: people ? people[i].id : null,
              design_snapshot: design,
              email_snapshot: emailSnapshot,
            },
            conn
          );
          tickets.push(ticket);
        }
      }

      if (!perAttendee) await forms.snapshot(conn,orderId,registrationForm,answers,registration_files);
      if (!pending) await enqueue(conn, orderId, 'booking_confirmed');
      await conn.commit();

      const order = await this.findById(orderId);
      return { order, tickets: await Ticket.findByOrderId(orderId) };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async findAll({ status, event_id, search, booking_group, limit = 50, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (booking_group === 'real') where.push("payment_method NOT IN ('mock','razorpay_test')");
    if (booking_group === 'test') where.push("payment_method IN ('mock','razorpay_test')");
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

  async countAll({ status, event_id, search, booking_group } = {}) {
    const where = [];
    const params = [];
    if (booking_group === 'real') where.push("payment_method NOT IN ('mock','razorpay_test')");
    if (booking_group === 'test') where.push("payment_method IN ('mock','razorpay_test')");
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
      if (!['cancelled','refunded'].includes(newStatus)) fail('Invalid order status.');

      const [[eventOwner]]=await conn.query('SELECT event_id FROM orders WHERE id=?',[id]);
      if(eventOwner) await conn.query('SELECT id FROM events WHERE id=? FOR UPDATE',[eventOwner.event_id]);
      const [[order]] = await conn.query('SELECT * FROM orders WHERE id=? FOR UPDATE', [id]);
      if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }
      if (order.payment_method.startsWith('razorpay_')) fail('Use the payment refund flow for gateway bookings.',409);
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

      if (order.status === 'paid') await wallet.reverse(conn, id, newStatus);

      // 3. Update order status
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, id]);
      await enqueue(conn, id, newStatus === 'refunded' ? 'booking_refunded' : 'booking_cancelled');

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
