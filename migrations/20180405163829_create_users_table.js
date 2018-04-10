
exports.up = function(knex, Promise) {
  return knex.schema.createTable('users', (table) => {
    table.string('user_id', 10).primary();
    table.string('user_name', 100);
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('users');
};
