# HANDOFF

> Última sessão: 2026-07-14 (Opus). Leia antes de agir.

## 🏷️ Rebrand: TáÓtimo! → EscalaON (2026-07-14, Opus) — Fase 1 de design

**Por quê:** testes com clientes reais começam em dias; "TáÓtimo!" não sustentava um posicionamento comercial.

**Marca:** `EscalaON` — *uma solução Contagil*. Tagline: "A escala da sua loja sempre no ar — e sempre dentro da lei."
- **Nome vs funcionalidade:** a marca saiu dos nomes de recurso. O motor de otimização virou **"Otimização inteligente"** (neutro); "Motor TáÓtimo" → "Motor de dimensionamento".
- **Identidade:** gradientes teal→azul (visual "SaaS genérico") **eliminados**. Um acento só: **verde-sinal `--on: #00C271`** (= no ar / conforme), + `--alerta` (violação CLT) e `--atencao` (rascunho). Como os tokens `--fx-*` são centralizados, trocar os VALORES re-skinou o produto inteiro sem reescrever os 62KB de CSS.
- **Logo:** o ✓ de "Tá Ótimo" perdeu o sentido. Novo símbolo: ícone de *power* cuja barra são **dois blocos de turno empilhados** (funde ON + escala). Favicon atualizado.
- **Assinatura (`renderBrandStatus` em app.js + `.brand-status` no CSS):** selo no topo que reporta o **estado real** da escala — `Rascunho` (âmbar) · `No ar` (verde, pulsa) · `Bloqueada` (vermelho, quando há violação bloqueante). A marca diz a verdade do sistema.
- **Tipografia:** descoberto que `'Space Grotesk'` é declarada mas **nunca carregada** (sem `<link>`, e o CSP bloqueia fontes externas) → hoje roda no fallback do sistema. Aplicados **numerais tabulares** na grade (horários alinham em coluna). Fonte própria exigiria self-host + ajuste de CSP.

**Arquivos:** `public/index.html`, `public/app.js`, `public/futuristic.css`, `public/colaborador.html`, `server.js` (log), docs.
**Próximo (Fases 2-4 de design):** tela de entrada/login, grade da Escala, repaginada dos demais painéis.

## 🧰 Bloco pré-piloto de design (2026-07-17, Fable) — revisão de web design aplicada

Da revisão de design (persona: gerente 40-60 anos, monitor barato, sala clara), executado o bloco "antes do piloto":
1. **Planta 3D recolhível + lazy** — botão `🗺️ Planta da loja` na Escala (padrão Auditoria/Domingos); `renderStoreFloorMap` saiu do bootstrap e só roda **ao abrir o painel** (sempre de `window.currentSummary`, então nunca fica stale). Era o maior peso de renderização da página.
2. **Primeira meia hora**: badge fixo `PILOTO-CX-2026` removido do popup de conta (código real vem do env `PILOT_INVITE_CODE` — o badge causava "Dados inválidos"); vazios principais (painel ops, setores, forecast-7) ganharam **botão de ação** `irParaAba('implantacao')`; novo **checklist "Primeiros passos"** no topo do Diagnóstico (`renderSetupChecklist`, lê `summary.onboarding` + `escalaFechada`, some quando completo ou sem login).
3. **Piso tipográfico**: 8px→10px (só chips), 9px/10px/10.5px→11px em `styles.css`, `futuristic.css` e inline do `app.js` (118 ocorrências); horário da grade 12.5→13px. Não sobrou nada abaixo de 10px.
**Bloco 2 da revisão (2026-07-17, mesmo dia):**
4. **Impressão reescrita** (handler do `exportSchedule` em app.js): a página antiga tinha cabeçalho verde com texto branco — e navegadores **não imprimem fundos por padrão** → cabeçalho saía invisível. Agora: `@page A4 landscape`, `print-color-adjust: exact`, cabeçalho P&B-safe (texto preto + borda forte + fundo claro), **datas reais nos dias** (via `calendarioSemana`), selo **ESCALA OFICIAL vs RASCUNHO** (`usarFechada`/`fechada.fechadoPor`), nota de conformidade CLT na emissão, **linhas de assinatura** (responsável/emitido por), marca EscalaON·Contagil. Legenda de emojis 🔓🔒 removida (não apareciam nas células).
5. **Skeleton de carga**: placeholders `.sk` pulsantes pré-renderizados no HTML de `#opsDashboard`, `#kpis` e `#weeklySchedule` — os renders sobrescrevem o innerHTML e o skeleton some sozinho (zero JS). `prefers-reduced-motion` respeitado; tema claro coberto.
**Correção pós-teste do usuário:** o botão "Imprimir / Salvar PDF" da janela pop-up não respondia (handler inline em janela `document.write` + pop-up: ambos bloqueáveis pelo navegador). **Arquitetura trocada**: a impressão agora usa **iframe oculto na própria página** (`#escalaonPrintFrame`, `srcdoc`) — clicar em Exportar/Imprimir abre a caixa de impressão **direto** sobre o app (nela também se salva PDF); plano B (se o print do iframe falhar) abre a visualização em nova aba com toast "use Ctrl+P". Verificado com instrumentação no navegador: `print()` dispara ao clicar.
**Pendências restantes**: ícones SVG no lugar de emojis, consulta mobile. Impressão real em A4 P&B ainda precisa de teste físico com dados reais.

## ☁️ `vercel.json` criado para o ambiente de piloto (2026-07-17, Fable)

Objetivo: publicar um **ambiente de piloto isolado** (projeto Vercel próprio, apontando para o Supabase do Jiancarlos), para o cliente testar de fora **sem tocar** em `escala.contagilpb.com.br`.
- O `server.js` **já era compatível** (`module.exports = requestHandler` no fim, para `@vercel/node`).
- **Faltava `vercel.json`**: a produção atual funciona por configuração feita no **painel** da Vercel, que um projeto novo não herda — sem o arquivo, o deploy sobe mas as rotas `/api/*` não respondem. Criado com `builds: [server.js → @vercel/node]` + `routes: [/(.*) → /server.js]` (o próprio server.js já serve `public/`).
- ⚠️ **Atenção no PR**: ao entrar na `main`, este arquivo passa a **reger a produção do Rodrigo**, que hoje depende do painel. O resultado esperado é o mesmo (tudo → server.js), mas é mudança de origem da configuração e precisa da revisão dele.
- Deploy do piloto: importar o repo na Vercel, **fixar a branch de produção em `feature/motor-regras-clt`** e definir `SUPABASE_URL`, `SUPABASE_KEY` (chave **secreta**) e `PILOT_INVITE_CODE` nas env vars do projeto.

## 🔁 Loop de login: portão acoplado ao summary + zero cache-control (2026-07-17, Fable)

Usuário reportou: F5 volta pra tela de login; loga, entra e volta pro login. Backend estava **íntegro** (testado por API: `/api/auth/status` com cookie → `authenticated:true`; `/api/summary` autenticado → 200, inclusive com 14 funcionários). Duas causas estruturais no cliente:
1. **Portão acoplado aos dados**: o `gate.remove()` vivia **dentro do `Promise.all([summary, auth])`**. Qualquer falha do `/api/summary` (erro, timeout, payload grande) impedia o `.then()` de rodar → usuário autenticado **preso na tela de login**. Pior: o `.catch()` existente escrevia o erro na topbar, mas o portão (`z-index: 200`, tela cheia) **cobria a mensagem** — daí o sintoma parecer "voltou pro login". **Fix**: `pedidoAuth` separado; o portão resolve **só** com `/api/auth/status` (com `.catch` próprio). O summary segue no `Promise.all` para o resto da UI.
2. **Estáticos sem `Cache-Control`** (`server.js`): o fallback de arquivos não enviava nenhum header de cache → o navegador aplicava heurística e podia servir `app.js`/CSS **antigos** por horas (é a razão dos "Ctrl+F5" pedidos a sessão toda; em produção, cliente rodaria versão anterior após deploy). **Fix**: `Cache-Control: no-cache, must-revalidate` em html/js/css — revalida sempre, sem proibir o cache. Verificado nos três arquivos.

## 📋 Planilha modelo da equipe agora tem CPF (2026-07-17, Fable)

A importação por planilha **já existia** (aba Implantação, painel "2. Importar equipe") — o pedido do usuário era o **CPF**, que faltava na cadeia inteira. Adicionado ponta a ponta:
- **`server.js`** `normalizeEmployeeRecord`: novo campo `cpf` (só dígitos, 11 chars) — antes o backend nem persistia.
- **`app.js`** `parseEmployeesCsv`: alias `cpf|documento|doc|cpf_funcionario`; nova função **`cpfValido()`** (dígitos verificadores, não só formato) + **detecção de CPF repetido** no mesmo arquivo, com mensagem citando o nome do dono anterior. CPF é **opcional**; se vier, precisa ser válido e único.
- **Modelo** renomeado p/ `modelo-equipe-escalaon.csv`, agora com `nome;cpf;cargo;setor;sexo;horas_semanais;salario`, exemplos realistas (um deles sem CPF, mostrando que é opcional) e **BOM UTF-8** para o Excel não estragar acentos.
- **Grade manual** (`renderEmployeesManager`) ganhou a coluna CPF; `grid-template-columns` do `.emp-row` atualizado (14 colunas).
Verificado no navegador com 5 cenários: CPF formatado, sem formatação, ausente, inválido (rejeita) e duplicado (rejeita citando o primeiro dono). Ida e volta modelo→parser: 3 linhas, 0 erros, acentos e BOM ok.

## 🚪 Página de login (2026-07-17, Fable)

Antes, o visitante caía direto no painel **em modo demonstração** com um popup de auth — péssima primeira impressão para o piloto. Agora existe um **portão de entrada** (`#loginGate` em `index.html`, lógica no bootstrap do `app.js`, estilos `.login-gate`/`.gate-*`):
- Tela cheia (`z-index: 200`) com logo, wordmark, tagline, e-mail/senha e erro inline. Some por `remove()` quando `authState.authenticated`.
- **"Ver demonstração →"** grava `sessionStorage['escalaon-demo']` e dispensa o portão — a demo continua acessível, mas vira **escolha explícita**, não o padrão.
- **"Criar conta"** reaproveita `openAuthDialog('register')` (nada duplicado); o submit reaproveita `POST /api/auth/login`.
- Sem novas rotas no servidor — é um portão de cliente sobre a SPA existente.
Verificado no navegador com conta temporária (criada e apagada): senha errada mostra "E-mail ou senha inválidos" e reabilita o botão; senha certa autentica; recarregando logado o portão não aparece e o checklist/topbar assumem.

**Correção "Not found" ao entrar (mesmo dia):** o usuário reportou tela `Not found` com URL `/?`. Duas causas somadas, ambas corrigidas:
1. **Bug latente no `server.js` (afetava qualquer URL com parâmetro)**: o fallback estático comparava `req.url === '/'` com a **URL crua** — `'/?'` ou `'/?x=1'` não batiam e viravam busca por um arquivo chamado `?` → 404. Agora normaliza: `req.url.split('?')[0].split('#')[0]`. Verificado: `/`, `/?` e `/?teste=1` retornam 200 com o mesmo HTML.
2. **Portão dependia do `/api/summary`**: o `onsubmit` era ligado dentro do `.then()` do bootstrap, então Enter antes da carga (ou falha da API) caía no submit nativo do navegador. Agora o portão é uma **IIFE `initLoginGate()`** que roda na hora, independente de dados; o bootstrap só decide se remove o portão. Defesa extra no HTML (`onsubmit="return false"`) e validação de campos vazios.

## 🔵 Azul vira a cor de marca/interação; verde fica SÓ para estados (2026-07-17, Fable)

Decisão do usuário a partir do sistema fiscal da Contagil (azul `#3B82F6` já era o accent da marca-mãe, registrado no co-branding). Semântica melhorou: antes o verde era marca E sinal de "conforme" (papel duplo).
- **Tokens novos**: `--marca: #3B82F6` (acento) e `--marca-forte: #2563EB` (preenchimento sólido). `--fx-grad-primary → var(--marca-forte)`. `--on` verde permanece **exclusivo** de estados (selo "No ar", conformidade, custo-baixa).
- **Interação em azul**: abas ativas (texto branco), filtros de dia/cenário, `.optimize-button` (tinta azul), glow/borda de hover.
- **Ação primária sólida**: `.optimize-button.save-optimization` agora é azul sólido com texto branco (estilo "Acessar" do sistema Contagil) — hierarquia: sólido = ação principal da tela, outline = secundárias.
- **Assinatura de família**: sidebar **navy escura também no tema claro** (`#1D2940`), como no sistema da Contagil.
- **Logo/favicon**: quadrado azul `#2563EB` com símbolo de power branco. Wordmark "ON" em azul.
- `styles.css`: filtros ativos usam `var(--marca, var(--teal))`.
Verificado nos dois temas via computed styles. Arquivos: `futuristic.css`, `styles.css`, `index.html`.

## 🎨 Paleta "A suave" — conforto para uso prolongado (2026-07-17, Fable)

Contraste do tema escuro recalibrado para sessões longas (medido por luminância WCAG, não a olho):
- **Tokens base (`styles.css`)**: `--canvas #0a0e1a → #151b26` (grafite azulado), `--ink #e8eef5 → #c2cbd8` (**10,5:1** — folga sobre o piso AAA de 7:1 sem vibrar), `--muted #94a3b8 → #8e9cb0` (**6,2:1**), `--sidebar → #111826`, `--teal legado → #00c271` (coerência de marca). `--panel` é translúcido e acompanha o canvas sozinho.
- **Escada de contraste, não número único**: principal ~10,5:1 · secundário ~6,2:1 · dicas ~4,5:1. Decisão registrada: 7:1 exato foi rejeitado como padrão — em sala clara/monitor ruim (realidade do escritório de mercado) fica "lavado", e achata a hierarquia (o secundário cairia abaixo do piso).
- **Ruído visual removido**: auroras de gradiente do body (azul/violeta/teal, off-brand), glow do logo, glow teal de hover (virou anel de 1px).
- **Tema claro (paleta C)**: fundo `#eff2f6`, texto `#0f172a → #26313f` (~12:1), e sinais escurecem no claro (`--on #00A25E`, `--alerta #C23528`, `--atencao #A96F15`) para manter contraste sobre branco.
- Superfícies escuras do editor de turno e do modal CCT acompanharam (`#1d2532`).
Arquivos: `public/styles.css`, `public/futuristic.css` (só CSS — sem mudança de JS/servidor).

**Correção pós-teste (mesmo dia):** o tema claro tinha **cores do escuro vazando** (grade da escala `#b2bdcb`, nomes de eventos, valores da previsão, `.icos-bigval` teal, `.optimize-button` menta — tudo lavado sobre branco). Fixes: (1) tokens `--ink/--muted/--line` agora invertem no bloco `html[data-theme="light"]`; (2) bloco "TEMA CLARO: legibilidade" no fim de `futuristic.css` com as versões escuras dos elementos que carregam cor própria; (3) mutes por `opacity` (`.shift-meta`, `.clt-nota`) viraram cor sólida — opacity multiplica com o fundo e quebra no claro. **Bug junto:** `fd-date` do forecast-7-dias exibia MM/DD (mesma origem do bug do calendário de eventos); corrigido p/ DD/MM em `app.js`.

## 🔐 Endurecimento Supabase: RLS ligado + chave secreta (2026-07-14, Opus)

O verificador do Supabase acusou (com razão) `rls_disabled_in_public` e `sensitive_columns_exposed`. Correção estrutural no ambiente de teste:
- **RLS LIGADO** nas 4 tabelas, **sem políticas** → chave pública fica cega (leitura enxerga 0) e bloqueada (escrita 42501). Verificado com teste real contra a chave publishable antiga.
- Servidor passou a usar a **chave SECRETA** no `.env` — que ignora o RLS. **Zero mudança de código** (`db-supabase.js` usa o que estiver em `SUPABASE_KEY`).
- `setup-meu-supabase.sql` agora **liga** o RLS (ambiente novo já nasce trancado) e o `.env.example` exige a chave secreta.
- ⚠️ **PENDÊNCIA DE PRODUÇÃO (falar com o Rodrigo antes dos pilotos):** o projeto legado (`megimevuyjaevilogepe`) roda com RLS desligado + chave publishable — e essa chave está **hardcoded como fallback em `db-supabase.js`, commitada no repositório**. Endurecer igual: ligar RLS lá, trocar a env do Vercel pela secreta e remover o fallback do código.

## 🧩 Motor de regras CLT/CCT data-driven (2026-06-18, Opus) — Passo 1

**Feito:** trazido o motor de regras do projeto-irmão **EscalaDP** para cá, substituindo o `checkComplianceCLT` heurístico (6 verificações chumbadas) por um motor configurável por dados.
- **Novo `motor-regras.js`** (CommonJS, sem build): PARTE A = motor puro portado de `@escaladp/rules` (helpers de tempo, `diasTrabalhadosPorFuncionario`, 9 regras + `limite_jornada_diaria`, `registry`, `validar`, `validarEscala`, `defaultCctRules`). PARTE B = adaptador workforce-OS (`parseWorkedBlocks` replicado p/ paridade de pausa, `turnoParaMotor`, `semanaPadrao`, `contextoDeEscala`, `checkComplianceCLT`).
- **`server.js`**: `require('./motor-regras')`; `checkComplianceCLT(people, opts)` virou **chamador fino**; o call-site de exibição (em `applyClientState`) passa `{ employees, cctRules, calendarWeek }`; novo campo `cctRules: []` em `defaultClientState` (vazio = catálogo federal; editável no Passo 2).
- **Testes (NOVOS, `node --test`)**: `test/motor-regras.test.js`, `test/adaptador.test.js`, `test/fixtures.js`; script `npm test`. **19/19 verdes**. Antes o projeto não tinha NENHUM teste.
- **Paridade confirmada**: contagem de colaboradores com alerta idêntica à lógica antiga em 5 escalas (6×1 normal, sem folga, 12h, turno partido, 2 colaboradores) → otimizador inalterado.

**Decisões:** motor + adaptador no MESMO arquivo (autossuficiente, testável sem subir o servidor); o adaptador REPLICA `parseWorkedBlocks` do server para a pausa legal bater (turno contínuo >6h não vira falso art. 71); catálogo federal default = 5 regras bloqueantes (44h/sem, interjornada 11h, intra 60min, DSR, 10h/dia); regras de domingo/PEC ficam no `registry`, ativáveis por CCT.

**Limitação conhecida:** o motor opera sobre a "semana padrão" (7 dias). Regras mensais (`limite_domingos_mes`, `rodizio_domingo_feminino`, `folga_compensatoria_domingo`, `ajuda_custo_domingo`) entram **registradas mas inertes** até a escala ser datada por mês (item de roadmap).

**Próximo passo:** Passo 2 — UI para o gestor editar `cctRules` por empresa (params + severidade). Passo 3 — trava de publicação (escala oficial só publica sem violação `bloqueante`), casando com a Fase 1 (publicar/versionar).

**Arquivos:** `motor-regras.js` (novo), `server.js`, `package.json`, `test/*` (novos). No Passo 1, `public/app.js` não mudou (mesmo contrato `{nome, violacoes}`).

## 🔒 Trava de publicação CLT (2026-06-18, Opus) — Passo 3

**Feito:** o fechamento/publicação da escala (`POST /api/escala/fechar`) agora roda o motor (`validarEscala`) antes de congelar o snapshot. Havendo violação **bloqueante**, devolve **422** com a lista de violações e NÃO publica — a menos que o admin reenvie com `forcar: true` (override consciente), publicando **com ressalva** (`snapshot.publicadoComRessalva = true` + `violacoesBloqueantes[]`); o `audit` registra `comRessalva` e a contagem.
- `server.js`: trava no handler `escala/fechar` (carrega `state` antes; `contextoDeEscala` + `validarEscala`; 422 ou ressalva).
- `public/app.js`: handler do botão "🔒 Fechar período" trata `bloqueada` — lista as violações num `confirm()` e oferece "publicar mesmo assim" (reenvia `forcar:true`); toast "COM RESSALVA".
- Teste novo em `test/adaptador.test.js` (escala ilegal bloqueia, normal não). **20/20 verdes**.

**Decisão:** bloqueio com override auditado (não rígido), porque a auditoria é CLT-federal e CCTs locais variam. Avisos (`severidade:'aviso'`) não bloqueiam.

## ⚙️ Editor de regras CLT/CCT por empresa (2026-06-18, Opus) — Passo 2

**Feito:** o admin/dono da empresa agora **edita as regras** (valores e severidade) por uma tela, sem código. `clientState.cctRules` deixa de ser sempre vazio.
- `motor-regras.js`: `catalogoRegras()` (10 tipos com label/baseLegal/escopo/params/`ativaPadrao`) + `sanitizarRegras()` (coage/valida a entrada contra o catálogo).
- `server.js`: `summary.cctConfig = { catalogo, regras, usandoPadrao, podeEditar }` (em `applyClientState`); novo `POST /api/cct/save` (admin/dono; `{reset:true}` volta ao federal, senão `sanitizarRegras`; audit `CCT_SAVED`).
- `public/app.js`: botão `⚙️ Regras CLT/CCT` na caixa de conformidade (só se `podeEditar`) + `renderCctEditor()` (modal: ativa/params/severidade por regra; Salvar / Restaurar padrão / Cancelar) → `POST /api/cct/save` + reload.
- `public/futuristic.css`: estilos `.cct-modal-*`/`.clt-config-row` (tema escuro + override claro).
- Testes novos (catálogo, saneamento, comportamento data-driven). **24/24 verdes**.

**Decisões:** edita o **admin da empresa** (mesma permissão de fechar período). `ativaPadrao` deixa só as 5 regras federais ativas por default (as de domingo/PEC entram desligadas, pra não mudar o comportamento atual nem poluir com avisos). Regras inativas seguem salvas (params preservados) e são filtradas por `normalizarRegras` em runtime.
**Próximo passo:** presets de CCT por região (clonar); regras por loja; escala mensal datada (ativa as regras `escopo:'mes'`).

## 🩹 Correções pós-teste (2026-06-18, Opus) — Passo 4

Teste real (14 funcionários) revelou 3 inconsistências + 1 falso positivo. Corrigidos:
- **`intrajornada_min`** (bug do Passo 1): comparava a duração BRUTA (com a pausa dentro) vs 6h → falso *"6.3h exige 60min"* em turno legal de 6h+15min. Agora usa a jornada **TRABALHADA** (bruta − intervalo). Casos de borda testados.
- **Avisos separados de violações** (`separarViolacoes` em `motor-regras.js`): `checkComplianceCLT` volta **só as BLOQUEANTES** (não infla o "N com alerta" nem penaliza o otimizador); avisos (ex.: ajuda de custo de domingo) saem em `summary.complianceAvisos` e aparecem numa **linha azul informativa** na caixa (não vermelha). Snapshot de período fechado também guarda `avisos`.
- **Cartão "Conformidade CLT" (weekComparison)**: lia `summary.complianceCLT` antes de ele existir (bug antigo → sempre "Ok"). Agora o cartão usa o mesmo `compliance.length` da caixa (no frontend) → nunca mais divergem.
- **Selo "X/Y conformes"**: renomeado para **"X/Y na meta de horas"** (mede meta de horas+folgas, não CLT) + tooltip.

Testes: **27/27 verdes**. Arquivos: `motor-regras.js`, `server.js`, `public/app.js`, `public/futuristic.css`, `test/motor-regras.test.js`.

## 🔎 Auditoria de consistência de dados (2026-06-13, Opus) — planta + motores

Foco: garantir que dados dependentes/cálculos/regras estão corretos e interligados. Bugs encontrados e corrigidos em `public/app.js` (`renderStoreFloorMap`):

1. **Minutos truncados na planta (parseRanges).** Usava `parseInt('13:20')→13`, descartando minutos. Turnos em `HH:MM` perdiam até 59min → headcount horário, `isWorking`/`isOnBreak`, contagens e timeline (passos de 30min) ficavam errados na fronteira. **Fix:** `parseRanges` agora usa `hhToNum` (fracionário), igual ao resto do app.
2. **Motor de realocação sem regra de habilidade.** Sugeria mover qualquer pessoa de qualquer zona com excedente para qualquer déficit (ex.: caixa → açougue). **Fix:** mapa `ZONE_COMPAT` — especialistas (açougue/padaria/frios) não recebem realocação cruzada; frente de caixa/mercearia/hortifruti só puxam do pool flexível (gôndola/repositor, recebimento, comercial/apoio). Recebimento entrou como fonte de excedente (livre à tarde).
3. **Card do motor de necessidade incoerente.** Mostrava `escalados(hora) / necessário(dia) · saldo(equipe total−dia)` — 3 bases diferentes, podendo exibir "2 ativos · +1 excedente". **Fix:** numerador agora é a **equipe total do setor** (= necessário + saldo, coerente); "ativos neste horário" virou nota separada. `zoneStatus` retorna `equipe`.
4. **Recebimento exibia status da mercearia.** `ZONE_TO_SETOR.recebimento='mercearia'` mostrava o déficit da mercearia na doca, mas o pessoal do recebimento não está no headcount da mercearia. **Fix:** recebimento/escritório/comercial → `null` (sem badge falso).
5. **Planta perdia setores em período fechado.** `getSelectedCashierScenario` prefere `caixaPeople` (só caixa) quando há escala fechada — correto p/ aba Escala, mas a planta mostrava só caixas. **Fix:** a planta agora prefere `escalaFechada.people` (conjunto completo, que o snapshot já guarda).

**Não-bugs confirmados (semântica intencional):** `activePdvs=min(operadores,PDVs)` na planta (mostra PDV com operador) ≠ cobertura da aba Escala que aplica `min(...,demanda)` — views distintas, ok. Resumo recalcula tudo por request (documentado, sem O(n²) novo). CLT art.71/44h/interjornada já auditados em sessões anteriores.

---

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
- **O `.ai-context/` estava DEFASADO**: descrevia "Workforce OS" provando frente de caixa, com suspeita de demo. O código real já é **EscalaON (solução Contagil)** com multiempresa, gestor de módulos, ICOS por mercadológico, 3 jornadas, compliance CLT, forecast, banco de horas, what-if, self-service, painel operacional. `SYSTEM_CONTEXT.md` foi reescrito para a realidade nesta sessão.

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
- `AGENTS.md` — atualizado (EscalaON/Contagil, ordem de leitura, regras, deploy).
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
  - `public/app.js`: quando a rotina de otimização EscalaON entra em ação, a semana individual das operadoras passa a gerar um preview sincronizado, realocando intervalos de 1h para sustentar a cobertura otimizada;
  - `public/app.js`: ao salvar otimização, a semana individual volta consistente no próximo acesso porque o preview é reconstruído a partir das horas otimizadas salvas.
  - a regra operacional de posicionamento evita intervalo na abertura ou colado no encerramento, puxando a pausa para o miolo da jornada.
- Pendência futura importante:
  - unificar o modelo de persistência/representação dos turnos corridos de caixa, porque hoje a tela reconstrói o intervalo a partir da jornada enquanto alguns setores já salvam a pausa no próprio horário.

## Atualização 2026-06-12 — auditoria escala vs cobertura

- **Bug corrigido: "Caixas ativos" inflados no frontend.** `renderCoverage` (app.js) calculava `min(operadores, disponíveis)` sem considerar PDVs e demanda. Agora aplica `min(operadores, disponíveis, PDVs, demanda)`, espelhando a fórmula do servidor (`recalculateCoverageFromSchedules`).
- **Bug corrigido: otimização salva não alterava a "Semana completa por colaboradora".** O endpoint `/api/save-optimization` salvava apenas os targets de cobertura no `optimizedCoverage`, mas o servidor regenerava a escala do zero a cada request sem redistribuir intervalos. Nova função `applyOptimizationToSchedule` (server.js) agora redistribui os intervalos de almoço dos operadores de caixa para que a contagem hora-a-hora bata com os targets salvos — mesma lógica que o frontend fazia em `optimizePeopleAgainstCoverage`, mas persistida no backend.
- **Bug corrigido: `shiftWorkedHours` ignorava minutos.** Turno `7h20` retornava 7 em vez de 7.33. Agora captura `NNhMM` com a regex `/·\s*(\d+)h(\d{2})?/`.
- Pipeline pós-otimização: (1) redistribui intervalos na escala, (2) recalcula cobertura a partir dos turnos modificados, (3) aplica targets finais.

## Atualização 2026-06-13 — planta isométrica completa + todos os setores

### Planta isométrica da loja (`renderStoreFloorMap` em app.js)
- **Zonas desenhadas em 3D isométrico**: Checkouts/PDVs (frente), Gôndolas com prateleiras e produtos coloridos (centro), Açougue (fundo esq, vermelho), Padaria (fundo centro, laranja), Frios (fundo dir, azul), Hortifruti (lateral esq, verde), Bebidas (lateral dir, azul claro), **Recebimento/Doca** (fundo dir, marrom, com plataforma de descarga), **Escritório** (prédio separado à direita, roxo, com 4 mesas).
- **Operadores de caixa posicionados 1:1 em cada PDV** — PDV ativo (verde) vs inativo (cinza). Extras além do nº de PDVs ficam como auxiliares.
- **Repositores nos corredores** entre gôndolas (3 faixas de circulação), nunca sobre as prateleiras.
- **Detecção automática de zona** via `zoneOf(nome)`: analisa `setorMap + cargoMap` com keywords (açougue/carnes, padaria/confeitaria, repositor/mercearia, recebimento/estoque/doca, administrativo/RH/financeiro/DP, etc).
- **Ícones com alto contraste**: corpo com borda branca, iniciais com sombra, nome com fundo (pill bg) adaptado light/dark, truncado em 8 chars.

### Timeline interativa
- **Horário grande** (22px bold) com botões ◀ ▶ (±30min).
- **Marcadores de hora** a cada 2h com ticks menores nas ímpares.
- **Bolinha azul arrastável** (#2563eb) com borda branca e sombra — suporta drag mouse e touch.
- **Barras de turno** coloridas por zona sobrepostas no trilho.
- **Botão Simular**: animação automática (400ms steps de 30min).
- **Seletor de dia**: botões Seg-Dom com destaque forte azul/branco/negrito no selecionado.

### Stats do cockpit (7 cards)
No salão · PDVs (ativos/total) · Escritório · Recebimento · Intervalo · Folga · Total ativos. Formação detalhada por zona.

### Modelo de reposição exclusivo (server.js)
- **`REPLENISHMENT_DEMAND_CURVE`**: curva de demanda invertida do caixa — manhã forte (recebimento, peso 1.5), meio-dia baixo (0.7), pré-pico tarde (1.3).
- **`bestReplenishmentSlots(open, close, N, jornada)`**: algoritmo greedy que seleciona N horários de início maximizando cobertura ponderada + espalhamento (`minGap = max(1.5, span/N)`).
- **`generateReplenishmentShift(...)`**: turno repositor com pausa no ponto médio da jornada individual, respeitando CLT art. 71 (maxCont = 5h40).

### Correção: todos os setores na escala
- `fullSchedule`, `employeeSetorMap`, `employeeCargoMap` movidos para FORA do `if (caixaEmployees.length >= 1)` — agora geram para TODOS os empregados.
- Frontend (`getSelectedCashierScenario`) agora prefere `fullSchedule` sobre `weeklyScenarioSchedule`.

### UX da aba Escala
- Colunas sticky (nome + cargo fixos ao rolar).
- Destaque do dia de hoje na grade.
- Datas no cabeçalho.
- Formato HH:MM nos turnos.

## Atualização 2026-06-12 — deficit sábado fechadores

- **Bug corrigido: déficit 06-12h no sábado.** Com 2 de 5 operadoras configuradas como "fechamento" (Girlene e Thais), ambas começavam às 10h+, deixando apenas 3 caixas nas 6h de pico (06-12h) quando o target era 4.
- **Fix:** `generateScheduleByProfile` agora identifica todos os fechadores explícitos (`idxFechadores`). Em dias de pico (sex/sáb), apenas o último (`idxFechadorPrimario`) mantém o turno de fechamento; os demais são redirecionados para a abertura com offset escalonado (0.5h entre cada).
- **Resultado:** 4 caixas cobertos 06-12h (target atingido). Déficit residual 13-18h (1 pessoa vs target 2) é **estrutural** — 5×7h20=36h40 disponíveis vs ~39h requeridas. Resolver requer contratação ou redução de targets.
- Em dias normais (seg-qui), fechadores mantêm o turno de fechamento normalmente.

## Atualização 2026-06-12 — pico sex/sáb + art. 71 + revisão Blue Yonder

- **Regra de pico consolidada (sex/sáb):** só 1 fechador(a) mantém o turno de fechamento; fechadores extras viram cobertura de manhã. `peakShift` calcula entrada e intervalo juntos: intervalos espaçados de 1h entre operadores, começando após a chegada da fechadora; entrada escalonada para que ninguém exceda **5h40 contínuas** (6h do art. 71 − 20min de margem).
- **Jornada variável:** teto diário 9h (`distribuirJornada` e `shiftHours`). Distribuição típica 44h/6x1: seg-qui ~6h40, sex ~8h20, sáb 9h. Compensação semanal dentro das 44h (art. 59 §2º).
- **Limite contínuo corrigido:** era 6h→ entendido errado como 5h; confirmado no art. 71 que o teto é 6h. `maxAntes = 340min` (5h40) em `parseWorkedBlocks` (server), `app.js` e `applyOptimizationToSchedule`.
- **Compliance ampliado:** `checkComplianceCLT` agora detecta (5) bloco contínuo >6h sem intervalo — art. 71; (6) jornada diária >10h — art. 59. Antes mostrava "Conforme" mesmo com 7h contínuas.
- **`applyOptimizationToSchedule`:** janela de realocação do intervalo agora limitada para nunca criar bloco >5h40 (antes permitia mover a pausa até 3h do fim, criando blocos de 7h).
- **Revisão comparativa Blue Yonder — lacunas RESOLVIDAS em 2026-06-12:**
  - **Erlang-C implementado** (`erlangCWaitProbability`, `erlangAgentsNeeded` em server.js): `cashierLoadForHour` agora dimensiona por `max(carga média ×1.05, Erlang-C com espera-alvo 3min)` e a fila estimada (`filaMin`) sai do modelo M/M/N com os caixas realmente escalados (15min se saturado). Novos campos: `operadoresCarga`, `operadoresErlang`.
  - **Rodízio de domingo (Lei 10.101)**: em loja aberta no domingo, cada colaborador(a) folga no domingo 1 vez a cada 3 semanas (`(idx + weekSeed) % 3 === 0`, weekSeed = semana-calendário → rotaciona sozinho a cada semana). Domingo de folga conta como DSR e reduz as folgas de seg-qui (`folgasAdicionaisEmp`).
  - **Otimização greedy melhorada**: `applyOptimizationToSchedule` processa as horas em ordem decrescente de déficit (pior buraco primeiro), não mais em ordem arbitrária.
  - **Disclaimer CCT** no box de compliance (app.js): auditoria cobre CLT federal; CCTs locais podem ter regras extras.
  - Lacuna restante (roadmap): escala semanal padrão vs calendário datado (feriados, semanas específicas); solver global (MIP) vs heurística.

## Atualização 2026-06-12 — FASE 2 (solver + calendário datado)

- **Solver de escala (busca local / coordinate descent)**: `applyOptimizationToSchedule` deixou de ser greedy de mover pausas. Agora otimiza **(entrada, intervalo)** de cada operadora em conjunto: custo = déficit de cobertura ×100 + deslocamento da escala original (entrada 1/h, pausa 0,1/h). Candidatos já nascem legais (blocos ≤5h40, ≥2h em cada ponta da pausa, turno dentro do expediente). Converge em ≤8 passadas. No cenário real do sábado reduziu os déficits de 2 → 1 (somente 06-07h, estrutural com 5 pessoas) e descobriu sozinho segurar uma operadora até 17:30 p/ cobrir o fim do dia.
- **Bug corrigido**: turnos com pausa explícita (`08:00-12:00/13:00-17:00`) tinham a pausa recalculada por fórmula; agora a pausa real do turno é lida da string.
- **Calendário datado**: `buildCalendarWeek()` (server.js) expõe `summary.calendarioSemana` = semana corrente seg→dom com datas reais e **feriados nacionais** (fixos + móveis via Páscoa/Meeus: Carnaval, Sexta Santa, Corpus Christi). Frontend: datas sob cada dia no cabeçalho da escala + aviso quando a semana tem feriado.
- Próximo da Fase 2 (não feito): demanda diferenciada em feriado (hoje só sinaliza); escala persistida por data específica (hoje a semana-calendário é informativa); solver multi-dia/multi-setor.

## Referências

- Roadmap completo e análise vs Blue Yonder: `ANALISE-E-ROADMAP.md`.
- Regras de produto e arquitetura: `.ai-context/SYSTEM_CONTEXT.md`.
