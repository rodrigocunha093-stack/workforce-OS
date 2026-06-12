# HANDOFF

> Última sessão: 2026-06-11 (Claude). Leia antes de agir.

## 🔭 Sessão mais recente (fechar período + correção 44h)

**Feito:**
1. **Fechar/reabrir período da escala** (metáfora de fechamento contábil): `escalaFechada` (snapshot imutável) + `escalaHistorico[]` no clientState. Endpoints `POST /api/escala/fechar` e `/api/escala/reabrir`. Aba Escala mostra "PERÍODO FECHADO" (oficial, congelado) vs "RASCUNHO" (dinâmico), com alternância e histórico. Dono da org (orgId===id) ou admin/gestor pode fechar.
2. **Correção CLT 48h→44h**: jornada diária agora = `targetHours / (7 - targetDaysOff)`. 6x1 = **7h20/dia** (44h), não mais 8h×6=48h. Turnos passaram a exibir minutos (`06:00-13:20 · 7h20`). Novos helpers `formatHM`/`formatDur`; `shiftStartEnd`/`shiftBounds` (back e front) agora parseiam `HH:MM` via `hhToNum`. **Compliance CLT zerou (0 alertas).**

**Arquivos:** `server.js` (defaultClientState +escalaFechada/Historico; geradores de turno; endpoints fechar/reabrir; expor no summary), `public/app.js` (periodoBox + handlers + parsers HH:MM), `public/futuristic.css` (.periodo-box).

**Risco/observação:** o snapshot fechado é "semana padrão" (não datado dia-a-dia); o rótulo do período é só informativo. Se quiser escala por data real (calendário), é evolução futura.

---

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
- `AGENTS.md` — atualizado (TáÓtimo!/Contagil, ordem de leitura, regras, deploy).
- `.ai-context/SYSTEM_CONTEXT.md` — reescrito para o estado real.
- `.ai-context/HANDOFF.md` — este registro.
- `.ai-context/CODEMAP.md` — **NOVO**: mapa completo de funções/endpoints + receita de feature.
- `.ai-context/UPDATE_CHECKLIST.md` — melhorado (validação `node -c`, CODEMAP, regra de inconsistência).
- `.ai-context/README.md` — índice atualizado com CODEMAP e ANALISE-E-ROADMAP.

## Estado da documentação (handoff completo)

Os 4 arquivos pedidos estão atualizados e consistentes com o código em produção:
`AGENTS.md` ✅ · `SYSTEM_CONTEXT.md` ✅ · `HANDOFF.md` ✅ · `UPDATE_CHECKLIST.md` ✅.
Criado `CODEMAP.md` para que qualquer dev/IA ache as funções no `server.js` (3150 linhas, arquivo único).
`ANALISE-E-ROADMAP.md` (raiz) cobre estratégia e próximos passos.

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

## Atualização 2026-06-12

- Regra nova implementada no motor de escala:
  - cobertura agora é distribuída por **setor operacional**;
  - setor com `1` colaborador fica centralizado no miolo do dia;
  - setor com `N` colaboradores distribui `floor(N/2)` na abertura e `floor(N/2)` no fechamento;
  - sobra (setor ímpar) vai para intermediário.
- Preferências explícitas de turno continuam sendo respeitadas antes da distribuição automática.
- Reposição deixou de ser tratada como presença concentrada só no começo do dia:
  - abertura de reposição puxa manhã forte com retorno curto;
  - intermediário cobre manutenção do miolo;
  - fechamento preserva presença no fim do dia;
  - regra legal de intervalo foi revisada pela CLT art. 71: `>4h e <=6h = 15min`, `>6h = mínimo 1h`;
  - não ficou sustentada no texto legal a distinção "homem sem teto / mulher até 2h" usada antes como premissa operacional.

## Atualização 2026-06-12 — intrajornada

- Fonte oficial validada: CLT, art. 71 (`https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm`).
- Ajustes aplicados:
  - `server.js`: `getLegalIntervalMinutes(...)` passou a reger jornada curta e comercial;
  - `server.js`: `distribuirJornada(...)` passou a repetir a redistribuição final até fechar a carga semanal exata do cenário (ex.: 44h trabalhadas), evitando sobras de 43hxx;
  - `server.js`: a cobertura horária agora conta blocos realmente trabalhados (`parseWorkedBlocks`) e respeita intervalos inferidos ou explícitos;
  - `server.js`: snapshots antigos de período fechado passam a derivar `caixaPeople` automaticamente a partir de `setorMap/cargoMap` quando esse recorte não existia salvo;
  - reposição com jornada até 6h deixa de criar partida longa e vira faixa contínua com pausa legal;
  - `public/app.js`: a visualização semanal e os cards do dia agora mostram intervalo de 15min quando a jornada ultrapassa 4h sem passar de 6h, e 1h quando ultrapassa 6h;
  - `public/app.js`: o cabeçalho do colaborador na grade semanal passou a exibir horas trabalhadas com precisão (`44h`, `43h20`) em vez de arredondamento inteiro;
  - `public/app.js`: a grade semanal da aba Escala passou a usar a mesma base da cobertura de caixa (não a escala completa de todos os setores);
  - `public/app.js`: a cobertura da aba Escala passou a recalcular `Caixas ativos` a partir da mesma escala selecionada na tela (rascunho ou período fechado), evitando divergência visual entre cards e heatmap;
  - `public/app.js`: quando a rotina de otimização Tá Ótimo entra em ação, a semana individual das operadoras passa a gerar um preview sincronizado, realocando intervalos de 1h para sustentar a cobertura otimizada;
  - `public/app.js`: ao salvar otimização, a semana individual volta consistente no próximo acesso porque o preview é reconstruído a partir das horas otimizadas salvas.
  - a regra operacional de posicionamento evita intervalo na abertura ou colado no encerramento, puxando a pausa para o miolo da jornada.
- Pendência futura importante:
  - unificar o modelo de persistência/representação dos turnos corridos de caixa, porque hoje a tela reconstrói o intervalo a partir da jornada enquanto alguns setores já salvam a pausa no próprio horário.

## Atualização 2026-06-12 — auditoria escala vs cobertura

- **Bug corrigido: "Caixas ativos" inflados no frontend.** `renderCoverage` (app.js) calculava `min(operadores, disponíveis)` sem considerar PDVs e demanda. Agora aplica `min(operadores, disponíveis, PDVs, demanda)`, espelhando a fórmula do servidor (`recalculateCoverageFromSchedules`).
- **Bug corrigido: otimização salva não alterava a "Semana completa por colaboradora".** O endpoint `/api/save-optimization` salvava apenas os targets de cobertura no `optimizedCoverage`, mas o servidor regenerava a escala do zero a cada request sem redistribuir intervalos. Nova função `applyOptimizationToSchedule` (server.js) agora redistribui os intervalos de almoço dos operadores de caixa para que a contagem hora-a-hora bata com os targets salvos — mesma lógica que o frontend fazia em `optimizePeopleAgainstCoverage`, mas persistida no backend.
- **Bug corrigido: `shiftWorkedHours` ignorava minutos.** Turno `7h20` retornava 7 em vez de 7.33. Agora captura `NNhMM` com a regex `/·\s*(\d+)h(\d{2})?/`.
- Pipeline pós-otimização: (1) redistribui intervalos na escala, (2) recalcula cobertura a partir dos turnos modificados, (3) aplica targets finais.

## Referências

- Roadmap completo e análise vs Blue Yonder: `ANALISE-E-ROADMAP.md`.
- Regras de produto e arquitetura: `.ai-context/SYSTEM_CONTEXT.md`.
