const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const { db, nextId } = require('./db');
const { fetchFeed, fetchAllFeeds } = require('./fetcher');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve React build in production
app.use(express.static(path.join(__dirname, '../client/build')));

// ─── FEED ROUTES ─────────────────────────────────────────────────────────────

// GET all feeds with article counts
app.get('/api/feeds', (req, res) => {
  const feeds = db.get('feeds').value();
  const enriched = feeds.map(feed => {
    const feedArticles = db.get('articles').filter({ feed_id: feed.id }).value();
    return {
      ...feed,
      total_articles: feedArticles.length,
      unread_count: feedArticles.filter(a => a.is_read === 0).length,
    };
  });
  res.json(enriched.reverse()); // newest first
});

// POST add a new feed
app.post('/api/feeds', async (req, res) => {
  const { url, category } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

  // Check duplicate
  const existing = db.get('feeds').find({ url: url.trim() }).value();
  if (existing) return res.status(409).json({ error: 'Feed already exists' });

  const feedId = nextId('feed');
  const newFeed = {
    id: feedId,
    url: url.trim(),
    title: 'Loading...',
    description: '',
    favicon: null,
    category: category || 'General',
    last_fetched: null,
    fetch_error: null,
    created_at: Math.floor(Date.now() / 1000),
  };
  db.get('feeds').push(newFeed).write();

  const fetchResult = await fetchFeed(feedId, url.trim());
  if (!fetchResult.success) {
    db.get('feeds').remove({ id: feedId }).write();
    return res.status(422).json({ error: `Could not parse RSS feed: ${fetchResult.error}` });
  }

  const feed = db.get('feeds').find({ id: feedId }).value();
  res.status(201).json({ ...feed, newArticles: fetchResult.newArticles });
});

// DELETE a feed
app.delete('/api/feeds/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const feed = db.get('feeds').find({ id }).value();
  if (!feed) return res.status(404).json({ error: 'Feed not found' });
  db.get('feeds').remove({ id }).write();
  db.get('articles').remove({ feed_id: id }).write();
  res.json({ message: 'Feed deleted' });
});

// PATCH update feed category or title
app.patch('/api/feeds/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { category, title } = req.body;
  const updates = {};
  if (category) updates.category = category;
  if (title) updates.title = title;
  db.get('feeds').find({ id }).assign(updates).write();
  res.json(db.get('feeds').find({ id }).value());
});

// POST refresh a single feed
app.post('/api/feeds/:id/refresh', async (req, res) => {
  const id = parseInt(req.params.id);
  const feed = db.get('feeds').find({ id }).value();
  if (!feed) return res.status(404).json({ error: 'Feed not found' });
  const result = await fetchFeed(feed.id, feed.url);
  res.json(result);
});

// POST refresh all feeds
app.post('/api/feeds/refresh-all', async (req, res) => {
  const results = await fetchAllFeeds();
  res.json({ refreshed: results.length });
});

// ─── ARTICLE ROUTES ───────────────────────────────────────────────────────────

// GET articles
app.get('/api/articles', (req, res) => {
  const { feed_id, search, unread_only, bookmarked_only, page = 1, limit = 50 } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  let articles = db.get('articles').value();

  if (feed_id) articles = articles.filter(a => a.feed_id === parseInt(feed_id));
  if (unread_only === 'true') articles = articles.filter(a => a.is_read === 0);
  if (bookmarked_only === 'true') articles = articles.filter(a => a.is_bookmarked === 1);
  if (search) {
    const q = search.toLowerCase();
    articles = articles.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    );
  }

  // Sort newest first
  articles = articles.sort((a, b) => (b.pub_date || 0) - (a.pub_date || 0));

  const total = articles.length;
  const pages = Math.ceil(total / limitNum);
  const paged = articles.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  // Enrich with feed info
  const enriched = paged.map(a => {
    const feed = db.get('feeds').find({ id: a.feed_id }).value();
    return { ...a, feed_title: feed ? feed.title : 'Unknown', feed_category: feed ? feed.category : '' };
  });

  res.json({ articles: enriched, total, page: pageNum, pages, limit: limitNum });
});

// PATCH mark read/unread
app.patch('/api/articles/:id/read', (req, res) => {
  const id = parseInt(req.params.id);
  const { is_read } = req.body;
  db.get('articles').find({ id }).assign({ is_read: is_read ? 1 : 0 }).write();
  res.json({ success: true });
});

// PATCH toggle bookmark
app.patch('/api/articles/:id/bookmark', (req, res) => {
  const id = parseInt(req.params.id);
  const article = db.get('articles').find({ id }).value();
  if (!article) return res.status(404).json({ error: 'Article not found' });
  const newVal = article.is_bookmarked ? 0 : 1;
  db.get('articles').find({ id }).assign({ is_bookmarked: newVal }).write();
  res.json({ is_bookmarked: newVal });
});

// POST mark all as read
app.post('/api/articles/mark-all-read', (req, res) => {
  const { feed_id } = req.body;
  if (feed_id) {
    db.get('articles').filter({ feed_id: parseInt(feed_id) }).each(a => { a.is_read = 1; }).write();
  } else {
    db.get('articles').each(a => { a.is_read = 1; }).write();
  }
  res.json({ success: true });
});

// GET stats
app.get('/api/stats', (req, res) => {
  const feeds = db.get('feeds').value();
  const articles = db.get('articles').value();
  res.json({
    total_feeds: feeds.length,
    total_articles: articles.length,
    unread_articles: articles.filter(a => a.is_read === 0).length,
    bookmarked_articles: articles.filter(a => a.is_bookmarked === 1).length,
  });
});

// ─── AUTO REFRESH (every 30 minutes) ─────────────────────────────────────────
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Auto-refreshing all feeds...');
  await fetchAllFeeds();
  console.log('[CRON] Done.');
});

// SPA fallback
app.get('*', (req, res) => {
  const buildPath = path.join(__dirname, '../client/build', 'index.html');
  const fs = require('fs');
  if (fs.existsSync(buildPath)) {
    res.sendFile(buildPath);
  } else {
    res.send('<h2>RSS Aggregator API running. Build the client with: cd client && npm run build</h2>');
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 RSS Aggregator server running at http://localhost:${PORT}`);
  console.log(`📡 Auto-refresh every 30 minutes\n`);
});
