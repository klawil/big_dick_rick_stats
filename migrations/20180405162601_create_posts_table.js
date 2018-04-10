
exports.up = function(knex, Promise) {
  return knex.schema.createTable('posts', (table) => {
    table.string('post_id', 10).primary();
    table.string('user_id', 100);
    table.string('permalink', 500);
    table.integer('length_added').defaultTo(0);
    table.string('subreddit', 50).notNullable();
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('posts');
};
