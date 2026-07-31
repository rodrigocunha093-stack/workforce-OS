/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('sync_schedules', (table) => {
    table.increments('id').primary();
    table.string('module', 20).notNullable().unique(); // vendas | mercadologico | setores
    table.string('cron_expression', 50).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sync_schedules');
};
