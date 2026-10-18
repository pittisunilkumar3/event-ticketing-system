const db = require('../config/db');
const { sqlName } = require('./provision');
const table = () => `${sqlName(db.database)}.organizer_login_directory`;

async function organizationId(conn) {
  if (db.current()) return db.current().id;
  const [[org]] = await conn.query(`SELECT id FROM ${sqlName(db.database)}.organizations WHERE is_legacy=TRUE LIMIT 1`);
  return org?.id;
}
async function sync(conn, adminId, email) {
  const orgId = await organizationId(conn);
  if (!orgId) throw new Error('Run the SaaS migrations before creating organizer accounts.');
  await conn.query(`INSERT INTO ${table()} (organization_id,admin_id,email) VALUES (?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email)`, [orgId,adminId,email.toLowerCase().trim()]);
}
async function remove(conn, adminId) {
  await conn.query(`DELETE FROM ${table()} WHERE organization_id=? AND admin_id=?`, [await organizationId(conn),adminId]);
}
async function backfill() {
  const [organizations] = await db.platform.query("SELECT * FROM organizations WHERE status IN ('active','suspended')");
  for (const org of organizations) {
    await db.platform.query(`INSERT INTO ${table()} (organization_id,admin_id,email) SELECT ?,id,LOWER(TRIM(email)) FROM ${sqlName(org.db_name)}.admins ON DUPLICATE KEY UPDATE email=VALUES(email)`,[org.id]);
  }
}
module.exports={sync,remove,backfill};
