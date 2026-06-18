# SYSTEM CONTEXT

> Atualizado em 2026-06-13. Este arquivo descreve o estado REAL do produto.
> Se o código divergir daqui, o código manda — corrija este arquivo.

## Produto

- **Nome de marca:** `TáÓtimo!` — *uma solução Contagil* (co-branding aplicado no header/footer).
- **Nome técnico/legado:** Workforce OS para Supermercados.
- **Tagline:** "Inteligência de escala para o varejo".
- **Posicionamento:** o "Blue Yonder do supermercado regional brasileiro" — 80% do valor por 5% da complexidade. Foco em CLT/CCT, jornada partida, mercadológico, cultura operacional nacional.

## Publicação e infraestrutura

- Domínio: `https://escala.contagilpb.com.br` (no ar; `www.` ainda não configurado no Vercel+Cloudflare).
- Deploy: Vercel, projeto `mvp-web-proprio`. Push em `main` → deploy automático.
- Persistência e autenticação: **Supabase via REST** (`@supabase/supabase-js`), NÃO conexão PostgreSQL direta.
- Repositório: GitHub `rodrigocunha093-stack/workforce-OS`.

## Stack atual

- Node.js, servidor HTTP puro em `server.js` (sem framework).
- Frontend estático vanilla: `public/index.html`, `public/app.js`, `public/styles.css`, `public/futuristic.css`.
- `public/colaborador.html` — página pública de autoatendimento do colaborador.
- `db-supabase.js` — TODA a persistência real (users, sessions, clients, audit) via Supabase REST.
- `db.js` — **STUB**. Retorna `{ connected:false, mode:'rest' }`. Não conecta a Postgres direto. Mantido só por compatibilidade de assinatura; o resumo NÃO depende mais dele para dados de cliente.
- Variáveis no Vercel: `SUPABASE_KEY`, `PGHOST/PGPORT/...` (legado), `PILOT_INVITE_CODE`.

## Colunas Supabase (atenção: minúsculas)

PostgreSQL converte identificadores não-aspeados para minúsculo. `db-supabase.js` mapeia:
`passwordhash, passwordsalt, invitecode, orgid, orgcode, role, userid, expiresat, updatedat`.
Tabelas: `users, sessions, clients (data JSONB), audit`. RLS **desabilitado** (acesso via service/anon key controlado na app).

## Multiempresa e papéis

- Cada empresa = `orgId`. `clientState` é salvo/lido por **orgId** (não por userId) → membros compartilham dados.
- `orgCode` (ex: `EMP-XXXXXX`) usado para vincular novos membros e para o self-service do colaborador.
- Papéis: `gestor` (super-admin do produto, controla módulos por empresa), `admin` (dono da empresa, cria membros), `membro`.
- Gestor: login `gestor@workforce.com`. Vê aba "★ Gestor" que liga/desliga os 10 módulos por empresa (controle comercial de planos).

## Módulos (10) — controláveis pelo gestor

1 Diagnóstico · 2 Escala (ex-"6x1 vs 5x2") · 3 Domingos · 4 Auditoria · 5 Controlador · 6 Financeiro · 7 Resiliência · 8 Setores · 9 Memória · 10 Implantação.

## Direção de produto

### Pilar 1 — Frente de caixa (foco principal do MVP)
Responde: quantos operadores, em quais horários/dias, risco de fila, custo/impacto da jornada, ociosidade para apoio. Base = importação **VRSoft** (cupom a cupom) → ICOC por hora.

### Pilar 2 — Gestão operacional
Reforço de cobertura, folgas, domingos, banco de horas, multifuncionalidade, risco trabalhista (compliance CLT).

### Pilar 3 — Expansão por setor (JÁ INICIADA)
Importação **mercadológico** (m1/m2) → **ICOS por mercadológico** (Açougue, Reposição/Mercearia, Padaria, Hortifruti, Frios, Congelados). Cada colaborador vincula-se a mercadológicos via multi-seleção (checkbox); setor operacional é derivado.

## Regras de negócio consolidadas (NÃO QUEBRAR)

- **Operadores ≠ PDVs** — conceitos separados. Caixas ativos = `min(operadores trabalhando, PDVs, demanda)`. PDV é gargalo físico.
- **Cobertura horária da frente de caixa** deve sair da mesma base da escala semanal da aba Escala:
  - a contagem respeita blocos realmente trabalhados;
  - intervalos/jornada partida não contam como presença;
  - a linha da cobertura mostra caixas efetivamente abríveis (`min(pessoas ativas, PDVs, demanda)`), não apenas pessoas escaladas no dia.
- **Domingo configurável** — loja pode fechar domingo; domingo fechado conta como 1 folga (6x1 não gera folga extra na semana).
- **Folga nunca em sexta/sábado** (dias de maior movimento). Permitidas seg–qui (e domingo se aberto).
- **3 tipos de jornada por cargo:**
  - *Corrida* (caixa, açougue): turnos escalonados no grupo; na leitura operacional, a pausa segue o art. 71 da CLT (`>4h e <=6h = 15min`, `>6h = mínimo 1h`).
  - *Reposição* (modelo exclusivo): curva de demanda invertida do caixa (`REPLENISHMENT_DEMAND_CURVE`: manhã forte 1.5, meio-dia 0.7, pré-pico 1.3). Algoritmo greedy `bestReplenishmentSlots` seleciona N horários de início maximizando cobertura ponderada + espalhamento. Pausa no ponto médio da jornada individual. CLT art. 71 (maxCont = 5h40).
  - *Comercial* (apoio/admin OU cargo único no grupo: conferente, motorista, financeiro...): turno centralizado no miolo do dia, com intervalo calculado pela mesma régua legal.
- **Cobertura por SETOR operacional**: o motor divide a equipe do setor em abertura e fechamento. Regra padrão:
  - setor com 1 colaborador: jornada centralizada no miolo do dia;
  - setor com N colaboradores: `floor(N/2)` fixos na abertura, `floor(N/2)` fixos no fechamento;
  - sobra (quando N é ímpar): vai para intermediário.
- Preferências explícitas de turno ainda valem; a distribuição automática completa o restante.
- **Cobertura garantida:** todo grupo tem abridor (🔓) e fechador (🔒). Reposição tem noturno que fecha (organiza a loja). Indicadores 🔓/🔒 na escala.
- **Semana do mês** (1–5) filtra os dados reais do cliente por período; semana forte costuma cair entre dias 25–05.
- **Sexta e sábado** têm tratamento próprio de cobertura.

## Inteligência já entregue

- **Painel Operacional** (aba Diagnóstico): faturamento dia/semana/mês, dimensionamento (1 colab/R$36,5k), pico de fluxo, perdas (ruptura/validade/abandono), multifuncionalidade, tendência, forecast 7 dias (sazonalidade), banco de horas, **What-if**.
- **Planta isométrica inteligente**: mapa 3D isométrico da loja com 9 zonas (checkouts, gôndolas, açougue, padaria, frios, hortifruti, bebidas, recebimento/doca, escritório). Operadores posicionados 1:1 em cada PDV, repositores nos corredores entre gôndolas. Timeline com bolinha arrastável, marcadores de hora, botões ◀▶, animação, seletor de dia. Stats: no salão, PDVs ativos, escritório, recebimento, intervalo, folga, total ativos. Detecção automática de zona por setor/cargo.
- **ICOS** (aba Setores): venda × equipe por mercadológico, produtividade, status de carga, curva por dia da semana, matriz de benchmarks.
- **Compliance CLT** (aba Escala): agora via **motor de regras data-driven** (`motor-regras.js`, portado do EscalaDP) — interjornada 11h, intra art.71, DSR, máx 44h/sem, máx 10h/dia, e regras de domingo/PEC prontas no registry para configuração por CCT. Catálogo default = CLT federal; campo `clientState.cctRules` (vazio = default) abre caminho para edição por empresa (Passo 2). Testado em `test/` (`npm test`).
- **Export** imprimível da escala + **self-service** do colaborador (`/colaborador.html`).
- **Otimização TáÓtimo!** (ex-"Blue Yonder"): cobre déficit respeitando PDVs/equipe, salvável.
- Tema **claro/escuro** (toggle, alinhado à Contagil).

## Estado técnico importante

- **Dados de cliente logado SÃO reais** (Supabase). O badge "fonte de dados" foi corrigido em 2026-06-11 para não exibir falso "demonstração" quando há login (antes só reconhecia `mode:'postgresql'`).
- Modo demonstração legítimo só ocorre **sem login** (dados-modelo VRSoft via `loadModelSalesRows`).
- `summary.staffSchedule` / `fullSchedule` são **recalculados a cada request** — não há escala "publicada/versionada" persistida ainda (ver roadmap Fase 1 em `ANALISE-E-ROADMAP.md`).

## Roadmap (resumo) — detalhe em `ANALISE-E-ROADMAP.md`

- Fase 1 (parcial): compliance CLT ✅, export ✅; falta **publicar/versionar escala**.
- Fase 2: forecast sazonal ✅, banco de horas ✅; evoluir para mediana + eventos persistidos.
- Fase 3: self-service consulta ✅; falta pedido de troca/folga com aprovação.
- Fase 4: what-if ✅; falta solver de constraints e conector VRSoft/ERP automático (hoje import é CSV manual).

## Regra de colaboração entre IAs

- Nunca assumir o último estado sem ler `HANDOFF.md`.
- Evolução incremental; sem reescrita ampla.
- Preservar: autenticação, multiempresa, importação, dashboard, motor de escala.
- Ao mudar regra/arquitetura/direção, atualizar este arquivo + `HANDOFF.md`.
