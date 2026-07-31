/**
 * Calendário de eventos (feriados, promoções, datas comemorativas) que
 * ajustam a previsão de demanda por um fator multiplicativo. Espelha o
 * calendário de eventos do EscalaON (data/tipo/nome/fator), escopado por
 * empresa (multi-tenant).
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('demand_events', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.date('data').notNullable();
    table.string('tipo', 30).notNullable(); // feriado | vespera | promocao | data_comemorativa | pagamento
    table.string('nome', 120).notNullable();
    table.decimal('fator', 4, 2).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['company_id', 'data']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('demand_events');
};
