-- Adicionar suporte a múltiplos usuários por empresa (organização)

-- 1. Adicionar colunas de organização na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS orgid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS orgcode TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'membro';

-- 2. Migrar usuários existentes: cada um vira dono da própria organização
UPDATE users SET orgid = id WHERE orgid IS NULL;
UPDATE users SET role = 'admin' WHERE role IS NULL OR role = 'membro';

-- 3. Índice para busca por código de empresa
CREATE INDEX IF NOT EXISTS idx_users_orgcode ON users(orgcode);
CREATE INDEX IF NOT EXISTS idx_users_orgid ON users(orgid);
