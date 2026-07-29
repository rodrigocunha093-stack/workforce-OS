/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('companies', (table) => {
    table.string('client_id', 100).unique().nullable();
    table.index(['client_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('companies', (table) => {
    table.dropIndex(['client_id']);
    table.dropColumn('client_id');
  });
};
