# Database Migrations (Knex.js)

Sistema de versionamento de schema do banco de dados usando Knex.js.

## Como usar

### Aplicar todas as migrations
```bash
npm run migrate:latest
```

### Reverter a última migration
```bash
npm run migrate:rollback
```

### Criar uma nova migration
```bash
npm run migrate:make <nome_da_migration>
```

Exemplo:
```bash
npm run migrate:make add_new_column_to_users
```

Isso cria um novo arquivo em `migrations/XXX_add_new_column_to_users.js` com `up()` e `down()`.

## Estrutura de uma migration

```javascript
exports.up = async function(knex) {
  // Código para aplicar a mudança
  await knex.schema.table('users', (table) => {
    table.string('new_column', 255);
  });
};

exports.down = async function(knex) {
  // Código para reverter
  await knex.schema.table('users', (table) => {
    table.dropColumn('new_column');
  });
};
```

## Fluxo de deployment

1. **Desenvolvimento**: Cria migration com `npm run migrate:make`
2. **Testes**: Aplica com `npm run migrate:latest`, testa, reverte com `npm run migrate:rollback`
3. **Git**: Commit do arquivo de migration
4. **Produção**: `npm run migrate:latest` antes de subir

## Histórico

A migration `001_init_schema.js` replica o schema atual do banco e serve como baseline para futuras alterações.

## Notas

- Cada migration é executada apenas UMA VEZ
- O Knex rastreia via tabela `knex_migrations`
- As migrations são idempotentes (seguro rodar multiple vezes)
- Sempre testar `up()` e `down()` localmente antes de commitar
