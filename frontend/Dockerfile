# ---- build stage: gera os arquivos estáticos (dist/) ----
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- serve stage: nginx servindo os estáticos + proxy /api pro backend ----
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# BACKEND_HOST/BACKEND_PORT são substituídos no nginx.conf.template em
# tempo de execução (mecanismo nativo da imagem oficial do nginx) —
# configure via variáveis de ambiente no Coolify, sem precisar rebuildar.
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=5000

EXPOSE 3000
