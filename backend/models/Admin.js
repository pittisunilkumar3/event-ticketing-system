const db = require('../config/db');

const Admin = {
  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM admins WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query(
      'SELECT id, name, email, role, created_at, updated_at FROM admins WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  async create({ name, email, passwordHash, role = 'staff' }) {
    const [result] = await db.query(
      'INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );
    return this.findById(result.insertId);
  },

  async updatePassword(id, passwordHash) {
    await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    return this.findById(id);
  },

  async updateProfile(id, { name, email }) {
    await db.query('UPDATE admins SET name = ?, email = ? WHERE id = ?', [name, email, id]);
    return this.findById(id);
  },
};

module.exports = Admin;
