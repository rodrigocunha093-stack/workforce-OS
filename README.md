# TáÓtimo! v2 - Refactor com Nova Stack

**Escala Inteligente para Supermercados** - Refatorado com Express + React + PostgreSQL

## 🎯 Stack

```
Frontend:  React 18 + Tailwind CSS + Vite
Backend:   Node.js + Express + PostgreSQL
Deploy:    Docker / Servidor Local
```

## 📁 Estrutura

```
workforce-v2/
├── backend/
│   ├── src/
│   │   ├── server.js                  # Servidor Express
│   │   ├── db/
│   │   │   ├── postgres.js            # Conexão PostgreSQL
│   │   │   └── init.sql               # Schema das tabelas
│   │   ├── routes/
│   │   │   └── schedule.js            # Rotas de escala
│   │   └── services/
│   │       ├── erlang.js              # Cálculo Erlang-C
│   │       └── schedule.js            # Geração de escala
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Componente raiz
│   │   ├── pages/
│   │   │   ├── Login.jsx              # Tela de login
│   │   │   └── Dashboard.jsx          # Dashboard principal
│   │   ├── components/
│   │   │   ├── ScheduleView.jsx       # Visualização da escala
│   │   │   └── DemandChart.jsx        # Gráfico de demanda
│   │   ├── index.css                  # Tailwind + estilos
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md (este arquivo)
```

## 🚀 Como Rodar

### Pré-requisitos

- Node.js 18+
- PostgreSQL 12+
- npm ou yarn

### 1️⃣ Configurar Banco de Dados

```bash
# Criar banco PostgreSQL
createdb workforce_v2

# Rodar schema
psql workforce_v2 < backend/src/db/init.sql
```

### 2️⃣ Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar variáveis
cp .env.example .env
# Editar .env com credenciais do PostgreSQL

# Rodar servidor
npm start
# Acessa: http://localhost:5000
```

### 3️⃣ Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Rodar dev
npm run dev
# Acessa: http://localhost:3000
```

## 🧪 Testar

### Login Demo

```
Email: demo@test.com
Senha: 123456
```

### Endpoints

```
POST   /api/auth/register          # Criar conta
POST   /api/auth/login             # Fazer login
GET    /api/schedule               # Obter escala semanal
POST   /api/schedule/save          # Salvar escala
GET    /api/schedule/demand        # Demanda por hora (Erlang-C)
GET    /api/employees              # Listar colaboradores
POST   /api/employees              # Adicionar colaborador
```

## 📊 Funcionalidades Principais

### ✅ Implementado (MVP)

- [x] Autenticação (login/registro)
- [x] Geração de escala semanal
- [x] Cálculo Erlang-C (demanda por hora)
- [x] Dashboard com escala
- [x] Visualização de demanda
- [x] Gerenciamento de colaboradores
- [x] Desempenho por colaborador

### 🔄 Próximas Fases

- [ ] Compliance CLT (interjornada, DSR, 44h)
- [ ] Exportar escala (PDF)
- [ ] What-if (simulador)
- [ ] Planta isométrica 3D
- [ ] ICOS por setor
- [ ] Importar VRSoft (CSV)
- [ ] Tema claro/escuro
- [ ] Notificações

## 📦 Diferenças vs Original

| Aspecto | Original | v2 |
|---------|----------|-----|
| Backend | Node puro (6kb) | Express (minimalista) |
| DB | Supabase | PostgreSQL direto |
| Frontend | HTML/CSS estático | React 18 + Vite + Tailwind |
| Arquivos | 1 arquivo monolítico | Estrutura DDD modular |
| Arquitetura | Acoplado | Separação: backend/frontend |
| Real-time | HTTP polling | WebSocket nativo |

## 🐳 Deploy Local

### Com Docker Compose
```bash
docker-compose up -d
# Acessa: http://localhost:3000
```

### Servidor Físico (Produção)
```bash
# Backend
cd backend && npm start

# Frontend (em outra sessão)
cd frontend && npm run build
# Servir os arquivos estáticos
```

## 📝 Commits

```bash
git checkout develop
git add .
git commit -m "feat: refactor v2 - Express + React + PostgreSQL (MVP escala)"
git push origin develop
```

## 🤝 Contribuições

Para expandir:

1. Escolha uma feature da "Próximas Fases"
2. Crie branch: `git checkout -b feature/compliance-clt`
3. Implemente em backend + frontend
4. Teste
5. Commit + push
6. PR para `develop`

## 📞 Referência

- `ARQUITETURA.md` - Estrutura do projeto
- `DATABASE.md` - Schema e migrations
- `_docs/` - Documentação adicional

---

**Versão:** 2.0 Refatorada  
**Status:** MVP + Melhorias ✅
