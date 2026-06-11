# TáÓtimo! — Inteligência de escala para o varejo

*uma solução **Contagil***

Sistema de dimensionamento e montagem de escala para supermercados. Foco no MVP: **frente de caixa**, já expandido para setores via dados mercadológicos.

- **Produção:** https://escala.contagilpb.com.br
- **Deploy:** Vercel (projeto `mvp-web-proprio`) — `git push origin main` faz deploy automático.
- **Stack:** Node.js (HTTP puro, sem framework) + frontend estático vanilla + Supabase (REST).

---

## ⚡ Comece por aqui (ordem de leitura para dev/IA)

1. **`AGENTS.md`** — regras de trabalho neste projeto.
2. **`.ai-context/SYSTEM_CONTEXT.md`** — produto, arquitetura, regras de negócio.
3. **`.ai-context/HANDOFF.md`** — onde o projeto parou, riscos, próximo passo.
4. **`.ai-context/CODEMAP.md`** — onde está cada função/endpoint (server.js tem ~3150 linhas).
5. **`ANALISE-E-ROADMAP.md`** — estratégia e roadmap por fases.
6. **`SECRETS.md`** — credenciais e contas de teste (NÃO versionado; pedir ao Rodrigo).

---

## 🚀 Rodar localmente

```bash
npm install
# crie um .env a partir de .env.example e preencha SUPABASE_KEY + PILOT_INVITE_CODE
node server.js
# abre em http://localhost:4173
```

Validar antes de qualquer push:
```bash
node -c server.js && node -c public/app.js
```

---

## 📁 Estrutura

```
server.js              # backend inteiro (HTTP + lógica + endpoints)
db-supabase.js         # persistência/auth REAL (Supabase REST)
db.js                  # STUB (não conecta Postgres direto; mantido por compat)
public/
  index.html app.js    # SPA principal
  styles.css           # base
  futuristic.css       # tema (escuro base + bloco data-theme="light")
  colaborador.html     # self-service do colaborador (público)
create-tables.sql      # schema Supabase
add-organization.sql   # colunas multiempresa (orgid/orgcode/role)
.ai-context/           # memória compartilhada entre devs/IAs
AGENTS.md              # regras para agentes
ANALISE-E-ROADMAP.md   # estratégia
SECRETS.md             # credenciais (gitignored)
```

---

## 🧩 Conceitos que NÃO podem se misturar

- **Operadores** (pessoas) ≠ **PDVs** (terminais). Caixas ativos = `min(operadores, PDVs, demanda)`.
- **Folgas** nunca em sexta/sábado; **domingo** configurável (fechado conta como folga).
- **Cobertura**: por hora (caixa, via VRSoft) e por dia da semana (setores, via mercadológico).
- **Importação**: VRSoft alimenta o caixa; mercadológico alimenta os setores/ICOS.
- **Multiempresa**: dados por `orgId`; papéis `gestor` / `admin` / `membro`.

---

## ✅ Já entregue

Escala (3 jornadas: corrida/partida/comercial, abridor+fechador), ICOS por mercadológico, painel operacional (faturamento, dimensionamento, perdas, forecast, banco de horas, what-if), compliance CLT, export imprimível, self-service, gestor de módulos por empresa, tema claro/escuro, co-branding Contagil.

## 🎯 Próximo passo recomendado

**Publicar/versionar a escala** (rascunho vs oficial salvo no `clientState`). Ver `.ai-context/HANDOFF.md`.
