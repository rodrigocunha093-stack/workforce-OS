# TáÓtimo! — Análise Profunda e Roadmap de Evolução

**Domínio:** escala.contagilpb.com.br · **Base:** React-free SPA + Node HTTP + Supabase
**Referência de benchmark:** Blue Yonder (líder mundial em Workforce Management para varejo)

---

## 1. O QUE JÁ ESTÁ CONSTRUÍDO (entregue)

### Núcleo de dados
- Importação VRSoft (cupom a cupom) → ICOC de caixa por hora
- Importação mercadológico (m1/m2) → vendas por departamento
- Cadastro de equipe manual + CSV, multi-seleção de mercadológicos
- Persistência em Supabase (PostgreSQL) multi-empresa

### Motor de escala (o coração)
- 3 tipos de jornada: **corrida** (caixa/açougue), **partida** (reposição), **comercial** (apoio/admin)
- Revezamento por **cargo** (grupos intercambiáveis)
- Atributos individuais: turno preferencial, folga, disponibilidade de domingo, sexo
- **Cobertura garantida**: abridor + fechador por grupo; reposição com noturno
- Regras de intervalo por sexo (homem >2h, mulher ≤2h)
- Indicadores 🔓/🔒 de abertura/fechamento
- Análise por semana do mês

### Inteligência e dashboards
- **Painel Operacional** (abertura): faturamento dia/semana/mês, dimensionamento por benchmark (1 colab/R$36,5k), pico de fluxo, perdas (ruptura, validade, abandono), multifuncionalidade, tendência
- **ICOS** por mercadológico: venda × equipe, produtividade, curva por dia da semana, matriz de benchmarks (caixas/h, margem, foco)
- **Otimização TáÓtimo!**: cobre déficits respeitando PDVs/equipe, salvável
- Economia comprovada (operação real vs otimizada)

### Plataforma / SaaS
- Multi-empresa com código de organização
- Admin cria usuários secundários (dados compartilhados)
- **Gestor do produto** (super-admin): habilita/inibe os 10 módulos por empresa (controle comercial de planos)
- Segurança: rate-limit, headers, sanitização, auditoria, sessões

---

## 2. ANÁLISE — FORÇAS E REALIDADE

### Forças reais (diferenciais)
1. **Dados reais, não suposição** — VRSoft + mercadológico alimentam tudo. A "Economia comprovada" quantifica perda (R$106k/mês no exemplo). Isso é argumento de venda forte.
2. **Conhecimento de domínio brasileiro** — jornada partida de reposição, intervalos por sexo, cultura de fechamento/abertura, mercadológico m1/m2. Blue Yonder é genérico/global; aqui há regra fina do varejo nacional.
3. **Time-to-value baixo** — importa CSV e em minutos tem escala + diagnóstico. Blue Yonder leva meses de implantação.
4. **Modelo SaaS pronto** — multi-empresa, gestor de módulos por plano, isolamento de dados.

### Realidade / limites atuais (honestidade técnica)
1. **Forecast é heurístico**, não estatístico. Usa médias e benchmarks fixos. Blue Yonder usa ML com sazonalidade, eventos, clima.
2. **Otimização é gulosa** (cobre déficit linearmente), não um solver de constraints. Não minimiza custo global sob restrições CLT simultâneas.
3. **Sem compliance CLT formal** — não valida interjornada de 11h, DSR, limite de horas extras, banco de horas. Hoje são regras soltas.
4. **Sem self-service do colaborador** — não há app do funcionário (trocar turno, pedir folga, ver escala).
5. **Sem integração automática** — importação é manual (CSV). Sem conector VRSoft/ERP em tempo real.
6. **Persistência frágil para escala** — staffSchedule é recalculado a cada request, não versionado/publicado. Não há "escala oficial publicada vs rascunho" com histórico.

---

## 3. BENCHMARK — OS 7 PILARES DO BLUE YONDER

| # | Pilar Blue Yonder | TáÓtimo! hoje | Gap |
|---|-------------------|---------------|-----|
| 1 | **Demand Forecasting (ML)** | Heurístico (médias, benchmarks) | Alto |
| 2 | **Auto-Scheduling otimizado** | Geração por regras + cobertura | Médio |
| 3 | **Labor Compliance** | Regras parciais (folga, intervalo) | Alto |
| 4 | **Task Management** | Foco operacional por setor (texto) | Alto |
| 5 | **Employee Self-Service** | Inexistente | Alto |
| 6 | **Real-time Analytics** | Dashboards ricos (dados importados) | Médio |
| 7 | **Integrações (POS/ERP)** | CSV manual | Alto |

---

## 4. PLANO DE EVOLUÇÃO (roadmap por fases)

### FASE 1 — Solidez da escala (0-30 dias) · *prioridade máxima*
- **Escala publicada vs rascunho** — versionar, publicar, histórico de quem aprovou
- **Compliance CLT** — validar interjornada 11h, DSR semanal, máx 44h/2h extras, alertas de violação antes de publicar
- **Exportar escala** — PDF/Excel para imprimir e afixar
- **Resumo diário** — "Hoje: João abre, Severino fecha" por setor

### FASE 2 — Forecast melhor (30-90 dias)
- **Sazonalidade real** — média móvel ponderada + dia da semana + semana do mês (já temos os dados)
- **Calendário de eventos** — feriados, pagamento, promoções com fator multiplicador
- **Forecast por setor** — usar o mercadológico para prever demanda de cada departamento por dia
- **Banco de horas** — saldo por colaborador, compensação

### FASE 3 — Self-service + mobile (90-150 dias)
- **App/PWA do colaborador** — ver escala, pedir folga, trocar turno (com aprovação)
- **Notificações** — escala publicada, troca aprovada
- **Ponto integrado** — comparar previsto vs realizado

### FASE 4 — Otimização real + integração (150-240 dias)
- **Solver de constraints** — minimizar custo de folha cobrindo demanda sob todas as regras CLT/CCT simultâneas (substituir a heurística gulosa)
- **Multifuncionalidade automática** — alocar repositor leve como caixa no pico, calculando o trade-off
- **Conector VRSoft/ERP** — importação automática diária (sem CSV)
- **What-if scenarios** — simular contratação/demissão/mudança de horário e ver impacto

---

## 5. POSICIONAMENTO ESTRATÉGICO

**Não competir de frente com Blue Yonder** (enterprise, caro, global). **Vencer onde ele é fraco:**

- **Foco no varejo brasileiro de médio porte** — supermercados regionais que não pagam Blue Yonder
- **Regra fina nacional** — CLT/CCT, jornada partida, mercadológico, cultura operacional
- **Preço e simplicidade** — implantação em dias, não meses
- **"Economia comprovada"** como gancho comercial — mostrar R$ que o cliente perde hoje

> **Tese:** o TáÓtimo! é o "Blue Yonder do supermercado regional brasileiro" — 80% do valor por 5% da complexidade e custo.
