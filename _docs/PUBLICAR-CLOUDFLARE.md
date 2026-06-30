# Publicar com Cloudflare Tunnel

## Arquitetura recomendada para o piloto

Internet -> Cloudflare Access -> Cloudflare Tunnel -> Dashboard `localhost:4173` -> PostgreSQL local

O PostgreSQL continua privado. Somente o dashboard passa pelo túnel.

## 1. Iniciar o dashboard conectado ao PostgreSQL

Execute:

`conectar-banco.cmd`

Digite a senha do PostgreSQL localmente. Não envie essa senha para ninguém.

Confirme no topo do dashboard:

`PostgreSQL · meu_sistema`

## 2. Criar o túnel no painel Cloudflare

1. Acesse o painel Cloudflare.
2. Abra **Zero Trust > Networks > Connectors > Cloudflare Tunnels**.
3. Selecione **Create tunnel**.
4. Nome sugerido: `controlador-escalas-piloto`.
5. Escolha Windows e copie o comando de instalação com o token.
6. Execute o comando copiado em um Prompt de Comando aberto como administrador.

O token é secreto. Não salve no projeto nem envie por chat.

## 3. Publicar o hostname

Dentro do túnel, adicione uma rota **Published application**:

- Hostname sugerido: `escala.seudominio.com.br`
- Service type: `HTTP`
- Service URL: `http://localhost:4173`

## 4. Proteger com Cloudflare Access

Antes de compartilhar:

1. Abra **Zero Trust > Access > Applications**.
2. Adicione uma aplicação **Self-hosted**.
3. Use o hostname criado.
4. Crie uma política **Allow** somente para os e-mails autorizados.
5. Não crie política pública `Everyone`.

## 5. Verificações

- Abrir o hostname em uma janela anônima deve exigir login.
- O topo deve mostrar `PostgreSQL · meu_sistema`.
- `https://escala.seudominio.com.br/api/db-status` não deve revelar senha.
- O computador, PostgreSQL, dashboard e serviço `cloudflared` precisam permanecer ligados.

## Limitação do piloto

Se este computador desligar, o sistema sai do ar. Para produção, migrar o Node.js e o PostgreSQL para um servidor dedicado ou serviço gerenciado.
