# Contexto compartilhado entre IAs

Esta pasta existe para reduzir perda de contexto ao alternar entre Codex e Claude.

Arquivos (ler nesta ordem):

1. `SYSTEM_CONTEXT.md`: visão principal do sistema, arquitetura, regras de negócio e foco do MVP.
2. `HANDOFF.md`: estado atual, últimas decisões, riscos e próximo passo.
3. `CODEMAP.md`: mapa de onde está cada função/endpoint (server.js ~3150 linhas) + receita de feature.
4. `UPDATE_CHECKLIST.md`: checklist do que atualizar após mudanças.

Raiz do projeto:
- `AGENTS.md`: regras para agentes (aponta para esta pasta).
- `ANALISE-E-ROADMAP.md`: visão estratégica e roadmap por fases (vs Blue Yonder).

Uso recomendado:

1. Antes de iniciar uma sessão, leia `SYSTEM_CONTEXT.md`, `HANDOFF.md` e `CODEMAP.md`.
2. Ao terminar uma entrega relevante, atualize `HANDOFF.md`.
3. Se mudar estratégia/arquitetura/regra, atualize `SYSTEM_CONTEXT.md`.
4. Se mover/renomear função ou endpoint, atualize `CODEMAP.md`.

Observacao:

- Esta pasta esta bloqueada do deploy via `.vercelignore`.
