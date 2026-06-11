# HANDOFF

> Última sessão: 2026-06-11 (Claude). Leia antes de agir.

## Estado atual (resumo honesto)

- Produto vivo em `https://escala.contagilpb.com.br` (Vercel `mvp-web-proprio`, push em `main` faz deploy).
- Persistência/auth em **Supabase via REST** (`db-supabase.js`). `db.js` é stub (`mode:'rest'`).
- **O `.ai-context/` estava DEFASADO**: descrevia "Workforce OS" provando frente de caixa, com suspeita de demo. O código real já é **TáÓtimo! (solução Contagil)** com multiempresa, gestor de módulos, ICOS por mercadológico, 3 jornadas, compliance CLT, forecast, banco de horas, what-if, self-service, painel operacional. `SYSTEM_CONTEXT.md` foi reescrito para a realidade nesta sessão.

## O que foi feito nesta sessão

1. **Correção da suspeita de "modo demonstração"** (era a pendência nº1 do contexto):
   - Causa: `app.js` só tratava `mode==='postgresql'` como real; como `db.js` devolve `mode:'rest'`, o badge mostrava "base demonstrativa" mesmo com dados reais do Supabase.
   - Fix: badge e card "Base de dados" agora consideram **`authenticated && mode!=='demo'`** = dados reais ("Supabase · dados reais da empresa"). Demo só sem login.
2. **Toggle de tema claro/escuro** (alinhamento visual com a Contagil, que tem esse recurso): botão no header, persistência em `localStorage` (`taotimo-theme`), bloco CSS `html[data-theme="light"]`.
3. **Co-branding Contagil** (sessão anterior, mantido): badge "uma solução Contagil", footer com link/tagline, accent `#3B82F6` compartilhado.
4. `SYSTEM_CONTEXT.md` totalmente atualizado; este `HANDOFF.md` reescrito.

## Arquivos alterados

- `public/app.js` — toggle de tema (IIFE no topo) + correção do badge de fonte de dados (2 pontos: linha ~362 e ~2433).
- `public/index.html` — botão `#themeToggle` no header; co-branding/footer (sessão anterior).
- `public/futuristic.css` — `.theme-toggle` + bloco completo do tema claro.
- `.ai-context/SYSTEM_CONTEXT.md` — reescrito para o estado real.
- `.ai-context/HANDOFF.md` — este registro.

## Decisões tomadas

- Não reescrever o tema escuro; o claro é uma **camada `data-theme="light"`** por cima (incremental, reversível).
- O badge passa a confiar em `authenticated + mode!=='demo'` em vez de exigir `postgresql` — reflete a arquitetura REST atual sem mexer no backend.
- `db.js` permanece stub de propósito (migração para Postgres direto não é prioridade; REST funciona).

## Riscos conhecidos

- **Tema claro é override amplo via `!important`**: alguns cantos menos usados podem ter contraste imperfeito no claro. Validar visualmente as 10 abas no modo claro antes de divulgar.
- **Escala não é persistida/versionada**: `staffSchedule`/`fullSchedule` recalculam a cada request. Se dois gestores editam, não há "escala publicada" salva (Fase 1 do roadmap).
- **Import é CSV manual** (VRSoft e mercadológico). Sem conector automático.
- **Compliance CLT é heurística** (não cobre todas CCTs locais). Hoje sinaliza, não bloqueia publicação.
- `www.escala.contagilpb.com.br` ainda não resolve (falta CNAME `www` + domínio no Vercel). O ápice `escala...` funciona.

## Separação de conceitos (manter clara — pedido explícito)

- **Operadores** (pessoas) ≠ **PDVs** (terminais físicos). Caixas ativos = `min(operadores, PDVs, demanda)`.
- **Folgas**: nunca sexta/sábado; domingo fechado já é folga.
- **Domingos**: configuráveis por loja (aberto/fechado/parcial).
- **Cobertura**: por hora (caixa, via VRSoft) e por dia da semana (setores, via mercadológico).
- **Importação**: VRSoft alimenta o caixa; mercadológico alimenta os setores/ICOS. São fontes distintas.

## Próximo passo recomendado

1. **Validar visualmente o tema claro** nas 10 abas (risco de contraste).
2. **Fase 1 do roadmap — publicar/versionar escala**: salvar a escala aprovada no `clientState` (campo `escalaPublicada`), com data/autor, separando "rascunho" (recalculado) de "oficial" (persistido). É o que falta para o gerente usar toda semana.
3. Configurar `www.` no Vercel/Cloudflare.

## Referências

- Roadmap completo e análise vs Blue Yonder: `ANALISE-E-ROADMAP.md`.
- Regras de produto e arquitetura: `.ai-context/SYSTEM_CONTEXT.md`.
