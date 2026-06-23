require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db/postgres');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Middleware de autenticação
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded;
    } catch (err) {
      console.error('Token inválido');
    }
  }

  next();
});

// ===== ROTAS DE AUTENTICAÇÃO =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, orgName } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, org_name) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [name, email, hashedPassword, orgName]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ROTAS DE ESCALA =====

const scheduleRouter = require('./routes/schedule');
app.use('/api/schedule', scheduleRouter);

// ===== ROTAS DE COLABORADORES =====

app.get('/api/employees', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.json([]);
    }

    const result = await pool.query(
      'SELECT * FROM employees WHERE user_id = $1',
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, cargo, setor, turno, desempenho } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const result = await pool.query(
      'INSERT INTO employees (user_id, name, cargo, setor, turno, desempenho) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, name, cargo, setor, turno, desempenho]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== HEALTH CHECK =====

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== INICIAR SERVIDOR =====

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`   API em http://localhost:${PORT}/api`);
  console.log(`   Schedule em http://localhost:${PORT}/api/schedule`);
});
