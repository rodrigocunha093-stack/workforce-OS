/**
 * Agrupamento configurável de mercadológicos por zona da Planta da Loja
 * (StoreFloorMap): antes o mapa decidia sozinho, por palavra-chave no nome
 * do setor/cargo, em qual "prédio" 3D cada funcionário contava — setores
 * reais que não batessem com nenhuma palavra-chave (Bebidas, Higiene
 * Pessoal, Bazar...) caíam num bucket que não aparecia em lugar nenhum.
 * Agora o admin pode escolher explicitamente a zona de cada mercadológico
 * (ex: "Bebidas" -> zona "loja"); null continua caindo no heurístico antigo
 * como fallback, pra não quebrar dado já sincronizado sem configuração.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('mercadologicos', (table) => {
    table.string('zona_mapa', 20);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('mercadologicos', (table) => {
    table.dropColumn('zona_mapa');
  });
};
