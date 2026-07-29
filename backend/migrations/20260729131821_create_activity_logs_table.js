/**
 * Log de auditoria de eventos de autenticação (login, criação de usuário,
 * ativação/desativação, troca de senha). Sempre atrelado a uma empresa —
 * o admin do cliente só vê os logs da própria empresa; a equipe Contagil
 * (platform_admins) vê de qualquer empresa.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('activity_logs', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.integer('user_id').references('users.id').onDelete('SET NULL');
    table.string('event_type', 50).notNullable();
    table.text('description').notNullable();
    table.string('performed_by', 150).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['company_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('activity_logs');
};
