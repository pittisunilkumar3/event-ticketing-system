require('dotenv').config();
const db = require('../config/db');
const {migrateTenant,migratePlatform} = require('./provision');
(async () => {
  await migrateTenant(db.database);
  await migratePlatform();
  const [orgs] = await db.platform.query('SELECT * FROM organizations WHERE is_legacy=FALSE AND status IN (\'active\',\'suspended\')');
  for (const org of orgs) await migrateTenant(org.db_name);
  await require('./loginDirectory').backfill();
  console.log('SaaS and organizer migrations complete.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.end());
