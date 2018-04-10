const knex = require('knex')(require('./knex.conf.js'));
const express = require('express');
const app = express();
const path = require('path');

function rowsParser(rows) {
  return rows.map(parseRow);
}

function parseRow(row) {
  // Check for title
  if (typeof row.title !== 'undefined') {
    row.title = decodeURIComponent(row.title);
  }

  if (typeof row.body !== 'undefined') {
    row.body = decodeURIComponent(row.body);
  }

  if (typeof row.inches !== 'undefined') {
    row.inches = row.inches * 10;
  }

  if (typeof row.date !== 'undefined') {
    row.date = row.date.toISOString().split('T')[0];
  }

  return row;
}

app.get('/api/v1/dates/comment', (req, res) => {
  // Default the start date to the start of the 2018 season
  var constraints = {
    start: '2017-10-04',
    end: null,
    granularity: 'day',
  };

  // Get the data by date
  var q = knex('comments')
    .where('user_id', 'BIG_DICK_RICK_BOT')
    .whereNotNull('length');

  if (constraints.start !== null && constraints.end !== null) {
    q = q
      .whereBetween(knex.raw('CONVERT_TZ(created, "+00:00", "-04:00")'), new Date(constraints.start), new Date(constraints.end));
  } else if (constraints.start !== null) {
    q = q
      .whereRaw('CONVERT_TZ(created, "+00:00", "-04:00") >= FROM_UNIXTIME(?)', [(new Date(constraints.start)).getTime() / 1000]);
  }

  q
    .groupByRaw('DATE(CONVERT_TZ(created, "+00:00", "-04:00"))')
    .orderByRaw('DATE(CONVERT_TZ(created, "+00:00", "-04:00"))')
    .countDistinct('comment_id as inches')
    .countDistinct('post_id as posts')
    .select(
      knex.raw('DATE(CONVERT_TZ(created, "+00:00", "-04:00")) as date'),
      knex.raw('MAX(length) as max_length')
    )
    .then(rowsParser)
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/api/v1/dates/post', (req, res) => {
  // Get the data by date
  knex('posts')
    .leftJoin('comments', 'posts.post_id', 'comments.post_id')
    .where('comments.user_id', 'BIG_DICK_RICK_BOT')
    .whereNotNull('comments.length')
    .groupByRaw('DATE(CONVERT_TZ(posts.created, "+00:00", "-04:00"))')
    .orderByRaw('DATE(CONVERT_TZ(posts.created, "+00:00", "-04:00"))')
    .countDistinct('comments.comment_id as inches')
    .countDistinct('posts.post_id as posts')
    .select(
      knex.raw('DATE(CONVERT_TZ(posts.created, "+00:00", "-04:00")) as date')
    )
    .then(rowsParser)
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/api/v1/dates/comment/top', (req, res) => {
  // Default the start date to the start of the 2018 season
  var constraints = {
    start: '2017-10-04',
    end: null,
    granularity: 'day',
  };

  // Get the top dates
  var q = knex('comments as c1')
    .leftJoin('comments as c2', 'c1.comment_id', 'c2.parent_id')
    .leftJoin('posts as p', 'c1.post_id', 'p.post_id')
    .where('c2.user_id', 'BIG_DICK_RICK_BOT')
    .whereNotNull('c2.length');

  if (constraints.start !== null) {
    q = q
      .whereRaw('CONVERT_TZ(c1.created, "+00:00", "-04:00") >= FROM_UNIXTIME(?)', [(new Date(constraints.start)).getTime() / 1000]);
  }

  q
    .groupByRaw('DATE(CONVERT_TZ(c1.created, "+00:00", "-04:00"))')
    .countDistinct('c2.comment_id as inches')
    .orderBy('inches', 'DESC')
    .limit(10)
    .select(
      knex.raw('DATE(CONVERT_TZ(c1.created, "+00:00", "-04:00")) as date'),
      knex.raw('SUM(CASE WHEN p.subreddit = "rangers" THEN 10 ELSE 0 END) as rangers_inches'),
      knex.raw('SUM(CASE WHEN p.subreddit = "BostonBruins" THEN 10 ELSE 0 END) as bruins_inches')
    )
    .then(rowsParser)
    .then((data) => [['Date', 'Rangers Inches', 'Bruins Inches']].concat(data.map((row) => [row.date, row.rangers_inches, row.bruins_inches])))
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/api/v1/dates/post/top', (req, res) => {
  // Get the top dates
  knex('posts')
    .leftJoin('comments', 'posts.post_id', 'comments.post_id')
    .where('comments.user_id', 'BIG_DICK_RICK_BOT')
    .whereNotNull('comments.length')
    .groupByRaw('DATE(CONVERT_TZ(posts.created, "+00:00", "-04:00"))')
    .orderByRaw('COUNT(comments.comment_id) DESC')
    .countDistinct('comments.comment_id as inches')
    .limit(10)
    .select(
      knex.raw('DATE(CONVERT_TZ(posts.created, "+00:00", "-04:00")) as date')
    )
    .then(rowsParser)
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/api/v1/posts/top/:subreddit?', (req, res) => {
  // Default the start date to the start of the 2018 season
  var constraints = {
    start: '2017-10-04',
    end: null,
    granularity: 'day',
  };

  var q = knex('posts')
    .leftJoin('comments', 'posts.post_id', 'comments.post_id')
    .where('comments.user_id', 'BIG_DICK_RICK_BOT')
    .whereNotNull('comments.length');

  if (typeof req.params.subreddit !== 'undefined') {
    q = q.where('posts.subreddit', req.params.subreddit);
  }

  if (constraints.start !== null) {
    q = q
      .whereRaw('CONVERT_TZ(posts.created, "+00:00", "-04:00") >= FROM_UNIXTIME(?)', [(new Date(constraints.start)).getTime() / 1000]);
  }

  q
    .groupBy('posts.post_id')
    .orderBy('inches', 'DESC')
    .limit(10)
    .count('comments.comment_id as inches')
    .select(
      'posts.user_id',
      'posts.permalink',
      'posts.subreddit',
      knex.raw('DATE(CONVERT_TZ(posts.created, "+00:00", "-04:00")) as date'),
      'posts.title'
    )
    .then(rowsParser)
    .then((data) => data.map((row, index) => [index + 1, decodeURIComponent(row.title), row.subreddit, row.user_id, row.date, row.inches, row.permalink]))
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/api/v1/users/comments/top', (req, res) => {
  // Default the start date to the start of the 2018 season
  var constraints = {
    start: '2017-10-04',
    end: null,
    granularity: 'day',
  };

  var q = knex('comments as c1')
    .leftJoin('comments as c2', 'c2.parent_id', 'c1.comment_id')
    .leftJoin('posts as p', 'c1.post_id', 'p.post_id')
    .where('c2.user_id', 'BIG_DICK_RICK_BOT')
    .whereNot('c1.user_id', '[deleted]')
    .whereNotNull('c2.length');

  if (constraints.start !== null) {
    q = q
      .whereRaw('CONVERT_TZ(c1.created, "+00:00", "-04:00") >= FROM_UNIXTIME(?)', [(new Date(constraints.start)).getTime() / 1000]);
  }

  q = q
    .countDistinct('c2.comment_id as inches')
    .groupBy('c1.user_id')
    .orderBy('inches', 'DESC')
    .limit(10)
    .select(
      'c1.user_id',
      knex.raw('SUM(CASE WHEN p.subreddit = "rangers" THEN 10 ELSE 0 END) as rangers_inches'),
      knex.raw('SUM(CASE WHEN p.subreddit = "BostonBruins" THEN 10 ELSE 0 END) as bruins_inches')
    )
    .then(rowsParser)
    .then((data) => [['User', 'Rangers Inches', 'Bruins Inches']]
      .concat(data.map((row) => [row.user_id, row.rangers_inches, row.bruins_inches])))
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/api/v1/users/posts/top', (req, res) => {
  // Default the start date to the start of the 2018 season
  var constraints = {
    start: '2017-10-04',
    end: null,
    granularity: 'day',
  };

  var q = knex('posts')
    .leftJoin('comments', 'posts.post_id', 'comments.post_id')
    .where('comments.user_id', 'BIG_DICK_RICK_BOT')
    .whereNotNull('comments.length')
    .whereNot('posts.user_id', '[deleted]');

  if (constraints.start !== null) {
    q = q
      .whereRaw('CONVERT_TZ(posts.created, "+00:00", "-04:00") >= FROM_UNIXTIME(?)', [(new Date(constraints.start)).getTime() / 1000]);
  }

  q
    .groupBy('posts.user_id')
    .orderByRaw('COUNT(comments.comment_id) DESC')
    .limit(10)
    .count('comments.comment_id as inches')
    .select(
      'posts.user_id',
      knex.raw('SUM(CASE WHEN posts.subreddit = "rangers" THEN 10 ELSE 0 END) as rangers_inches'),
      knex.raw('SUM(CASE WHEN posts.subreddit = "BostonBruins" THEN 10 ELSE 0 END) as bruins_inches')
    )
    .then(rowsParser)
    .then((data) => [['User', 'Rangers Inches', 'Bruins Inches']].concat(data.map(
      (row) => [row.user_id, row.rangers_inches, row.bruins_inches]
    )))
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/api/v1/user/:user_id', (req, res) => {
  var returnData = {
    posts_top: [],
    posts: {
      count: 0,
      inches: 0,
    },
    comments: 0,
  };

  Promise.all([
    // Top 10 posts
    knex('posts')
      .leftJoin('comments', 'posts.post_id', 'comments.post_id')
      .where('posts.user_id', req.params.user_id)
      .where('comments.user_id', 'BIG_DICK_RICK_BOT')
      .whereNotNull('comments.length')
      .groupBy('posts.post_id')
      .count('comments.comment_id as inches')
      .orderBy('inches', 'DESC')
      .limit(10)
      .select(
        'posts.permalink',
        'posts.subreddit',
        knex.raw('UNIX_TIMESTAMP(posts.created) as created'),
        'posts.title'
      )
      .then(rowsParser)
      .then((data) => returnData.posts_top = data),

    // Count of posts and inches grown from posts
    knex('posts')
      .leftJoin('comments', 'posts.post_id', 'comments.post_id')
      .where('posts.user_id', req.params.user_id)
      .where('comments.user_id', 'BIG_DICK_RICK_BOT')
      .whereNotNull('comments.length')
      .countDistinct('comments.comment_id as inches')
      .countDistinct('posts.post_id as count')
      .select()
      .then((data) => {
        if (data.length === 0) {
          return;
        }

        returnData.posts = parseRow(data[0]);
      }),

    // Count of inches from comments
    knex('comments as c1')
      .leftJoin('comments as c2', 'c1.comment_id', 'c2.parent_id')
      .where('c1.user_id', req.params.user_id)
      .where('c2.user_id', 'BIG_DICK_RICK_BOT')
      .whereNotNull('c2.length')
      .countDistinct('c2.comment_id as inches')
      .select()
      .then((data) => {
        if (data.length === 0) {
          return;
        }

        returnData.comments = data[0].inches * 10;
      })
  ])
    .then(() => res.setHeader('Cache-Control', 'public, max-age=300') && res.json(returnData));
});

app.get('/api/v1/user/:user_id/posts', (req, res) => {
  knex('posts')
    .leftJoin('comments', 'posts.post_id', 'comments.post_id')
    .where('posts.user_id', req.params.user_id)
    .where('comments.user_id', 'BIG_DICK_RICK_BOT')
    .whereNotNull('comments.length')
    .groupBy('posts.post_id')
    .orderByRaw('COUNT(comments.comment_id) DESC')
    .count('comments.comment_id as inches')
    .select(
      'posts.user_id',
      'posts.permalink',
      'posts.subreddit',
      knex.raw('UNIX_TIMESTAMP(posts.created) as created'),
      'posts.title'
    )
    .then(rowsParser)
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/api/v1/subreddit', (req, res) => {
  // Default the start date to the start of the 2018 season
  var constraints = {
    start: '2017-10-04',
    end: null,
    granularity: 'day',
  };

  var q = knex('comments as c1')
    .leftJoin('comments as c2', 'c1.comment_id', 'c2.parent_id')
    .leftJoin('posts as p', 'c1.post_id', 'p.post_id')
    .where('c2.user_id', 'BIG_DICK_RICK_BOT')
    .whereNotNull('c2.length');

  if (constraints.start !== null) {
    q = q
      .whereRaw('CONVERT_TZ(c1.created, "+00:00", "-04:00") >= FROM_UNIXTIME(?)', [(new Date(constraints.start)).getTime() / 1000]);
  }

  q
    .groupBy('p.subreddit')
    .countDistinct('c2.comment_id as inches')
    .orderBy('inches', 'DESC')
    .select(
      'p.subreddit'
    )
    .then(rowsParser)
    .then((data) => {
      var dataTable = [
        ['Subreddit', 'Inches Grown'],
      ];
      data.map((row) => dataTable.push([
        row.subreddit,
        row.inches
      ]));

      return dataTable;
    })
    .then((data) => {res.setHeader('Cache-Control', 'public, max-age=300'); res.json(data);});
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, '/index.html'));
});

app.listen(8080);
