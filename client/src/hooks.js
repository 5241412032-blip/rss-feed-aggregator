import { useState, useEffect, useCallback } from 'react';

// ── LocalStorage helpers ──────────────────────────────────────────────────────
function ls(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function getStoredFeeds() { return ls('rss_feeds', []); }
export function getReadIds()     { return new Set(ls('rss_read', [])); }
export function getBookmarkIds() { return new Set(ls('rss_bookmarks', [])); }

// ── API: fetch a single RSS feed via the serverless proxy ─────────────────────
export async function fetchRssFeed(feedUrl) {
  const res = await fetch(`/api/fetch?url=${encodeURIComponent(feedUrl)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json(); // { title, description, articles: [...] }
}

// ── Main aggregator hook ──────────────────────────────────────────────────────
export function useAggregator() {
  const [feeds, setFeeds]           = useState(() => getStoredFeeds());
  const [articles, setArticles]     = useState([]);
  const [readIds, setReadIds]       = useState(() => getReadIds());
  const [bookmarkIds, setBookmarkIds] = useState(() => getBookmarkIds());
  const [loading, setLoading]       = useState(false);
  const [refreshingIds, setRefreshingIds] = useState(new Set());

  // Persist feeds
  useEffect(() => { lsSet('rss_feeds', feeds); }, [feeds]);

  // Fetch articles for a list of feeds
  const loadArticles = useCallback(async (feedList) => {
    if (!feedList.length) { setArticles([]); return; }
    setLoading(true);
    const results = await Promise.allSettled(
      feedList.map(async (feed) => {
        try {
          const data = await fetchRssFeed(feed.url);
          // Update stored feed title if it was just 'Loading...'
          if (feed.title === 'Loading...' || !feed.title) {
            setFeeds(prev => prev.map(f => f.id === feed.id ? { ...f, title: data.title || f.url } : f));
          }
          return (data.articles || []).map(a => ({
            ...a,
            id: `${feed.id}::${a.link || a.title || Math.random()}`,
            feed_id: feed.id,
            feed_title: data.title || feed.title || feed.url,
            feed_category: feed.category || 'General',
          }));
        } catch (err) {
          console.warn(`[RSS] Failed to load ${feed.url}:`, err.message);
          return [];
        }
      })
    );
    const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    all.sort((a, b) => (b.pub_date || 0) - (a.pub_date || 0));
    setArticles(all);
    setLoading(false);
  }, []); // eslint-disable-line

  // Initial load on mount
  useEffect(() => {
    const stored = getStoredFeeds();
    if (stored.length > 0) loadArticles(stored);
  }, []); // eslint-disable-line

  // ── Feed operations ──────────────────────────────────────────────────────────
  async function addFeed(url, category) {
    const data = await fetchRssFeed(url); // validates + fetches
    const newFeed = {
      id: `feed_${Date.now()}`,
      url: url.trim(),
      title: data.title || url,
      description: data.description || '',
      category: category || 'General',
      added_at: Date.now(),
    };
    const updated = [newFeed, ...feeds];
    setFeeds(updated);
    lsSet('rss_feeds', updated);

    const newArticles = (data.articles || []).map(a => ({
      ...a,
      id: `${newFeed.id}::${a.link || a.title || Math.random()}`,
      feed_id: newFeed.id,
      feed_title: data.title || url,
      feed_category: newFeed.category,
    }));
    setArticles(prev => {
      const merged = [...newArticles, ...prev];
      merged.sort((a, b) => (b.pub_date || 0) - (a.pub_date || 0));
      return merged;
    });
    return { title: data.title, count: newArticles.length };
  }

  function removeFeed(feedId) {
    const updated = feeds.filter(f => f.id !== feedId);
    setFeeds(updated);
    lsSet('rss_feeds', updated);
    setArticles(prev => prev.filter(a => a.feed_id !== feedId));
  }

  async function refreshFeed(feedId) {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;
    setRefreshingIds(prev => new Set([...prev, feedId]));
    try {
      const data = await fetchRssFeed(feed.url);
      setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, title: data.title || f.title } : f));
      const fresh = (data.articles || []).map(a => ({
        ...a,
        id: `${feedId}::${a.link || a.title || Math.random()}`,
        feed_id: feedId,
        feed_title: data.title || feed.title,
        feed_category: feed.category,
      }));
      setArticles(prev => {
        const others = prev.filter(a => a.feed_id !== feedId);
        const merged = [...fresh, ...others];
        merged.sort((a, b) => (b.pub_date || 0) - (a.pub_date || 0));
        return merged;
      });
      return { count: fresh.length };
    } finally {
      setRefreshingIds(prev => { const s = new Set(prev); s.delete(feedId); return s; });
    }
  }

  async function refreshAll() {
    await loadArticles(feeds);
  }

  // ── Article operations ───────────────────────────────────────────────────────
  function markRead(articleId, isRead) {
    setReadIds(prev => {
      const next = new Set(prev);
      isRead ? next.add(articleId) : next.delete(articleId);
      lsSet('rss_read', [...next]);
      return next;
    });
  }

  function markAllRead(feedId) {
    setReadIds(prev => {
      const next = new Set(prev);
      articles.filter(a => !feedId || a.feed_id === feedId).forEach(a => next.add(a.id));
      lsSet('rss_read', [...next]);
      return next;
    });
  }

  function toggleBookmark(articleId) {
    setBookmarkIds(prev => {
      const next = new Set(prev);
      next.has(articleId) ? next.delete(articleId) : next.add(articleId);
      lsSet('rss_bookmarks', [...next]);
      return next;
    });
  }

  return {
    feeds, articles, readIds, bookmarkIds,
    loading, refreshingIds,
    addFeed, removeFeed, refreshFeed, refreshAll,
    markRead, markAllRead, toggleBookmark,
    stats: {
      total_feeds: feeds.length,
      total_articles: articles.length,
      unread_articles: articles.filter(a => !readIds.has(a.id)).length,
      bookmarked_articles: bookmarkIds.size,
    },
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────
export function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getFavicon(url) {
  try {
    return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`;
  } catch { return null; }
}
