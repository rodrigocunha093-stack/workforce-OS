# Instruções para agentes (Codex / Claude / humano)

Antes de propor ou alterar código neste projeto, leia NESTA ORDEM:

1. `.ai-context/SYSTEM_CONTEXT.md` — produto, arquitetura, regras de negócio, foco do MVP
2. `.ai-context/HANDOFF.md` — último estado, decisões, riscos, próximo passo
3. `.ai-context/CODEMAP.md` — onde está cada função/endpoint (server.js tem ~3150 linhas)
4. `.ai-context/UPDATE_CHECKLIST.md` — o que atualizar ao terminar
5. `ANALISE-E-ROADMAP.md` (raiz) — visão estratégica e roadmap por fases

## Produto (resumo)

- **EscalaON** — *uma solução Contagil*. Inteligência de escala para o varejo.
- Publicado em `https://escala.contagilpb.com.br` (Vercel `mvp-web-proprio`; push em `main` = deploy).
- Persistência e auth em **Supabase via REST** (`db-supabase.js`).
- Foco principal do MVP: **frente de caixa**. Já expandido para setores via mercadológico (ICOS).

## Objetivo da memória compartilhada

- manter Codex, Claude e humanos alinhados sobre produto, arquitetura e prioridades;
- evitar retrabalho, regressão e mudanças fora do escopo;
- registrar o ponto exato onde o projeto parou antes de trocar de IA/dev.

## Regras locais (NÃO QUEBRAR)

- evolução incremental; **nada de reescrita ampla sem necessidade**;
- preservar: autenticação, multiempresa (por `orgId`), importação (VRSoft + mercadológico), dashboard e motor de escala;
- manter clara a separação: **operadores ≠ PDVs**; folgas nunca em sexta/sábado; domingo configurável; cobertura por hora (caixa) e por dia (setores);
- ao concluir mudança relevante → atualizar `.ai-context/HANDOFF.md`;
- ao mudar regra/arquitetura/direção → atualizar também `.ai-context/SYSTEM_CONTEXT.md`;
- ao mover/renomear funções ou endpoints → atualizar `.ai-context/CODEMAP.md`.

## Deploy

- `git push origin main` dispara o deploy no Vercel.
- Não há build step (frontend estático + server.js). Validar com `node -c server.js` e `node -c public/app.js` antes do push.
- Variáveis sensíveis (Supabase, invite code) ficam no Vercel, não no repo.
