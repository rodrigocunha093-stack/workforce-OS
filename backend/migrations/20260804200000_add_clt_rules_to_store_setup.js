/**
 * Regras CLT/CCT customizáveis por empresa — antes checkComplianceCLT
 * tinha os limites (44h/semana, 11h interjornada, 10h/dia, 6 dias
 * seguidos, 1 DSR) travados no código, sem nenhuma tela pra ajustar (a
 * caixa "Escala em conformidade CLT" era só texto fixo). Cada regra tem
 * valor + se ela BLOQUEIA a publicação ou só AVISA — null usa o padrão
 * federal (ver CLT_FEDERAL_DEFAULTS em schedule.js).
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('store_setup', (table) => {
    table.jsonb('clt_rules');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('store_setup', (table) => {
    table.dropColumn('clt_rules');
  });
};
