# Guia de Sincronização de Vendas

## O que faz

O serviço de sincronização coordena com o **orquestrador** (`http://10.0.100.204:8040`) pra buscar dados de vendas e índices do agente-vr, sem reprocessar dados antigos.

**Fluxo:**
1. Consulta `indices_vendas` (último `id` sincronizado por empresa)
2. Se não tem histórico = primeira execução (`id_inicio = 0`)
3. Dispara 2 jobs pro orquestrador:
   - `vendas` → busca dados com `WHERE id > id_inicio`
   - `indices-escala-vendas` → captura `MAX(id)` pra próxima vez
4. Orquestrador executa no agente e faz callback pra `/api/sales_data`
5. Backend grava dados em `sales_data` + índice em `indices_vendas`

---

## Configuração (`.env`)

```env
# Chave de API pra comunicar com o orquestrador
API_KEY_VENDAS=sua-chave-aqui

# Horários pra sincronizar automaticamente (formato cron)
# Deixar vazio pra desabilitar (roda só por demanda)
# Exemplos:
#   "0 8 * * *"      = 8:00 todo dia
#   "0 */4 * * *"    = a cada 4 horas
#   "0 8,12,16 * * *" = 8:00, 12:00, 16:00 todo dia
SYNC_VENDAS_SCHEDULES=0 8 * * *,0 14 * * *
```

---

## Como usar

### 1️⃣ **Execução por demanda** (manual)

**Sincronizar TODAS as empresas:**
```bash
curl -X GET http://localhost:5000/api/sync/vendas \
  -H "Authorization: Bearer <token-admin>"
```

**Sincronizar UM cliente específico:**
```bash
curl -X GET http://localhost:5000/api/sync/vendas/feirao-teste \
  -H "Authorization: Bearer <token-admin>"
```

**Verificar status de cada empresa:**
```bash
curl -X GET http://localhost:5000/api/sync/status \
  -H "Authorization: Bearer <token-admin>"
```

Resposta esperada:
```json
{
  "companies": [
    {
      "id": 1,
      "name": "Mercado Feirão",
      "client_id": "feirao-teste",
      "ultimo_id": 34456,
      "ultima_execucao": "2026-07-29T14:30:00.000Z"
    },
    {
      "id": 2,
      "name": "Outro Cliente",
      "client_id": "outro-cliente",
      "ultimo_id": 0,
      "ultima_execucao": null
    }
  ]
}
```

---

### 2️⃣ **Execução automática** (scheduler)

Adicione no `.env`:
```env
SYNC_VENDAS_SCHEDULES=0 8 * * *,0 14 * * *
```

Isso vai rodar:
- Todos os dias às 8:00
- Todos os dias às 14:00

**Verificar se está ativo:**
Quando o servidor inicia, você vê nos logs:
```
📅 Scheduler de sincronização configurado com 2 horário(s):
   ✓ 0 8 * * *
   ✓ 0 14 * * *
```

---

## Referência de Cron

| Padrão | Significado |
|--------|-------------|
| `0 8 * * *` | 8:00 todo dia |
| `0 */4 * * *` | A cada 4 horas (0, 4, 8, 12, 16, 20) |
| `0 0 * * 1` | 0:00 toda segunda-feira |
| `0 8,14,20 * * *` | 8:00, 14:00, 20:00 todo dia |
| `*/15 * * * *` | A cada 15 minutos |

---

## Logs

Quando a sincronização roda, você vê:

**Sucesso:**
```
[syncVendas] Iniciando sincronização: empresa=1, client_id=feirao-teste
[syncVendas] id_inicio para feirao-teste: 34456
[syncVendas] Job vendas despachado pra feirao-teste: { status: 'aceito', consulta_id: '...' }
[syncVendas] Job indices-escala-vendas despachado pra feirao-teste: { status: 'aceito', consulta_id: '...' }
[syncVendas] Tarefas despachadas com sucesso para feirao-teste
```

**Erro:**
```
[syncVendas] Erro ao despachar job vendas (feirao-teste): Network Error
```

---

## Troubleshooting

### "API_KEY_VENDAS não definida"
→ Adicione no `.env`:
```env
API_KEY_VENDAS=sua-chave-aqui
```

### "Client_id não encontrado"
→ Verifique que a empresa tem um `client_id` cadastrado:
```sql
SELECT id, name, client_id FROM companies WHERE name = 'Seu Cliente';
```

### Scheduler não está rodando
1. Verifique que `SYNC_VENDAS_SCHEDULES` está no `.env`
2. Verifique a sintaxe do cron (use um validador online)
3. Verifique os logs ao iniciar o servidor

### Orquestrador não responde (503/504)
→ Verifique:
1. Se `http://10.0.100.204:8040` está acessível
2. Se a `API_KEY_VENDAS` está correta
3. Se há agentes online pra esse cliente
