/**
 * Adiciona a quantidade física vendida (kg ou unidades, dependendo do
 * departamento) por mercadológico/dia — necessária pro cálculo de
 * necessidade operacional do ICOS (deriveOperationalNeed), que precisa de
 * volume real e não só do valor em R$.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('sales_by_mercadologico', (table) => {
    table.decimal('quantidade', 12, 3).notNullable().defaultTo(0);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('sales_by_mercadologico', (table) => {
    table.dropColumn('quantidade');
  });
};
