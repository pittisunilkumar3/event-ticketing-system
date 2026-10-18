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
    const conn=await db.getConnection();
    let id;
    try {
      await conn.beginTransaction();
      const [result]=await conn.query('INSERT INTO admins (name,email,password_hash,role) VALUES (?,?,?,?)',[name,email,passwordHash,role]);
      id=result.insertId;
      await require('../saas/loginDirectory').sync(conn,id,email);
      await conn.commit();
    } catch(error) { await conn.rollback(); throw error; } finally { conn.release(); }
    return this.findById(id);
  },

  async updatePassword(id, passwordHash) {
    await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    return this.findById(id);
  },

  async updateProfile(id, { name, email }) {
    const conn=await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE admins SET name = ?, email = ? WHERE id = ?', [name,email,id]);
      await require('../saas/loginDirectory').sync(conn,id,email);
      await conn.commit();
    } catch(error) { await conn.rollback(); throw error; } finally { conn.release(); }
    return this.findById(id);
  },

  async remove(id, actorId) {
    const conn=await db.getConnection();
    try {
      await conn.beginTransaction();
      // Serialize access changes and recheck the actor after taking the lock.
      const [members]=await conn.query('SELECT id,role FROM admins ORDER BY id FOR UPDATE');
      const fail=require('../services/studioValidation').fail;
      if(!members.some(member=>Number(member.id)===Number(actorId)&&member.role==='super_admin')) fail('Owner access is required.',403);
      const target=members.find(member=>Number(member.id)===Number(id));
      if(!target)fail('Team member not found.',404);
      if(Number(id)===Number(actorId))fail('You cannot remove your own account.');
      if(target.role==='super_admin'&&members.filter(member=>member.role==='super_admin').length<=1)fail('Keep at least one owner in this organization.');
      await conn.query('DELETE FROM admins WHERE id=?',[id]);
      await require('../saas/loginDirectory').remove(conn,id);
      await conn.commit();
    } catch(error) { await conn.rollback(); throw error; } finally { conn.release(); }
  },
};

module.exports = Admin;
