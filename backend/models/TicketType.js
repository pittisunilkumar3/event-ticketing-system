const db = require('../config/db');

const TicketType = {
  async create({ event_id, name, description, price, quantity, sales_start, sales_end, template_id, email_template_id=null, submission_url=null, guidelines_url=null, is_active = true, min_per_order = 1, max_per_order = 10, sort_order = 0 }) {
    const [result] = await db.query(
      `INSERT INTO ticket_types (event_id, name, description, price, quantity, sales_start, sales_end, template_id, email_template_id, submission_url, guidelines_url, is_active, min_per_order, max_per_order, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event_id, name, description || null, price, quantity, sales_start || null, sales_end || null, template_id || null, email_template_id, submission_url, guidelines_url, is_active, min_per_order, max_per_order, sort_order]
    );
    return this.findById(result.insertId);
  },

  async findByEventId(eventId) {
    const [rows] = await db.query('SELECT * FROM ticket_types WHERE event_id = ? ORDER BY archived_at IS NOT NULL, sort_order, price, id', [eventId]);
    return rows;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM ticket_types WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = ['name', 'description', 'price', 'quantity', 'sales_start', 'sales_end', 'template_id','email_template_id','submission_url','guidelines_url','is_active','min_per_order','max_per_order','sort_order'];
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
    const [result] = await db.query(`UPDATE ticket_types SET ${sets.join(', ')} WHERE id = ? AND ? >= sold`, [...params, fields.quantity ?? 2147483647]);
    if (!result.affectedRows) {
      const error = new Error('Ticket sales changed. Reload and keep capacity at least as high as tickets sold.');
      error.status = 409;
      error.statusCode = 409;
      throw error;
    }
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await db.query("UPDATE ticket_types SET archived_at=NOW(),is_active=0 WHERE id=?", [id]);
    return result.affectedRows > 0;
  },

  /** Atomically reserve inventory: increases sold if enough available. */
  async reserve(id, qty, connection = db) {
    const [result] = await connection.query(
      `UPDATE ticket_types
       SET sold = sold + ?
       WHERE id = ? AND is_active=1 AND archived_at IS NULL AND (sold + ?) <= quantity`,
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
