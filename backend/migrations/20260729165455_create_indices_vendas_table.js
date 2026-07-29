/**
 * Rastreia o último "id" de venda (do banco do cliente/VR) já processado
 * por empresa, permitindo que o agente busque só o que é mais novo na
 * próxima execução. Diferente de setores/mercadologicos (que já têm
 * erp_id na própria linha), vendas é agregada por período (hora), então
 * precisa de uma tabela separada de "marcadores" de sincronização.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('indices_vendas', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.integer('ultimo_id').notNullable();
    table.timestamp('datahoraexecucao').defaultTo(knex.fn.now());
    table.index(['company_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('indices_vendas');
};
