/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('users', (table) => {
    // is_admin = admin da empresa do cliente (acessa Implantação, cria
    // teammates na própria empresa).
    // is_super_admin = equipe interna Contagil (cria novas empresas).
    table.boolean('is_super_admin').notNullable().defaultTo(false);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('users', (table) => {
    table.dropColumn('is_super_admin');
  });
};
