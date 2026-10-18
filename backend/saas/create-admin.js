require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
(async()=>{
 const email=process.env.PLATFORM_ADMIN_EMAIL;
 const password=process.env.PLATFORM_ADMIN_PASSWORD;
 if(!email || !password || password.length<12 || Buffer.byteLength(password)>72) throw new Error('Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD (12+ characters, up to 72 bytes).');
 await db.platform.query('INSERT INTO platform_admins(name,email,password_hash) VALUES (?,?,?)',['Platform owner',email.toLowerCase(),await bcrypt.hash(password,12)]);
 console.log('Platform administrator created.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.end());
