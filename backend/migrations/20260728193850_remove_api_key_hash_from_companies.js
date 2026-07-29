/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('companies', (table) => {
    table.dropColumn('api_key_hash');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('companies', (table) => {
    table.string('api_key_hash', 255).notNullable().defaultTo('');
  });
};
