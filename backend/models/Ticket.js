const crypto = require('crypto');
const db = require('../config/db');

function generateTicketCode() {
  // e.g. EVT-7K2M-9FQX-4RT8
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase().replace(/[O0]/g, 'X');
  return `TCK-${seg()}-${seg()}-${seg()}`;
}

const Ticket = {
  async create({ order_id, ticket_type_id, attendee_name, attendee_id=null, design_snapshot, email_snapshot=null }, connection = db) {
    let code;
    let attempts = 0;
    // Retry in the rare case of a code collision
    while (attempts < 5) {
      try {
        code = generateTicketCode();
        const [result] = await connection.query(
          'INSERT INTO tickets (order_id, ticket_type_id, ticket_code, attendee_name, attendee_id, design_snapshot, email_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [order_id, ticket_type_id, code, attendee_name || null, attendee_id, design_snapshot ? JSON.stringify(design_snapshot) : null, email_snapshot?JSON.stringify(email_snapshot):null]
        );
        const [rows] = await connection.query('SELECT * FROM tickets WHERE id = ?', [result.insertId]);
        return {...rows[0],email_snapshot:undefined};
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
      `SELECT t.*, tt.name AS type_name, tt.price, a.email AS attendee_email,a.phone AS attendee_phone,a.answers_json AS attendee_answers_json
       FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id
       LEFT JOIN order_attendees a ON a.id=t.attendee_id AND a.order_id=t.order_id
       WHERE t.order_id = ? ORDER BY t.id`,
      [orderId]
    );
    return rows.map(row => ({ ...row, attendee_answers:row.attendee_answers_json?JSON.parse(row.attendee_answers_json):[],attendee_answers_json:undefined, design: row.design_snapshot ? JSON.parse(row.design_snapshot) : require('../services/studioDefaults').ticket, design_snapshot: undefined,email_snapshot:undefined }));
  },

  async findByCode(code, connection = db) {
    const [rows] = await connection.query(
      `SELECT t.*, tt.name AS type_name, tt.price, o.booking_ref, o.customer_name, o.email, o.status AS order_status,
              e.title AS event_title, e.venue, e.city, e.start_datetime AS event_start,
              a.email AS attendee_email,a.phone AS attendee_phone,a.answers_json AS attendee_answers_json
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       LEFT JOIN order_attendees a ON a.id=t.attendee_id AND a.order_id=t.order_id
       JOIN orders o ON o.id = t.order_id
       JOIN events e ON e.id = o.event_id
       WHERE o.archived_at IS NULL AND t.ticket_code = ? LIMIT 1`,
      [code]
    );
    if (!rows[0]) return null;
    const {attendee_answers_json,...ticket}=rows[0];
    return {...ticket,email_snapshot:undefined,attendee_answers:attendee_answers_json?JSON.parse(attendee_answers_json):[]};
  },

  async checkIn(code, connection = db) {
    const [result] = await connection.query(
      `UPDATE tickets t JOIN orders o ON o.id=t.order_id
       SET t.status = 'checked_in', t.checked_in_at = NOW()
       WHERE o.archived_at IS NULL AND t.ticket_code = ? AND t.status = 'valid' AND o.status = 'paid'`,
      [code]
    );
    return result.affectedRows > 0;
  },

  async countByStatus(eventId = null) {
    const params = [];
    let sql = `SELECT t.status, COUNT(*) AS count FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.archived_at IS NULL`;
    if (eventId) {
      sql += ` AND t.ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id = ?)`;
      params.push(eventId);
    }
    sql += ' GROUP BY t.status';
    const [rows] = await db.query(sql, params);
    return rows;
  },
};

module.exports = Ticket;
