const db = require('../config/db');
const defaults = require('../services/studioDefaults');
const ticketLayouts = require('../services/ticketLayouts');
const parse = row => row && ({ ...row, active: Boolean(row.active), config: JSON.parse(row.config_json), config_json: undefined });
const Studio = {
  async ensureEmailTemplate(key, conn=db) {
    const e=defaults.emailEvents.find(item=>item.key===key);
    if(!e)throw new Error('Unknown email event');
    await conn.query('INSERT IGNORE INTO design_templates (kind,name,event_key,config_json) VALUES (?,?,?,?)',
      ['email',e.name,e.key,JSON.stringify({...defaults.email,title:e.title,body:e.body,subject:`${e.name}: {{booking_ref}}`,...e.config})]);
  },
  async initialize() {
    for (const [key, value] of [['brand', defaults.brand], ['smtp', defaults.smtp]]) {
      await db.query('INSERT IGNORE INTO system_settings (setting_key,value_json) VALUES (?,?)', [key, JSON.stringify(value)]);
    }
    for (const e of defaults.emailEvents) await this.ensureEmailTemplate(e.key);
    const brand=await this.getSetting('brand');
    await db.query(
      'INSERT IGNORE INTO design_templates (kind,name,event_key,config_json) VALUES ?',
      [ticketLayouts.map(({id, name, config}) =>
        ['ticket', name, `ticket_${id}`, JSON.stringify({...defaults.ticket, ...config, ...(db.current() && !db.current().is_legacy ? {brand:brand.company_name,logo:brand.logo} : {})})]
      )]
    );
    for (const [slug,title] of defaults.pages) await db.query('INSERT IGNORE INTO content_pages (slug,title,body) VALUES (?,?,?)', [slug,title,'']);
  },
  async getSetting(key, conn = db) {
    const [rows] = await conn.query('SELECT value_json FROM system_settings WHERE setting_key=?', [key]);
    const value = rows.length ? JSON.parse(rows[0].value_json) : defaults[key];
    return key === 'brand' ? {...defaults.brand, ...value} : value;
  },
  async saveSetting(key, value) {
    await db.query('INSERT INTO system_settings (setting_key,value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)', [key,JSON.stringify(value)]);
  },
  async templates(kind) {
    const [rows] = await db.query('SELECT * FROM design_templates WHERE kind=? ORDER BY id', [kind]); return rows.map(parse);
  },
  async template(id, conn = db) {
    const [rows] = await conn.query('SELECT * FROM design_templates WHERE id=?', [id]); return parse(rows[0]);
  },
  async saveTemplate({ id, kind, name, active, config }) {
    if (id) await db.query('UPDATE design_templates SET name=?,active=?,config_json=? WHERE id=? AND kind=?', [name,active,JSON.stringify(config),id,kind]);
    else {
      const [r] = await db.query('INSERT INTO design_templates (kind,name,config_json,active) VALUES (?,?,?,?)', [kind,name,JSON.stringify(config),active]); id = r.insertId;
    }
    return this.template(id);
  },
  async pages(publishedOnly = false) {
    const [rows] = await db.query(`SELECT * FROM content_pages ${publishedOnly ? 'WHERE published=1' : ''} ORDER BY slug`);
    return rows.map(row => ({ ...row, published: Boolean(row.published) }));
  },
};
module.exports = Studio;
