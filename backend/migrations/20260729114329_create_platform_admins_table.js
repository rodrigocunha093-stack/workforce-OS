/**
 * Tabela separada da equipe interna Contagil (donos da plataforma).
 * Não tem company_id — não pertence a nenhuma empresa cliente.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('platform_admins', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('email', 100).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('platform_admins');
};
