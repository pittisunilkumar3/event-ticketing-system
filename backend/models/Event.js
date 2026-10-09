const db = require('../config/db');

const Event = {
  async create({ title, slug, description, category, venue, city, banner_image, start_datetime, end_datetime, status }) {
    const [result] = await db.query(
      `INSERT INTO events (title, slug, description, category, venue, city, banner_image, start_datetime, end_datetime, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, description || null, category || null, venue || null, city || null, banner_image || null, start_datetime, end_datetime || null, status || 'draft']
    );
    return this.findById(result.insertId);
  },

  async findAll({ status, category, city, search, limit = 50, offset = 0 } = {}) {
    const where = [];
    const params = [];

    if (status) {
      where.push('e.status = ?');
      params.push(status);
    }
    if (category) {
      where.push('e.category = ?');
      params.push(category);
    }
    if (city) {
      where.push('e.city = ?');
      params.push(city);
    }
    if (search) {
      where.push('(e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limitSql = `LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM ticket_types tt WHERE tt.event_id = e.id) AS ticket_type_count,
              (SELECT MIN(tt.price) FROM ticket_types tt WHERE tt.event_id = e.id) AS min_price,
              (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.event_id = e.id AND o.status = 'paid') AS revenue
       FROM events e ${whereSql}
       ORDER BY e.start_datetime DESC
       ${limitSql}`,
      params
    );
    return rows;
  },

  async countAll({ status, category, city, search } = {}) {
    const where = [];
    const params = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (city) {
      where.push('city = ?');
      params.push(city);
    }
    if (search) {
      where.push('(title LIKE ? OR description LIKE ? OR venue LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(`SELECT COUNT(*) AS total FROM events ${whereSql}`, params);
    return rows[0].total;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findBySlug(slug) {
    const [rows] = await db.query('SELECT * FROM events WHERE slug = ? LIMIT 1', [slug]);
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = ['title', 'slug', 'description', 'category', 'venue', 'city', 'banner_image', 'start_datetime', 'end_datetime', 'status'];
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
    await db.query(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await db.query('DELETE FROM events WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async setSoldCounts(id) {
    // helper: recompute nothing here; sold lives on ticket_types
    return true;
  },

  async distinctFilters() {
    const [categories] = await db.query("SELECT DISTINCT category FROM events WHERE category IS NOT NULL AND status = 'published' ORDER BY category");
    const [cities] = await db.query("SELECT DISTINCT city FROM events WHERE city IS NOT NULL AND status = 'published' ORDER BY city");
    return { categories: categories.map((r) => r.category), cities: cities.map((r) => r.city) };
  },
};

module.exports = Event;
