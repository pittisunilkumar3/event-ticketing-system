require('dotenv').config();
const mysql = require('mysql2/promise');
const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();
const database = process.env.DB_NAME || 'ticketing_db';
const options = {
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  waitForConnections: true, connectionLimit: 5, maxIdle: 2, idleTimeout: 60000,
  queueLimit: 100, dateStrings: true,
};
const pools = new Map();
function poolFor(name) {
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(name)) throw new Error('Invalid database name');
  if (!pools.has(name)) pools.set(name, mysql.createPool({ ...options, database: name }));
  return pools.get(name);
}
const platform = poolFor(database);
function current() { return context.getStore(); }
function pool() { return poolFor(current()?.db_name || database); }
module.exports = {
  query: (...args) => pool().query(...args), execute: (...args) => pool().execute(...args),
  getConnection: () => pool().getConnection(),
  end: () => Promise.all([...pools.values()].map(p => p.end())),
  platform, database, options, poolFor, current,
  run: (organization, fn) => context.run(organization, fn),
};
