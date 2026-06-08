-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  passwordSalt TEXT NOT NULL,
  inviteCode TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de sessões
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de clientes/dados de usuários
CREATE TABLE IF NOT EXISTS clients (
  userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS audit (
  id SERIAL PRIMARY KEY,
  userId TEXT NOT NULL,
  action TEXT NOT NULL,
  detail JSONB DEFAULT '{}'::jsonb,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
CREATE INDEX IF NOT EXISTS idx_audit_userId ON audit(userId);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
