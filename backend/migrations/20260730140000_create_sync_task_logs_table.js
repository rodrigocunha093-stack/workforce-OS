/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('sync_task_logs', (table) => {
    table.increments('id').primary();
    table.string('module', 20).notNullable(); // vendas | mercadologico | setores
    table.string('client_id', 100).notNullable();
    table.integer('company_id').references('id').inTable('companies').onDelete('SET NULL');
    table.string('task_id', 50);
    table.string('status', 20).notNullable(); // success | error
    table.string('consulta_id', 100);
    table.text('message');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['module', 'created_at']);
    table.index(['client_id', 'created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sync_task_logs');
};
