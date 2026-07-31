const { Pool } = require('pg');

console.log('Conectando ao PostgreSQL com:');
console.log('Host:', process.env.DB_HOST || 'localhost');
console.log('Port:', process.env.DB_PORT || 5432);
console.log('Database:', process.env.DB_NAME || 'workforce_v2');
console.log('User:', process.env.DB_USER || 'postgres');
console.log('Password length:', (process.env.DB_PASSWORD || '').length);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'workforce_v2',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

pool.on('error', (err) => {
  console.error('❌ Pool error:', err.message);
  console.error('Details:', err);
});

let loggedFirstConnection = false;
pool.on('connect', () => {
  if (!loggedFirstConnection) {
    console.log('✅ Conexão com PostgreSQL estabelecida!');
    loggedFirstConnection = true;
  }
});

module.exports = pool;
