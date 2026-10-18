const fs = require('node:fs');
const credentials = JSON.parse(fs.readFileSync('/root/ticketflow-superadmin-credentials.json', 'utf8'));
process.env.PLATFORM_ADMIN_EMAIL = credentials.email;
process.env.PLATFORM_ADMIN_PASSWORD = credentials.password;
require('/opt/ticketflow/app/backend/saas/create-admin');
