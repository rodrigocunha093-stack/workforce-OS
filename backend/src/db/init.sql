-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  org_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--Tabela de setores
CREATE TABLE IF NOT EXISTS setores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(55) NOT NULL,
  corredor INTEGER,
  erp_id INTEGER
);

-- Tabela de colaboradores
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  cargo VARCHAR(100),
  id_setor INTEGER REFERENCES setores(id),
  proficiencia VARCHAR(20) DEFAULT 'pleno',
  turno VARCHAR(20) DEFAULT 'flexivel',
  pode_domingo BOOLEAN DEFAULT TRUE,
  folga_preferencial VARCHAR(20),
  desempenho DECIMAL(3,1) DEFAULT 3.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--Tabela de mercadologicos
CREATE TABLE IF NOT EXISTS mercadologicos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(55) NOT NULL,
  erp_id INTEGER
);

--Tabela de vinculo empregados_mercadologico
CREATE TABLE IF NOT EXISTS empregado_mercadologico (
  id SERIAL PRIMARY KEY,
  id_employee INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  id_mercadologico INTEGER NOT NULL REFERENCES mercadologicos(id) ON DELETE CASCADE
);

-- Tabela de horários da loja
CREATE TABLE IF NOT EXISTS store_hours (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_name VARCHAR(20),
  open_time TIME,
  close_time TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de dados de vendas (VRSoft)
CREATE TABLE IF NOT EXISTS sales_data (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data DATE,
  hora TIME,
  clientes INTEGER,
  itens INTEGER,
  valor_total DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  erp_id INTEGER
);

-- Tabela de escalas geradas
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE,
  schedule_data JSONB,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de workflow de escala (status, revisão, fechamento)
CREATE TABLE IF NOT EXISTS schedule_workflow (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'rascunho',  -- rascunho, revisado, publicado, realizado
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(255),
  published_at TIMESTAMP,
  published_by VARCHAR(255),
  completed_at TIMESTAMP,
  completed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para períodos fechados (snapshots imutáveis)
CREATE TABLE IF NOT EXISTS schedule_closed_period (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(100),
  data_inicio DATE,
  data_fim DATE,
  cenario VARCHAR(50),
  schedule_data JSONB,  -- People, compliance, nominal data
  closed_at TIMESTAMP,
  closed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_user_id ON sales_data(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_workflow_user_id ON schedule_workflow(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_closed_period_user_id ON schedule_closed_period(user_id);
