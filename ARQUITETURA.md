# Arquitetura do Projeto - Workforce v2

## 📁 Estrutura de Diretórios

### Backend (`/backend`)

```
backend/
├── src/
│   ├── config/           # Configurações (DB, env, constantes)
│   ├── db/              # Migrations, seeds, queries
│   ├── routes/          # Endpoints da API (REST)
│   ├── services/        # Lógica de negócio (schedule, demand, etc)
│   ├── middleware/      # Auth, error handling, CORS
│   ├── utils/           # Funções auxiliares (formatters, validators)
│   ├── types/           # TypeScript types/interfaces (opcional)
│   └── server.js        # App entry point (Express)
├── package.json
└── node_modules/
```

**Responsabilidades:**
- `routes/` - Define endpoints (GET, POST, etc)
- `services/` - Contém toda lógica (schedule generation, compliance, demand calc)
- `db/` - SQL migrations e queries
- `config/` - Database connection, env vars

### Frontend (`/frontend`)

```
frontend/src/
├── components/         # Componentes reutilizáveis
│   ├── StoreFloorMap.jsx    (Planta 3D isométrica)
│   └── EscalaSchedule.jsx   (Tabela de escala)
├── pages/             # Telas/Views
├── services/          # API calls (axios)
├── hooks/             # Custom React hooks
├── context/           # State global (Redux, Context API)
├── utils/             # Helpers, formatters, validators
├── styles/            # CSS/Tailwind globais
├── App.jsx
└── main.jsx
```

**Responsabilidades:**
- `components/` - UI reutilizáveis (botões, cards, etc)
- `pages/` - Telas completas (Escala, Configurações, etc)
- `services/` - Chamadas à API backend
- `hooks/` - Lógica compartilhada (useSchedule, useFloorMap)

### Raiz (`/`)

```
workforce-v2/
├── backend/            # API backend (Node.js + Express)
├── frontend/           # React + Vite SPA
├── .env.example        # Variáveis de ambiente
├── docker-compose.yml  # Configuração local (DB, etc)
├── package.json        # Scripts do projeto raiz
├── ARQUITETURA.md      # Este arquivo
├── DATABASE.md         # Documentação do banco
└── README.md           # Getting started
```

## 🚀 Como Rodar

### Backend
```bash
cd backend
npm install
npm start
```
Roda em `http://localhost:3000/api`

### Frontend (Dev)
```bash
cd frontend
npm install
npm run dev -- --host
```
Roda em `http://localhost:5173` (ou IP da rede)

## 📝 Padrões de Código

### Backend (Node.js)
- **Route**: `/backend/src/routes/schedule.js` - Define endpoints
- **Service**: `/backend/src/services/schedule.js` - Lógica pesada
- **Middleware**: `/backend/src/middleware/auth.js` - Proteção, logs

### Frontend (React)
- **Component**: `/frontend/src/components/EscalaSchedule.jsx` - Componente reusável
- **Hook**: `/frontend/src/hooks/useSchedule.js` - Lógica compartilhada
- **Service**: `/frontend/src/services/api.js` - Chamadas HTTP

## 🔗 Fluxo de Dados

```
Frontend (React)
    ↓
[API Service] → GET/POST /api/schedule
    ↓
Backend (Express)
    ↓
[Routes] → /api/schedule
    ↓
[Services] → generateSchedule(), validateCLT()
    ↓
[Database] → PostgreSQL
    ↓
Response → Frontend
```

## 📌 Dicas Importantes

1. **Não coloque lógica em componentes** - Use services/hooks
2. **Reutilize componentes** - Se usar 2x, move para `components/`
3. **API calls em services** - Nunca faça fetch() diretamente no JSX
4. **Migrations no git** - Banco deve ser versionável
5. **Env vars** - Nunca commite `.env` real (use `.env.example`)

## 🔧 Próximos Passos

- [ ] Mover lógica de schedule para `/backend/src/services/`
- [ ] Criar hooks customizados no `/frontend/src/hooks/`
- [ ] Adicionar camada de context global para auth
- [ ] Documentar API endpoints em `/docs/API.md`
