const db = require('../config/db');

const Event = {
  async create(fields) {
    const keys = ['title','slug','description','category','venue','city','banner_image','start_datetime','end_datetime','status','summary','address','organizer_name','organizer_email','age_policy','highlights','entry_instructions','schedule_text','page_theme'];
    const conn=await db.getConnection();
    try {
      await conn.beginTransaction();
      const credits=require('../saas/credits');
      const org=await credits.lockOrganization(conn);
      await credits.requirePackage(conn,org);
      const [result]=await conn.query(`INSERT INTO events (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,keys.map(key=>fields[key] ?? (key==='page_theme'?'classic':null)));
      if(fields.status==='published') await credits.consume(conn,org,{id:result.insertId,title:fields.title});
      await conn.commit();
      return this.findById(result.insertId);
    } catch(e){await conn.rollback();throw e;} finally{conn.release();}
  },

  async findAll({ status, category, city, search, limit = 50, offset = 0, archived = false } = {}) {
    const where = [archived ? 'e.archived_at IS NOT NULL' : 'e.archived_at IS NULL'];
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
              (SELECT COUNT(*) FROM ticket_types tt WHERE tt.event_id = e.id AND tt.archived_at IS NULL) AS ticket_type_count,
              (SELECT COALESCE(SUM(tt.quantity),0) FROM ticket_types tt WHERE tt.event_id=e.id AND tt.archived_at IS NULL) AS capacity,
              (SELECT COALESCE(SUM(tt.sold),0) FROM ticket_types tt WHERE tt.event_id=e.id) AS tickets_sold,
              (SELECT MIN(tt.price) FROM ticket_types tt WHERE tt.event_id = e.id AND tt.is_active=1 AND tt.archived_at IS NULL) AS min_price,
              (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.event_id = e.id AND o.status = 'paid' AND o.archived_at IS NULL AND o.currency='INR') AS revenue
       FROM events e ${whereSql}
       ORDER BY e.start_datetime DESC
       ${limitSql}`,
      params
    );
    return rows;
  },

  async countAll({ status, category, city, search, archived = false } = {}) {
    const where = [archived ? 'archived_at IS NOT NULL' : 'archived_at IS NULL'];
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
    const allowed = ['title', 'slug', 'description', 'category', 'venue', 'city', 'banner_image', 'start_datetime', 'end_datetime', 'status','summary','address','organizer_name','organizer_email','age_policy','highlights','entry_instructions','schedule_text','page_theme'];
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
    const conn=await db.getConnection();
    try {
      await conn.beginTransaction();
      const credits=require('../saas/credits');
      const org=await credits.lockOrganization(conn);
      const [[event]]=await conn.query('SELECT * FROM events WHERE id=? FOR UPDATE',[id]);
      if(!event) require('../services/studioValidation').fail('Event not found.',404);
      if(event.credit_consumed && new Date(event.end_datetime || event.start_datetime)<new Date() &&
        (fields.start_datetime && fields.start_datetime!==event.start_datetime || fields.end_datetime && fields.end_datetime!==event.end_datetime))
        require('../services/studioValidation').fail('This event has ended. Duplicate it to schedule another occurrence.',409);
      if(fields.status==='published') await credits.consume(conn,org,event);
      await conn.query(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`,params);
      await conn.commit();
      return this.findById(id);
    } catch(e){await conn.rollback();throw e;} finally{conn.release();}
  },

  async remove(id) {
    const [result] = await db.query("UPDATE events SET archived_at=NOW(),status='draft' WHERE id=?", [id]);
    return result.affectedRows > 0;
  },

  async restore(id) {
    await db.query("UPDATE events SET archived_at=NULL,status='draft' WHERE id=?",[id]);
    return this.findById(id);
  },
  async summary(id) {
    const [rows] = await db.query("SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN status='paid' AND currency='INR' THEN total_amount ELSE 0 END),0) AS revenue FROM orders WHERE archived_at IS NULL AND event_id=?",[id]);
    const [recentOrders] = await db.query('SELECT id,booking_ref,customer_name,total_amount,status,created_at FROM orders WHERE archived_at IS NULL AND event_id=? ORDER BY id DESC LIMIT 8',[id]);
    return {...rows[0],recentOrders};
  },
  async setSoldCounts(id) {
    // helper: recompute nothing here; sold lives on ticket_types
    return true;
  },

  async distinctFilters() {
    const [categories] = await db.query("SELECT DISTINCT category FROM events WHERE category IS NOT NULL AND status = 'published' AND archived_at IS NULL ORDER BY category");
    const [cities] = await db.query("SELECT DISTINCT city FROM events WHERE city IS NOT NULL AND status = 'published' AND archived_at IS NULL ORDER BY city");
    return { categories: categories.map((r) => r.category), cities: cities.map((r) => r.city) };
  },
};

module.exports = Event;
