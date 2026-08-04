/**
 * Venda diária por mercadológico (nível 1) — alimenta o dashboard ICOS da
 * aba Setores/Mercadológico (equivalente ao mercRows do EscalaON). Vem da
 * task "vendas-por-mercadologico" no orquestrador, que consulta a tabela
 * vendasintetica no VRSoft do cliente.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('sales_by_mercadologico', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.date('data').notNullable();
    table.integer('erp_mercadologico_id'); // código bruto do VRSoft (ex: 2, 4, 11...)
    table.string('mercadologico_nome', 100).notNullable();
    table.decimal('venda', 12, 2).notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['company_id', 'mercadologico_nome', 'data']);
    table.index(['company_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sales_by_mercadologico');
};
