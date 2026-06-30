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
      console.error('Token inválido:', err.message);
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
      return res.status(401).json({ error: 'Token expirado ou inválido. Faça login novamente.' });
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
    const { name, cargo, setor, turno, desempenho, pode_domingo } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const result = await pool.query(
      'INSERT INTO employees (user_id, name, cargo, setor, turno, desempenho, pode_domingo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, name, cargo, setor, turno, desempenho, pode_domingo !== false]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/config/store-hours - Retorna configuração completa da loja
app.get('/api/config/store-hours', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const result = await pool.query(
      'SELECT * FROM store_setup WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        storeSetup: {
          empresa: null,
          loja: null,
          regimeTributario: null,
          corredores: 1,
          pdvs: 3,
          weekdayHours: '08:00-20:00',
          saturdayHours: '07:00-20:00',
          sundayHours: '09:00-18:00',
          sundayOperation: 'aberto'
        }
      });
    }

    const setup = result.rows[0];
    const storeSetup = {
      empresa: setup.empresa,
      loja: setup.loja,
      regimeTributario: setup.regime_tributario,
      corredores: setup.corredores || 1,
      pdvs: setup.pdvs || 3,
      weekdayHours: setup.weekday_hours || '08:00-20:00',
      saturdayHours: setup.saturday_hours || '07:00-20:00',
      sundayHours: setup.sunday_hours || '09:00-18:00',
      sundayOperation: setup.sunday_operation || 'aberto'
    };

    res.json({ storeSetup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config/store-hours - Salva configuração completa da loja
app.post('/api/config/store-hours', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { empresa, loja, regimeTributario, corredores, pdvs, weekdayHours, saturdayHours, sundayHours, sundayOperation } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Criar tabela store_setup se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_setup (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        empresa VARCHAR(255),
        loja VARCHAR(255),
        regime_tributario VARCHAR(50),
        corredores INTEGER DEFAULT 1,
        pdvs INTEGER DEFAULT 3,
        weekday_hours VARCHAR(11),
        saturday_hours VARCHAR(11),
        sunday_hours VARCHAR(11),
        sunday_operation VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Salvar todos os dados em uma única tabela
    await pool.query(
      `INSERT INTO store_setup (user_id, empresa, loja, regime_tributario, corredores, pdvs, weekday_hours, saturday_hours, sunday_hours, sunday_operation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id) DO UPDATE SET
         empresa = $2,
         loja = $3,
         regime_tributario = $4,
         corredores = $5,
         pdvs = $6,
         weekday_hours = $7,
         saturday_hours = $8,
         sunday_hours = $9,
         sunday_operation = $10,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, empresa, loja, regimeTributario, corredores || 1, pdvs || 3, weekdayHours, saturdayHours, sundayHours, sundayOperation]
    );

    res.json({ success: true, message: 'Configuração da loja salva com sucesso' });
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
