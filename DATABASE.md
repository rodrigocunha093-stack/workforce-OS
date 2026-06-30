# 📊 Documentação do Banco de Dados - workforce-v2

## Visão Geral

O projeto foi **refatorado** do original (workforce-OS) com uma estrutura de banco muito mais **normalizada e profissional**.

### Original (workforce-OS)
```
┌─────────────┐
│  Tabela: users
│  (simples)
└─────────────┘
       ↓
┌─────────────────────┐
│ Tabela: clients     │
│ - Tudo em JSONB     │
│ - Dados confusos    │
│ - Difícil de buscar │
└─────────────────────┘
```

### Novo (workforce-v2)
```
┌──────────┐  ┌───────────┐  ┌────────────┐
│  users   │─→│ employees │  │store_hours │
└──────────┘  └───────────┘  └────────────┘
     ↓
┌──────────────┐  ┌─────────────┐  ┌──────────────────┐
│  schedules   │  │ sales_data  │  │schedule_workflow │
└──────────────┘  └─────────────┘  └──────────────────┘
     ↓
┌────────────────────────┐
│schedule_closed_period  │
└────────────────────────┘
```

---

## 📋 Tabelas Detalhadas

### 1. **users** (Usuários)

**O que armazena:**
- Dados básicos do usuário (name, email, senha)
- Informação da organização (org_name)

**De onde vem:**
- Cadastro na aplicação (/auth/register)

**Campos:**
```sql
id              INTEGER PRIMARY KEY
name            VARCHAR(100) - Nome completo
email           VARCHAR(100) UNIQUE - Email
password_hash   VARCHAR(255) - Senha criptografada
org_name        VARCHAR(100) - Nome da loja/empresa
created_at      TIMESTAMP - Data de criação
```

**Como era no ORIGINAL:**
```javascript
// Armazenado em clients → data.profile.usuario
{
  "profile": {
    "usuario": { "id", "name", "email" }
  }
}
```

**Por que mudou:** Melhor segurança e performance. Tabela separada é mais eficiente que buscar em JSONB.

---

### 2. **employees** (Colaboradores)

**O que armazena:**
- Dados de cada colaborador (nome, cargo, setor, preferências)
- Configurações de trabalho (turno, folga preferencial)

**De onde vem:**
- Importação de dados do VRSoft
- Cadastro manual na aplicação

**Campos:**
```sql
id                  INTEGER PRIMARY KEY
user_id             INTEGER - Referência do usuário (FK)
name                VARCHAR(100) - Nome do colaborador
cargo               VARCHAR(100) - Cargo (Operador, Gerente, etc)
setor               VARCHAR(100) - Setor (Caixa, Mercearia, etc)
proficiencia        VARCHAR(20) - Nível (pleno, junior, etc)
turno               VARCHAR(20) - Preferência (flexivel, abertura, fechamento)
pode_domingo        BOOLEAN - Pode trabalhar domingo?
folga_preferencial  VARCHAR(20) - Dia preferido de folga
desempenho          DECIMAL(3,1) - Rating 1-5
created_at          TIMESTAMP
```

**Como era no ORIGINAL:**
```javascript
// Armazenado em clients → data.colaboradores[]
{
  "colaboradores": [
    { "nome": "João", "cargo": "Operador", "setor": "Caixa", ... }
  ]
}
```

**Por que mudou:** Consultas mais rápidas. Fácil filtrar por user_id, setor, cargo, etc.

---

### 3. **store_hours** (Horários da Loja)

**O que armazena:**
- Horários de abertura/fechamento por dia da semana
- Configuração da loja

**De onde vem:**
- Configuração do usuário na aplicação

**Campos:**
```sql
id          INTEGER PRIMARY KEY
user_id     INTEGER - Referência do usuário (FK)
day_name    VARCHAR(20) - Nome do dia (Segunda, Terça, etc)
open_time   TIME - Hora de abertura (08:00)
close_time  TIME - Hora de fechamento (20:00)
created_at  TIMESTAMP
```

**Como era no ORIGINAL:**
```javascript
// Armazenado em clients → data.store.horarios
{
  "store": {
    "horarios": {
      "segunda": { "open": "08:00", "close": "20:00" }
    }
  }
}
```

**Por que mudou:** Melhor estrutura. Fácil gerenciar múltiplos dias e fazer queries.

---

### 4. **sales_data** (Dados de Vendas)

**O que armazena:**
- Dados de vendas diárias do VRSoft
- Usado para calcular demanda (Erlang-C)

**De onde vem:**
- Integração com VRSoft (importação)
- API externa

**Campos:**
```sql
id          INTEGER PRIMARY KEY
user_id     INTEGER - Referência do usuário (FK)
data        DATE - Data da venda
hora        TIME - Hora do registro
clientes    INTEGER - Quantidade de clientes
itens       INTEGER - Quantidade de itens vendidos
valor_total DECIMAL(10,2) - Faturamento
created_at  TIMESTAMP
```

**Como era no ORIGINAL:**
```javascript
// Armazenado em clients → data.vendas[]
{
  "vendas": [
    { "data": "2026-06-22", "hora": "14:30", "clientes": 15, "faturamento": 250.00 }
  ]
}
```

**Por que mudou:** Índices facilitam buscas por data/hora. Cálculo de demanda é mais rápido.

---

### 5. **schedules** (Escalas Geradas)

**O que armazena:**
- Escala completa de trabalho gerada pelo algoritmo
- JSON com colaborador → array de 7 dias (turnos)

**De onde vem:**
- Gerado por `generateScheduleByProfile()` no backend
- Salvo quando usuário clica "Gerar" ou "Exportar"

**Campos:**
```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER - Referência do usuário (FK)
week_start      DATE - Data de início da semana (seg-dom)
schedule_data   JSONB - A escala inteira em JSON
status          VARCHAR(20) - 'draft', 'saved', etc
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Exemplo de `schedule_data`:**
```json
{
  "João Silva": ["Folga", "08:00-10:00/11:00-16:00", "08:00-10:00/11:00-16:00", "08:00-10:00/11:00-16:00", "08:00-10:00/11:00-16:00", "08:00-10:00/11:00-16:00", "Folga"],
  "Maria Santos": ["08:00-10:00/11:00-16:00", "Folga", "08:00-10:00/11:00-16:00", "08:00-10:00/11:00-16:00", "08:00-10:00/11:00-16:00", "08:00-10:00/11:00-16:00", "08:00-10:00/11:00-16:00"]
}
```

**Como era no ORIGINAL:**
```javascript
// Armazenado em clients → data.source (variável global)
// Não tinha "histórico", era tudo em memória
{
  "source": {
    "people": { /* escala */ },
    "label": "Semana 1",
    "targetHours": 44
  }
}
```

**Por que mudou:** 
- Permite histórico de escalas
- Rastreabilidade (quem gerou, quando)
- Base para snapshots fechados

---

### 6. **schedule_workflow** (Workflow de Escala)

**O que armazena:**
- Status da escala no fluxo (rascunho → revisado → publicado)
- Quem revisou, quando, etc

**De onde vem:**
- Criado automaticamente quando escala é gerada
- Atualizado quando usuário clica "Marcar revisado" ou "Fechar período"

**Campos:**
```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER UNIQUE - Referência do usuário (FK)
status          VARCHAR(20) - rascunho, revisado, publicado, realizado
reviewed_at     TIMESTAMP - Quando foi revisado
reviewed_by     VARCHAR(255) - Email de quem revisou
published_at    TIMESTAMP - Quando foi publicado
published_by    VARCHAR(255) - Email de quem publicou
completed_at    TIMESTAMP - Quando foi concluído
completed_by    VARCHAR(255) - Email de quem completou
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Como era no ORIGINAL:**
```javascript
// Armazenado em clients → data.escalaWorkflow
{
  "escalaWorkflow": {
    "status": "rascunho",
    "reviewedAt": null
  }
}
```

**Por que mudou:**
- Registro de auditoria completo
- Fácil rastrear quem fez cada ação
- Melhor controle de fluxo

---

### 7. **schedule_closed_period** (Períodos Fechados)

**O que armazena:**
- Snapshots imutáveis de escalas que foram "fechadas"
- Histórico dos últimos 12 períodos fechados

**De onde vem:**
- Criado quando usuário clica "Fechar período"
- Cópia do `schedule_data` + metadata

**Campos:**
```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER - Referência do usuário (FK)
label           VARCHAR(100) - "22/06 a 28/06"
data_inicio     DATE - Início do período
data_fim        DATE - Fim do período
cenario         VARCHAR(50) - 'atual', 'transicao', 'final'
schedule_data   JSONB - Cópia da escala (imutável)
closed_at       TIMESTAMP - Quando foi fechado
closed_by       VARCHAR(255) - Email de quem fechou
created_at      TIMESTAMP
```

**Como era no ORIGINAL:**
```javascript
// Armazenado em clients → data.escalaFechada[] (array)
{
  "escalaFechada": [
    { "label": "Semana 1", "dataInicio": "2026-06-15", "schedule": {...} }
  ]
}
```

**Por que mudou:**
- Tabela separada = melhor performance
- Snapshots = dados imutáveis (garantia legal/compliance)
- Fácil recuperar período antigo
- Limite de 12 períodos é claro no código

---

## 🔄 Fluxo de Dados

### Ao gerar uma escala:

```
1. Backend lê employees[] e sales_data[] via SQL
   ↓
2. Algoritmo gera schedule (JSON)
   ↓
3. INSERT INTO schedules (user_id, schedule_data, status='draft')
   ↓
4. INSERT INTO schedule_workflow (user_id, status='rascunho')
   ↓
5. Frontend exibe a tabela (lê de schedule_data)
```

### Ao clicar "Marcar revisado":

```
1. Frontend → POST /api/schedule/status { status: 'revisado' }
   ↓
2. Backend UPDATE schedule_workflow SET status='revisado', reviewed_by=email
   ↓
3. Frontend atualiza UI (botão muda para "↩ Voltar para rascunho")
```

### Ao clicar "Fechar período":

```
1. Frontend → POST /api/schedule/fechar { dataInicio, dataFim }
   ↓
2. Backend:
   - SELECT schedule_data FROM schedules (pega a escala atual)
   - INSERT INTO schedule_closed_period (cria snapshot imutável)
   - UPDATE schedule_workflow SET status='publicado'
   ↓
3. Frontend exibe período na lista de histórico
```

---

## 📊 Comparação Visual

| Aspecto | Original | Novo | Benefício |
|---------|----------|------|-----------|
| Estrutura | Tudo em JSONB | Normalizado | ⚡ Queries mais rápidas |
| Histórico | Não existe | schedule_closed_period | 📜 Rastreabilidade |
| Auditoria | Básica | schedule_workflow completo | 🔍 Quem fez o quê |
| Buscar escala | JSONB parsing | SELECT por user_id | 🚀 Performance |
| Compliance | Difícil | Snapshots imutáveis | ✅ Legal |
| Índices | Não otimizado | 6 índices | 📈 Escalável |

---

## 🛠️ Resumo de Mudanças

### ✅ Melhorias implementadas:

1. **Separação de responsabilidades** - Cada tabela tem 1 propósito claro
2. **Performance** - Índices no user_id, data, etc
3. **Auditoria** - Registro de quem fez cada ação e quando
4. **Compliance** - Snapshots imutáveis para períodos fechados
5. **Escalabilidade** - Fácil adicionar novos campos sem quebrar JSONB
6. **Segurança** - Dados sensíveis em colunas tipadas, não em JSON

### 📌 O que permaneceu igual:

- Algoritmo de geração de escala (schedule.js)
- Lógica de cálculo de demanda
- Interface visual (praticamente idêntica)
- Fluxo de workflow

---

## 🔗 Referências

- **Backend**: `/backend/src/db/init.sql`
- **Rotas**: `/backend/src/routes/schedule.js`
- **Serviço**: `/backend/src/services/schedule.js`
- **Frontend**: `/frontend/src/components/EscalaSchedule.jsx`
