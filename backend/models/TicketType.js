const db = require('../config/db');

const TicketType = {
  async create({ event_id, name, description, price, quantity, sales_start, sales_end, template_id }) {
    const [result] = await db.query(
      `INSERT INTO ticket_types (event_id, name, description, price, quantity, sales_start, sales_end, template_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [event_id, name, description || null, price, quantity, sales_start || null, sales_end || null, template_id || null]
    );
    return this.findById(result.insertId);
  },

  async findByEventId(eventId) {
    const [rows] = await db.query('SELECT * FROM ticket_types WHERE event_id = ? ORDER BY price DESC', [eventId]);
    return rows;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM ticket_types WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = ['name', 'description', 'price', 'quantity', 'sales_start', 'sales_end', 'template_id'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(fields[key]);
      }
    }
    if (!sets.length) return this.findById(id);
    params.push(id);
    await db.query(`UPDATE ticket_types SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await db.query('DELETE FROM ticket_types WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  /** Atomically reserve inventory: increases sold if enough available. */
  async reserve(id, qty, connection = db) {
    const [result] = await connection.query(
      `UPDATE ticket_types
       SET sold = sold + ?
       WHERE id = ? AND (sold + ?) <= quantity`,
      [qty, id, qty]
    );
    return result.affectedRows > 0;
  },

  /** Release inventory back (on cancel/refund). */
  async release(id, qty, connection = db) {
    const [result] = await connection.query(
      'UPDATE ticket_types SET sold = GREATEST(sold - ?, 0) WHERE id = ?',
      [qty, id]
    );
    return result.affectedRows > 0;
  },
};

module.exports = TicketType;
