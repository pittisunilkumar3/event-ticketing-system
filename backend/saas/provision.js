const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const db = require('../config/db');
const { fail, string, emailAddress } = require('../services/studioValidation');
const sqlName = value => {
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(value)) throw new Error('Invalid database identifier');
  return '`' + value + '`';
};
async function migrateTenant(name) {
  const connection = await mysql.createConnection({ ...db.options, multipleStatements: true });
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${sqlName(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${sqlName(name)}`);
    await connection.query('CREATE TABLE IF NOT EXISTS migrations (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    const [rows] = await connection.query('SELECT name FROM migrations');
    const applied = new Set(rows.map(row => row.name));
    const directory = path.join(__dirname, '../migrations');
    for (const file of (await fs.readdir(directory)).filter(f => f.endsWith('.sql')).sort()) {
      if (applied.has(file)) continue;
      await connection.query(await fs.readFile(path.join(directory, file), 'utf8'));
      await connection.query('INSERT INTO migrations(name) VALUES (?)', [file]);
    }
  } finally { await connection.end(); }
}
async function migratePlatform() {
  const connection = await mysql.createConnection({ ...db.options, database: db.database, multipleStatements: true });
  try {
    await connection.query(await fs.readFile(path.join(__dirname, 'migrations/001_platform.sql'), 'utf8'));

    await connection.query("INSERT IGNORE INTO organizations(name,slug,db_name,owner_email,status,is_legacy) VALUES ('Existing workspace','legacy',?,'','active',TRUE)", [db.database]);
    await connection.query(await fs.readFile(path.join(__dirname, 'migrations/002_platform_mail.sql'), 'utf8'));
    await connection.query(await fs.readFile(path.join(__dirname, 'migrations/003_booking_payments.sql'), 'utf8'));
    await connection.query(await fs.readFile(path.join(__dirname, 'migrations/004_payouts.sql'), 'utf8'));
    await require('./platformMail').initialize(connection);
    await require('./website').initialize(connection);
    const [[count]] = await connection.query('SELECT COUNT(*) n FROM event_packages');
    if (!count.n) await connection.query("INSERT INTO event_packages(name,event_count) VALUES ('Starter',3),('Growth',10),('Business',25)");
  } finally { await connection.end(); }
}
function siteUrl(org) {
  const origin = (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
  if (org.is_legacy) return origin;
  if (process.env.BASE_DOMAIN) return `https://${org.slug}.${process.env.BASE_DOMAIN}`;
  return `${origin}/o/${org.slug}`;
}
async function signup(input) {
  const name = string(input.company_name, 'Business name', 120, true);
  const ownerName = string(input.name, 'Your name', 100, true);
  const email = emailAddress(input.email, true).toLowerCase();
  const slug = String(input.slug || '').toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(slug) || ['admin','api','www','app','legacy','superadmin','platform','uploads'].includes(slug)) fail('Choose a site address of 3–40 letters, numbers or hyphens, starting with a letter.');
  if (typeof input.password !== 'string' || input.password.length < 12 || Buffer.byteLength(input.password) > 72) fail('Use a password of at least 12 characters and at most 72 bytes.');
  const dbName = `tf_${crypto.randomBytes(12).toString('hex')}`;
  const [result] = await db.platform.query('INSERT INTO organizations(name,slug,db_name,owner_email) VALUES (?,?,?,?)', [name,slug,dbName,email]);
  const org = { id:result.insertId, name, slug, db_name:dbName, is_legacy:false };
  try {
    await migrateTenant(dbName);
    await db.run(org, async () => {
      await require('../models/Admin').create({ name:ownerName,email,passwordHash:await bcrypt.hash(input.password,12),role:'super_admin' });
      const Studio = require('../models/Studio');
      await Studio.saveSetting('brand', { ...require('../services/studioDefaults').brand,company_name:name,site_title:name,tagline:'Events worth being there for',site_url:siteUrl(org),support_email:email });
      await Studio.initialize();
    });
    const conn=await db.platform.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("UPDATE organizations SET status='active' WHERE id=?",[org.id]);
      const values={organization_name:name,owner_name:ownerName,owner_email:email,workspace_url:siteUrl(org)+'/admin',site_url:siteUrl(org)};
      await require('./platformMail').enqueue(conn,'organization_welcome',org.id,email,values,'signup:'+org.id);
      await require('./platformMail').enqueue(conn,'registration_alert',org.id,null,values,'signup:'+org.id);
      await conn.commit();
    } catch(e) { await conn.rollback();throw e; } finally { conn.release(); }
    return { id:org.id,name,slug,site_url:siteUrl(org) };
  } catch (error) {
    await db.platform.query("UPDATE organizations SET status='failed' WHERE id=?",[org.id]);
    throw error;
  }
}
module.exports = { migrateTenant, migratePlatform, signup, sqlName, siteUrl };
