const Parser = require('rss-parser');
const { db, nextId } = require('./db');

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['enclosure', 'enclosure', { keepArray: false }],
    ],
  },
});

function extractImage(item) {
  if (item.mediaContent && item.mediaContent.$) {
    const url = item.mediaContent.$.url;
    if (url && /\.(jpg|jpeg|png|gif|webp)/i.test(url)) return url;
  }
  if (item.mediaThumbnail && item.mediaThumbnail.$) {
    return item.mediaThumbnail.$.url || null;
  }
  if (item.enclosure && item.enclosure.url) {
    const url = item.enclosure.url;
    if (/\.(jpg|jpeg|png|gif|webp)/i.test(url)) return url;
  }
  const html = item.content || item.description || '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function sanitizeDescription(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim().substring(0, 500);
}

async function fetchFeed(feedId, url) {
  try {
    const feed = await parser.parseURL(url);

    // Update feed metadata
    db.get('feeds')
      .find({ id: feedId })
      .assign({
        title: db.get('feeds').find({ id: feedId }).get('title').value() === 'Loading...'
          ? (feed.title || 'Untitled Feed')
          : db.get('feeds').find({ id: feedId }).get('title').value() || (feed.title || 'Untitled Feed'),
        description: sanitizeDescription(feed.description || ''),
        last_fetched: Math.floor(Date.now() / 1000),
        fetch_error: null,
      })
      .write();

    // Insert new articles (skip duplicates by link)
    const existingLinks = new Set(
      db.get('articles').filter({ feed_id: feedId }).map('link').value()
    );

    let newCount = 0;
    for (const item of (feed.items || [])) {
      const link = item.link || item.guid || null;
      if (link && existingLinks.has(link)) continue;
      if (link) existingLinks.add(link);

      const pubDate = item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000);
      db.get('articles').push({
        id: nextId('article'),
        feed_id: feedId,
        title: item.title || 'No title',
        link,
        description: sanitizeDescription(item.contentSnippet || item.description || ''),
        author: item.creator || item.author || null,
        pub_date: pubDate,
        image_url: extractImage(item),
        is_read: 0,
        is_bookmarked: 0,
        cached_at: Math.floor(Date.now() / 1000),
      }).write();
      newCount++;
    }

    return { success: true, newArticles: newCount, totalItems: (feed.items || []).length };
  } catch (err) {
    db.get('feeds').find({ id: feedId }).assign({
      fetch_error: err.message,
      last_fetched: Math.floor(Date.now() / 1000),
    }).write();
    return { success: false, error: err.message };
  }
}

async function fetchAllFeeds() {
  const feeds = db.get('feeds').value();
  return Promise.allSettled(feeds.map(f => fetchFeed(f.id, f.url)));
}

module.exports = { fetchFeed, fetchAllFeeds };
