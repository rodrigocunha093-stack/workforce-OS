# Conexão PostgreSQL

O dashboard está preparado para consultar o PostgreSQL local.

## Iniciar conectado

Execute `conectar-banco.cmd`.

O inicializador:

1. conecta em `localhost:5432`;
2. usa o banco `meu_sistema`;
3. solicita localmente a senha do usuário `postgres`;
4. testa a conexão;
5. inicia o dashboard em `http://localhost:4173/`.

A senha permanece somente na sessão do processo e não é gravada nos arquivos.

## Fontes consultadas

- `vw_demanda_caixa_vrsoft_hora`: demanda real por dia e horário;
- `cenarios_escala`: cenários 6x1 e 5x2;
- `/api/db-status`: diagnóstico da conexão.

Quando o banco não estiver conectado, o dashboard abre em modo demonstração e informa isso no topo.
