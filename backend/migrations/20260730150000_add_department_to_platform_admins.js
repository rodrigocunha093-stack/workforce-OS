/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('platform_admins', (table) => {
    table.string('department', 50).notNullable().defaultTo('NPD');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('platform_admins', (table) => {
    table.dropColumn('department');
  });
};
