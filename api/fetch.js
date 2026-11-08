const Parser = require('rss-parser');

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
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }
  if (item.enclosure && item.enclosure.url && /\.(jpg|jpeg|png|gif|webp)/i.test(item.enclosure.url)) {
    return item.enclosure.url;
  }
  const html = item.content || item.description || '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim().substring(0, 500);
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param is required' });

  try { new URL(url); } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const feed = await parser.parseURL(url);

    const articles = (feed.items || []).map((item, i) => ({
      id: `${encodeURIComponent(url)}-${i}-${Date.now()}`,
      title: item.title || 'No title',
      link: item.link || item.guid || null,
      description: sanitize(item.contentSnippet || item.description || ''),
      author: item.creator || item.author || null,
      pub_date: item.pubDate
        ? Math.floor(new Date(item.pubDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      image_url: extractImage(item),
    }));

    return res.status(200).json({
      title: feed.title || 'Untitled Feed',
      description: sanitize(feed.description || ''),
      link: feed.link || url,
      articles,
    });
  } catch (err) {
    return res.status(422).json({ error: `Failed to parse feed: ${err.message}` });
  }
};

