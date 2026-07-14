-- ============================================================
-- EscalaON — Setup do banco no SEU Supabase (rodar 1 vez só)
-- Como usar: abra o Supabase → menu "SQL Editor" → "New query"
--            cole TUDO isto e clique no botão verde "Run".
-- Cria as 4 tabelas usadas pelo sistema (users, sessions, clients, audit)
-- e as colunas de multiempresa. Pode rodar de novo sem medo (tudo é "IF NOT EXISTS").
-- ============================================================

-- 1) Usuários
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  passwordSalt TEXT NOT NULL,
  inviteCode TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2) Sessões (login)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3) Dados de cada empresa (guardados como JSON)
CREATE TABLE IF NOT EXISTS clients (
  userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4) Auditoria (registro de ações)
CREATE TABLE IF NOT EXISTS audit (
  id SERIAL PRIMARY KEY,
  userId TEXT NOT NULL,
  action TEXT NOT NULL,
  detail JSONB DEFAULT '{}'::jsonb,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5) Colunas de multiempresa (papéis e código da organização)
ALTER TABLE users ADD COLUMN IF NOT EXISTS orgid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS orgcode TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'membro';
UPDATE users SET orgid = id WHERE orgid IS NULL;
UPDATE users SET role = 'admin' WHERE role IS NULL OR role = 'membro';

-- 6) Índices (deixam as buscas rápidas)
CREATE INDEX IF NOT EXISTS idx_sessions_userId   ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
CREATE INDEX IF NOT EXISTS idx_audit_userId      ON audit(userId);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_orgcode     ON users(orgcode);
CREATE INDEX IF NOT EXISTS idx_users_orgid       ON users(orgid);

-- 7) Desligar o RLS (cadeado de segurança por linha).
-- O projeto controla o acesso na própria aplicação (login/sessão), como na produção do Rodrigo.
-- Sem isto, projetos Supabase novos bloqueiam a gravação ("row-level security policy").
ALTER TABLE users    DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients  DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit    DISABLE ROW LEVEL SECURITY;
