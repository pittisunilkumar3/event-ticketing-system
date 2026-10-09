require('dotenv').config();
const mysql = require('mysql2/promise');

// Connection pool (XAMPP MySQL / MariaDB)
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ticketing_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // return DATETIME as strings to avoid TZ issues
});

// Test connection on startup
pool
  .getConnection()
  .then((conn) => {
    console.log(`✅ MySQL connected: ${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    conn.release();
  })
  .catch((err) => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   👉 Make sure XAMPP > MySQL is running.');
  });

module.exports = pool;
