# API Updates - client_id Integration

## ✅ Mudanças Realizadas

### 1. Nova Coluna na Tabela `companies`
- ✅ Adicionada coluna `client_id` (VARCHAR(100), UNIQUE, NULLABLE)
- Índice único criado para buscas rápidas

### 2. Identificação de Empresas
**Antes:** Via CNPJ na URL (`/api/sales_data/:cnpj`)  
**Agora:** Via `client_id` no envelope do agente (comparação exata de strings)

### 3. Fluxo de Comparação

O backend agora **compara** o `client_id` do agente com o `client_id` armazenado na tabela:

```
Agente envia:   "client_id": "feirao-teste"
                         ↓↓↓ COMPARADO COM ↓↓↓
Banco de dados: companies.client_id = "feirao-teste"
                         ↓
                Se igual → ✅ Insere dados
                Se diferente → ❌ Erro 404
```

## 4. Rotas Atualizadas

### POST /api/sales_data
```json
{
  "id": "...",
  "type": "RESULT_DATA",
  "payload": { "columns": [...], "rows": [...] },
  "client_id": "feirao-teste",
  "agent_id": "agent-feirao-teste-02",
  "timestamp": "2026-07-28T18:51:06+00:00"
}
```

### POST /api/setores/batch
```json
{
  "type": "RESULT_DATA",
  "payload": [{ "nome": "...", "corredor": ... }],
  "client_id": "feirao-teste"
}
```

### POST /api/mercadologicos/batch
```json
{
  "type": "RESULT_DATA",
  "payload": [{ "nome": "..." }],
  "client_id": "feirao-teste"
}
```

## 5. Novo Sistema de Registro

Agora o registro aceita `clientId` como parâmetro:

```bash
POST /api/auth/register
{
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "123456",
  "orgName": "Feira Teste",
  "clientId": "feirao-teste"
}
```

**Resultado:** Nova empresa criada com `client_id = "feirao-teste"`

## 6. Empresas Existentes

Para adicionar `client_id` a uma empresa já existente:

```sql
UPDATE companies SET client_id = 'feirao-teste' WHERE name = 'Demo Company';
```

## Status Atual

- ✅ Migration aplicada
- ✅ Backend atualizado
- ✅ Demo Company configurada com `client_id = "feirao-teste"`
- ✅ Sistema pronto para receber dados do agente

## Rollback (se necessário)

```bash
npm run migrate:rollback
```

Isso vai remover a coluna `client_id` e reverter para o estado anterior.
