# UPDATE CHECKLIST

Atualize estes pontos ao terminar uma mudança relevante.

## Sempre (toda sessão)

- [ ] `HANDOFF.md`
  - o que foi feito · arquivos alterados · decisões · riscos · próximo passo
- [ ] Validar antes do push: `node -c server.js` e `node -c public/app.js`
- [ ] `git push origin main` (dispara deploy Vercel)

## Quando mudar arquitetura, fluxo ou regra de negócio

- [ ] `SYSTEM_CONTEXT.md` — stack, regra de negócio, foco do MVP, prioridades

## Quando mover/renomear função ou endpoint, ou criar feature

- [ ] `CODEMAP.md` — manter o mapa de funções/endpoints fiel
- [ ] Lembrar a receita de feature (no CODEMAP): campo em `defaultClientState` → endpoint → `buildXxx` → expor em `applyClientState` → `renderXxx` + `safeRender` → CSS → testar via API

## Quando mudar estratégia/roadmap

- [ ] `ANALISE-E-ROADMAP.md` (raiz)

## Ao alternar entre Codex e Claude (transição)

Use o modelo abaixo no `HANDOFF.md`:

```md
## Transição
- Objetivo: ...
- Arquivos alterados: ...
- Decisão tomada: ...
- Risco conhecido: ...
- Próximo passo: ...
```

## Inconsistências (regra de ouro)

Se encontrar divergência entre **código**, **deploy** e **banco**, documente claramente no `HANDOFF.md` em vez de "consertar silenciosamente". O código em produção manda; ajuste a documentação a ele.
