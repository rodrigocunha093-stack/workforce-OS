-- Inserir usuário de teste
INSERT INTO users (name, email, password_hash, org_name)
VALUES ('Demo User', 'demo@test.com', '$2b$10$N9qo8uLOickgx2ZMRZoMye', 'Loja Demo')
ON CONFLICT (email) DO NOTHING;

-- Obter ID do usuário para usar nos inserts
DO $$
DECLARE
  user_id INT;
BEGIN
  SELECT id INTO user_id FROM users WHERE email = 'demo@test.com';

  -- Inserir colaboradores reais
  INSERT INTO employees (user_id, name, cargo, setor, desempenho)
  VALUES
    (user_id, 'Marcos', 'Operador de Caixa', 'Caixa', 4.5),
    (user_id, 'Thaynara', 'Operador de Caixa', 'Caixa', 4.2),
    (user_id, 'Bianca', 'Operador de Caixa', 'Caixa', 3.8),
    (user_id, 'Riaison', 'Operador de Caixa', 'Caixa', 4.0),
    (user_id, 'Daluz', 'Operador de Caixa', 'Caixa', 3.9),
    (user_id, 'Ana Silva', 'Gerente', 'Administrativa', 4.8),
    (user_id, 'João Santos', 'Repositor', 'Mercearia', 4.1),
    (user_id, 'Maria Costa', 'Açougueira', 'Açougue', 4.3),
    (user_id, 'Pedro Oliveira', 'Padeiro', 'Padaria', 4.2),
    (user_id, 'Laura Gomes', 'Repositor', 'Hortifruti', 3.9)
  ON CONFLICT DO NOTHING;

  -- Inserir horários da loja
  INSERT INTO store_hours (user_id, day_name, open_time, close_time)
  VALUES
    (user_id, 'Segunda', '08:00'::TIME, '20:00'::TIME),
    (user_id, 'Terça', '08:00'::TIME, '20:00'::TIME),
    (user_id, 'Quarta', '08:00'::TIME, '20:00'::TIME),
    (user_id, 'Quinta', '08:00'::TIME, '20:00'::TIME),
    (user_id, 'Sexta', '08:00'::TIME, '21:00'::TIME),
    (user_id, 'Sábado', '07:00'::TIME, '20:00'::TIME),
    (user_id, 'Domingo', '09:00'::TIME, '18:00'::TIME)
  ON CONFLICT DO NOTHING;

  -- Inserir dados de vendas de exemplo
  INSERT INTO sales_data (user_id, data, hora, clientes, itens, valor_total)
  SELECT
    user_id,
    CURRENT_DATE - (random() * 30)::INT,
    (8 + (random() * 12)::INT)::TEXT || ':00'::TIME,
    (5 + (random() * 15)::INT)::INT,
    (8 + (random() * 40)::INT)::INT,
    (100 + (random() * 500))::DECIMAL(10,2)
  FROM generate_series(1, 168)
  ON CONFLICT DO NOTHING;

END $$;
