const snoowrap = require('snoowrap');

const r = new snoowrap(require('./snoo.conf.js'));

const knex = require('knex')(require('./knex.conf.js'));

var post_inserts;
var comment_inserts;
var post_ids = [];
var get_before_id;

// Get the most recent comment
knex('comments')
  .where('user_id', 'BIG_DICK_RICK_BOT')
  .orderBy('created', 'DESC')
  .orderBy('length', 'DESC')
  .first('comment_id')
  .then((data) => r
    .getUser('BIG_DICK_RICK_BOT')
    .getComments({
      before: `t1_${data.comment_id}`
    })
    .fetchAll())
  .then((comments) => {
    console.log(`${comments.length} new comments`);
    post_inserts = [];
    comment_inserts = [];
    var promises = [];

    if (comments.length === 0) {
      throw new Error('No more comments');
    }

    comments.map((comment) => {
      // Get the length
      var length = comment.body.match(/It is now (\d+) inches long\./);
      if (length !== null) {
        length = length[1];
      }

      // Insert the bot comment
      comment_inserts.push({
        comment_id: comment.id,
        user_id: comment.author.name,
        parent_id: comment.parent_id.substr(3),
        post_id: comment.link_id.substr(3),
        body: encodeURIComponent(comment.body),
        created: new Date(comment.created_utc * 1000),
        permalink: comment.permalink,
        length: length,
      });

      // Insert the parent comment
      promises.push(
        r
          .getComment(comment.parent_id.substr(3))
          .fetch()
          .then((comment) => {
            comment_inserts.push({
              comment_id: comment.id,
              user_id: comment.author.name,
              parent_id: comment.parent_id.substr(3),
              post_id: comment.link_id.substr(3),
              body: encodeURIComponent(comment.body),
              created: new Date(comment.created_utc * 1000),
              permalink: comment.permalink
            })
          })
      );

      // Insert the post
      if (post_ids.indexOf(comment.link_id) === -1) {
        post_ids.push(comment.link_id);

        post_inserts.push({
          post_id: comment.link_id.substr(3),
          user_id: comment.link_author,
          permalink: comment.link_permalink,
          subreddit: comment.subreddit.display_name
        });
      }
    });

    return Promise.all(promises);
  })
  .then(() => knex.batchInsert('comments', comment_inserts, 1000))
  .then(() => Promise.all(post_inserts.map((post) => knex('posts')
      .where('post_id', post.post_id)
      .select('post_id')
      .then((data) => {
        if (data.length > 0) {
          return;
        }

        return knex('posts')
          .insert(post);
      })
      .then(() => r
        .getSubmission(post.post_id)
        .fetch()
        .then((post) => knex('posts')
          .where('post_id', post.id)
          .update({
            created: new Date(post.created_utc * 1000),
            title: encodeURIComponent(post.title)
          }))
      )
      .catch((e) => e.code !== 'ER_DUP_ENTRY' && console.log(e)))))
  .catch((e) => e.message !== 'No more comments' && console.log(e))
  .finally(() => {
    knex.destroy();
  });
