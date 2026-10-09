const crypto = require('crypto');
const db = require('../config/db');

function generateTicketCode() {
  // e.g. EVT-7K2M-9FQX-4RT8
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase().replace(/[O0]/g, 'X');
  return `TCK-${seg()}-${seg()}-${seg()}`;
}

const Ticket = {
  async create({ order_id, ticket_type_id, attendee_name, design_snapshot }, connection = db) {
    let code;
    let attempts = 0;
    // Retry in the rare case of a code collision
    while (attempts < 5) {
      try {
        code = generateTicketCode();
        const [result] = await connection.query(
          'INSERT INTO tickets (order_id, ticket_type_id, ticket_code, attendee_name, design_snapshot) VALUES (?, ?, ?, ?, ?)',
          [order_id, ticket_type_id, code, attendee_name || null, design_snapshot ? JSON.stringify(design_snapshot) : null]
        );
        const [rows] = await connection.query('SELECT * FROM tickets WHERE id = ?', [result.insertId]);
        return rows[0];
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          attempts++;
          continue;
        }
        throw err;
      }
    }
    throw new Error('Could not generate unique ticket code');
  },

  async findByOrderId(orderId, connection = db) {
    const [rows] = await connection.query(
      `SELECT t.*, tt.name AS type_name, tt.price
       FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id
       WHERE t.order_id = ? ORDER BY t.id`,
      [orderId]
    );
    return rows.map(row => ({ ...row, design: row.design_snapshot ? JSON.parse(row.design_snapshot) : require('../services/studioDefaults').ticket, design_snapshot: undefined }));
  },

  async findByCode(code, connection = db) {
    const [rows] = await connection.query(
      `SELECT t.*, tt.name AS type_name, tt.price, o.booking_ref, o.customer_name, o.email, o.status AS order_status,
              e.title AS event_title, e.venue, e.city, e.start_datetime AS event_start
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN orders o ON o.id = t.order_id
       JOIN events e ON e.id = o.event_id
       WHERE t.ticket_code = ? LIMIT 1`,
      [code]
    );
    return rows[0] || null;
  },

  async checkIn(code, connection = db) {
    const [result] = await connection.query(
      `UPDATE tickets SET status = 'checked_in', checked_in_at = NOW()
       WHERE ticket_code = ? AND status = 'valid'`,
      [code]
    );
    return result.affectedRows > 0;
  },

  async countByStatus(eventId = null) {
    const params = [];
    let sql = `SELECT status, COUNT(*) AS count FROM tickets`;
    if (eventId) {
      sql += ` WHERE ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id = ?)`;
      params.push(eventId);
    }
    sql += ' GROUP BY status';
    const [rows] = await db.query(sql, params);
    return rows;
  },
};

module.exports = Ticket;
