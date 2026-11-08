import { useState, useEffect, useCallback } from 'react';

const API = '';  // uses CRA proxy in dev, same origin in prod

export function useApi() {
  const request = useCallback(async (method, path, body) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}/api${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
}

export function useFeeds() {
  const api = useApi();
  const [feeds, setFeeds] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [feedsData, statsData] = await Promise.all([
        api.get('/feeds'),
        api.get('/stats'),
      ]);
      setFeeds(feedsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load feeds', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { refresh(); }, [refresh]);

  return { feeds, stats, loading, refresh, setFeeds };
}

export function useArticles(filters) {
  const api = useApi();
  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, v); });
      const data = await api.get(`/articles?${params}`);
      setArticles(data.articles);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error('Failed to load articles', err);
    } finally {
      setLoading(false);
    }
  }, [api, JSON.stringify(filters)]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  return { articles, total, pages, loading, reload: load, setArticles };
}

export function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getFavicon(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?sz=32&domain=${u.hostname}`;
  } catch { return null; }
}

