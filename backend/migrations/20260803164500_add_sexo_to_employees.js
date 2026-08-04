/**
 * Faltou no CSV de importação: sexo do colaborador.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('employees', (table) => {
    table.string('sexo', 20);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('employees', (table) => {
    table.dropColumn('sexo');
  });
};
