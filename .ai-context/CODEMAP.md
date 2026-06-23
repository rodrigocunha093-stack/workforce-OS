# CODEMAP — onde está cada coisa

> `server.js` tem ~3150 linhas num único arquivo (HTTP puro, sem framework).
> Os números de linha são aproximados (mudam a cada edição) — use o nome da função no grep.
> Atualizado em 2026-06-13.

## Arquitetura em 1 parágrafo

Browser → `public/index.html` + `app.js` (SPA vanilla) chamam `GET /api/summary` → `server.js` monta um objeto `summary` gigante → `app.js` renderiza cada aba a partir desse objeto. Persistência de cliente em Supabase (`db-supabase.js`). Tudo do cliente vive em **um JSONB** (`clients.data`) por `orgId`.

## server.js — blocos

### Infra / segurança (linhas ~70–160)
`audit`, `requestIp`, `requireSameOrigin`, `enforceRateLimit`, `securityHeaders`, `validateEmail/Password/Name`, `sanitizeString`.

### Estado do cliente (linhas ~160–310)
- `defaultClientState()` — **a forma canônica do JSONB do cliente**: `{ profile, employees[], salesRows[], salesByMercadologico[], skillMatrix, optimizedCoverage, enabledModules[], updatedAt }`. Adicione campos novos AQUI.
- `loadClientState(orgId)` / `saveClientState(orgId, state)` → `db-supabase`. **Sempre por `user.orgId`**, nunca por userId.
- `hashPassword`, `verifyPassword`, `createSession`, `clearSession`, `authenticatedUser(req)`.

### Cálculo de caixa / ICOC (linhas ~324–420)
`purchaseClass`, `paymentProfile`, `operationalFactors`, `queueStatus`, **`cashierLoadForHour(...)`** — o coração do ICOC (minutos, fila, operadores recomendados por hora). `buildCoverage`.

### Classificação de setor/cargo (linhas ~200–245, ~1000–1025, ~1360–1430)
- `isOperadorCaixa(emp)` — quem entra na escala de caixa.
- `mercadologicoParaSetor` / `empSetorOperacional` — m2 → setor operacional.
- `isReposicao`, `isCargoComercial` — definem o **tipo de jornada**.
- `matrizProdutividade(merc)` — benchmarks por mercadológico.

### Geração de ESCALA (linhas ~1421–1885) — núcleo do produto
- `generateOperatorShift` — turno corrido "06-14 · 8h".
- `generateComercialShift` — turno centralizado 08-17 (apoio/admin/cargo único).
- `generateRepositorShift` — LEGADO, substituído por `generateReplenishmentShift`.
- `REPLENISHMENT_DEMAND_CURVE` — array {start, end, weight} para demanda de reposição por hora.
- `replenishmentWeight(hour)` — retorna peso da curva para hora dada.
- `bestReplenishmentSlots(open, close, N, jornada)` — greedy: seleciona N horários de início maximizando cobertura ponderada + spread (`minGap = max(1.5, span/N)`).
- `generateReplenishmentShift(open, close, idx, N, sexo, jornada)` — turno repositor com pausa no midpoint, CLT art.71 (maxCont=5h40).
- **`generateScheduleByProfile(profile, employees, targetHours, targetDaysOff)`** — gera os 7 turnos de cada pessoa. Aqui estão: turno preferencial, folga, domingo, **abridor/fechador garantidos** (idx 0 abre, idx N-1 fecha), distribuição uniforme de flexíveis.
- **`generateGroupedSchedule(...)`** — agrupa por **CARGO** e chama a anterior por grupo (revezamento entre intercambiáveis).

### Dashboards / inteligência (linhas ~1027–1550)
- `buildForecast` — sazonalidade + próximos 7 dias + eventos.
- `buildBancoHoras` — saldo escala vs contrato.
- `buildOperationalDashboard` — painel da home (faturamento, headcount, pico, perdas, multifuncionalidade, tendência).
- `buildSetorDashboard` — **ICOS por mercadológico m2** (venda × equipe fracionada, curva por dia da semana).
- `buildOptimizationSavings` — operação real vs otimizada (economia).
- `checkComplianceCLT(people, opts)` — **chamador fino** de `motor-regras.js` (motor data-driven). `opts = { employees, cctRules, calendarWeek }`. Mantém o formato de saída `[{nome, violacoes}]`.

### Montagem do summary (linhas ~2042–2560) — o pipeline
- `loadModelSalesRows` / `applySalesRowsToSummary` — **dados-modelo (DEMO, só sem login)**.
- **`applyClientState(summary, user, weekFilter)`** — pega `clientState` real e injeta TUDO no summary (perfil, escalas, ICOS, dashboards, compliance, forecast, banco). É o ponto onde "dados reais" entram. `weekFilter` filtra `salesRows` por semana do mês.
- `summaryForWeek` — variação por semana (legado; hoje o filtro real é via `applyClientState(weekFilter)`).
- **`summaryFromDatabase(user, weekFilter)`** — decide demo vs real. `db.status()` é stub (`connected:false`), então cai no branch demo, MAS se `user` existe chama `applyClientState` (real). Sem user = dados-modelo.

### Endpoints HTTP (linhas ~2560–3150) — `http.createServer`
| Rota | O quê |
|------|-------|
| `GET /api/summary` | objeto completo do dashboard |
| `GET /api/summary/week/:n` | summary filtrado pela semana do mês |
| `GET /api/auth/status` | sessão atual |
| `POST /api/auth/register\|login\|logout` | autenticação |
| `POST /api/onboarding` | salva perfil da loja |
| `POST /api/employees/save` | gestão manual de equipe (com mercadológicos) |
| `POST /api/import-sales` | importa VRSoft (caixa) |
| `POST /api/import-mercadologico` | importa vendas por departamento |
| `POST /api/save-skills` | matriz de resiliência |
| `POST /api/save-optimization` | escala otimizada salva |
| `GET /api/company/info` · `POST /api/company/add-member` | multiempresa |
| `GET /api/gestor/orgs` · `POST /api/gestor/set-modules` | painel do gestor (módulos por empresa) |
| `POST /api/whatif` | simulador what-if |
| `POST /api/colaborador/escala` | self-service (público, por orgCode+nome) |
| fallback | serve arquivos de `public/` (com proteção path traversal) |

## public/app.js — renderização

- Topo: toggle de tema (IIFE) + tabs.
- `renderOpsDashboard` (painel home), `renderKpis`, `renderEnterpriseReadiness`, `renderSetorDashboard` (ICOS), `renderScenarios`, `renderCoverage`, **`renderStoreFloorMap`** (planta isométrica 3D — 9 zonas, workers por PDV/corredor, timeline com bolinha, stats cockpit), **`renderWeeklySchedule`** (escala + compliance + 🔓/🔒 + export), `renderEmployeesManager` (equipe + multi-seleção mercadológico), `renderGestorPanel`, `renderCompanyInfo`.
- `renderStoreFloorMap` internals: `buildSvg()` (gera SVG isométrico), `isoX/isoY/isoRect/isoBox/isoLabel/isoWorker` (projeção isométrica), `zoneOf(nome)` (detecta zona por setor/cargo), `parseRanges/isWorking/isOnBreak` (status do turno na hora). State: `_floorDay`, `_floorHour`, `_floorPlaying`, `_floorTimer`.
- `getSelectedCashierScenario` — prefere `fullSchedule` (todos setores) sobre `weeklyScenarioSchedule` (só caixa).
- Bloco final (`Promise.all([/api/summary, /api/auth/status])`) chama todos os `safeRender(...)`. `safeRender` isola erros por aba.
- `applyEnabledModules` esconde abas não liberadas pelo gestor.

## db-supabase.js

CRUD via `@supabase/supabase-js`. **Colunas em minúsculo** (`passwordhash`, `orgid`, `orgcode`, `userid`, `updatedat`...). Funções: `getUser/ById/ByOrgCode`, `createUser`, `saveSession/getSession/deleteSession`, `saveClientData/getClientData`, `listOrgMembers`, `listAllOrgAdmins`, `auditLog`.

## Como adicionar uma feature (receita)

1. Campo novo no cliente → `defaultClientState()`.
2. Endpoint para salvar → novo `if (req.url === ...)` perto dos outros POST.
3. Cálculo → função `buildXxx(...)` e chamada dentro de `applyClientState`.
4. Expor no summary → `summary.xxx = ...` em `applyClientState`.
5. Render → função `renderXxx(data)` em `app.js` + `safeRender('xxx', ...)` no bloco final.
6. CSS → `public/futuristic.css` (tema escuro é base; ver bloco `html[data-theme="light"]` para o claro).
7. Teste via API com cookie de sessão (ver exemplos no HANDOFF).
8. `git push origin main` → deploy Vercel automático.

## Arquivos-chave do repo

- `server.js` — backend inteiro.
- `motor-regras.js` — **motor de regras CLT/CCT** (data-driven). PARTE A: motor puro portado de `@escaladp/rules` (`registry`, `validar`, `validarEscala`, `defaultCctRules`, 10 regras). PARTE B: adaptador workforce-OS (`contextoDeEscala`, `checkComplianceCLT`, `turnoParaMotor`, `parseWorkedBlocks`, `semanaPadrao`). PARTE C: catálogo para a UI (`catalogoRegras`) + saneamento (`sanitizarRegras`). Sem build; testado em `test/`. Editor no frontend: `renderCctEditor` (app.js); endpoint `POST /api/cct/save`; trava de publicação usa `validarEscala` no handler `escala/fechar`.
- `test/` — suíte `node --test` (`npm test`): `motor-regras.test.js`, `adaptador.test.js`, `fixtures.js`.
- `public/index.html` `app.js` `styles.css` `futuristic.css` — frontend.
- `public/colaborador.html` — self-service.
- `db-supabase.js` — persistência (real). `db.js` — stub.
- `create-tables.sql`, `add-organization.sql` — schema Supabase.
- `ANALISE-E-ROADMAP.md` — visão estratégica e roadmap.
- `.ai-context/` — esta memória compartilhada.
