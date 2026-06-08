const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 6543),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function getUser(email) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('DB Error:', error);
    return null;
  }
}

async function getUserById(id) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    return null;
  }
}

async function createUser(user) {
  try {
    await pool.query(
      'INSERT INTO users (id, name, email, passwordHash, passwordSalt, inviteCode) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.name, user.email, user.passwordHash, user.passwordSalt, user.inviteCode || null]
    );
    return true;
  } catch (error) {
    console.error('DB Error:', error);
    return false;
  }
}

async function saveSession(token, userId, expiresAt) {
  try {
    await pool.query(
      'INSERT INTO sessions (token, userId, expiresAt) VALUES ($1, $2, $3) ON CONFLICT (token) DO UPDATE SET userId = $2, expiresAt = $3',
      [token, userId, new Date(expiresAt)]
    );
    return true;
  } catch (error) {
    console.error('DB Error:', error);
    return false;
  }
}

async function getSession(token) {
  try {
    const result = await pool.query('SELECT * FROM sessions WHERE token = $1 AND expiresAt > NOW()', [token]);
    return result.rows[0] || null;
  } catch (error) {
    return null;
  }
}

async function deleteSession(token) {
  try {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    return true;
  } catch (error) {
    return false;
  }
}

async function saveClientData(userId, data) {
  try {
    await pool.query(
      'INSERT INTO clients (userId, data, updatedAt) VALUES ($1, $2, NOW()) ON CONFLICT (userId) DO UPDATE SET data = $2, updatedAt = NOW()',
      [userId, JSON.stringify(data)]
    );
    return true;
  } catch (error) {
    console.error('DB Error:', error);
    return false;
  }
}

async function getClientData(userId) {
  try {
    const result = await pool.query('SELECT data FROM clients WHERE userId = $1', [userId]);
    return result.rows[0] ? JSON.parse(result.rows[0].data) : null;
  } catch (error) {
    return null;
  }
}

async function auditLog(userId, action, detail) {
  try {
    await pool.query(
      'INSERT INTO audit (userId, action, detail) VALUES ($1, $2, $3)',
      [userId, action, JSON.stringify(detail)]
    );
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  getUser,
  getUserById,
  createUser,
  saveSession,
  getSession,
  deleteSession,
  saveClientData,
  getClientData,
  auditLog
};
