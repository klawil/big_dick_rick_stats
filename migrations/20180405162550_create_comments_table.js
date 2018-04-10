
exports.up = function(knex, Promise) {
  return knex.schema.createTable('comments', (table) => {
    table.string('comment_id', 10).primary();
    table.string('user_id', 100);
    table.dateTime('created');
    table.text('body', 'mediumtext');
    table.string('permalink', 500);
    table.string('parent_id', 10);
    table.string('post_id', 10).notNullable();
    table.integer('length');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('comments');
};
