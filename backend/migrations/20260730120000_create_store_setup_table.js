/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('store_setup', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().unique().references('id').inTable('companies').onDelete('CASCADE');
    table.string('empresa', 150);
    table.string('loja', 150);
    table.string('regime_tributario', 50);
    table.integer('corredores').defaultTo(1);
    table.integer('pdvs').defaultTo(3);
    table.string('weekday_hours', 20);
    table.string('saturday_hours', 20);
    table.string('sunday_hours', 20);
    table.string('sunday_operation', 20);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('store_setup');
};
