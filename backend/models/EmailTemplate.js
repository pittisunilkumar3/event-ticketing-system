const db = require('../config/db');

/**
 * Email templates — mirrors the hostel reference project's
 * emailTemplateService.ts + emailTemplateDefaults.ts.
 * Rows are auto-seeded when missing so the admin panel always has
 * content for every tab.
 */
const EmailTemplate = {
  async getAll() {
    const [rows] = await db.query('SELECT * FROM email_templates ORDER BY template_type ASC, email_type ASC');
    return rows;
  },

  async getByType(templateType) {
    const [rows] = await db.query(
      'SELECT * FROM email_templates WHERE template_type = ? ORDER BY email_type ASC',
      [templateType]
    );
    return rows;
  },

  async getByEmailType(emailType, templateType) {
    const [rows] = await db.query(
      'SELECT * FROM email_templates WHERE email_type = ? AND template_type = ? LIMIT 1',
      [emailType, templateType]
    );
    return rows[0] || null;
  },

  async getById(id) {
    const [rows] = await db.query('SELECT * FROM email_templates WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const [result] = await db.query(
      `INSERT INTO email_templates
        (title, body, body_2, icon, logo, banner_image, button_name, button_url, footer_text, copyright_text,
         email_type, template_type, email_template, privacy, refund, cancelation, contact,
         facebook, instagram, twitter, linkedin, pinterest, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.title || null, data.body || null, data.body_2 || null, data.icon || null, data.logo || null,
        data.banner_image || null, data.button_name || null, data.button_url || null,
        data.footer_text || null, data.copyright_text || null,
        data.email_type, data.template_type || 'user', data.email_template || '5',
        data.privacy || 0, data.refund || 0, data.cancelation || 0, data.contact || 0,
        data.facebook || 0, data.instagram || 0, data.twitter || 0, data.linkedin || 0, data.pinterest || 0,
        data.status === undefined ? 1 : data.status,
      ]
    );
    return this.getById(result.insertId);
  },

  async update(id, data) {
    const fields = [];
    const params = [];
    const ALLOWED = ['title', 'body', 'body_2', 'icon', 'logo', 'banner_image', 'button_name', 'button_url',
      'footer_text', 'copyright_text', 'email_template', 'privacy', 'refund', 'cancelation', 'contact',
      'facebook', 'instagram', 'twitter', 'linkedin', 'pinterest', 'status'];
    for (const key of ALLOWED) {
      if (data[key] !== undefined) {
        fields.push(`\`${key}\` = ?`);
        params.push(data[key]);
      }
    }
    if (!fields.length) return this.getById(id);
    params.push(id);
    await db.query(`UPDATE email_templates SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getById(id);
  },

  async toggleStatus(id, isActive) {
    await db.query('UPDATE email_templates SET status = ? WHERE id = ?', [isActive ? 1 : 0, id]);
    return this.getById(id);
  },

  /** Auto-seed any missing templates (INSERT IGNORE semantics) so every tab has content. */
  async seedMissing(templateType) {
    const { DEFAULT_TEMPLATES } = require('../services/emailTemplateDefaults');
    for (const tpl of DEFAULT_TEMPLATES) {
      if (templateType && tpl.template_type !== templateType) continue;
      const existing = await db.query(
        'SELECT id FROM email_templates WHERE email_type = ? AND template_type = ? LIMIT 1',
        [tpl.email_type, tpl.template_type]
      );
      if (existing[0].length === 0) {
        await this.create(tpl);
      }
    }
  },
};

module.exports = EmailTemplate;
