import { useState, useRef } from 'react';
import './App.css';
import { useAggregator, formatDate, getFavicon } from './hooks';
import AddFeedModal from './AddFeedModal';
import Toast from './Toast';

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Rss: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Refresh: ({ spinning }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      className={spinning ? 'spinning' : ''}>
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Trash: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  Bookmark: ({ filled }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Link: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
  Inbox: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  BookmarkNav: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Star: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    feeds, articles, readIds, bookmarkIds,
    loading, refreshingIds,
    addFeed, removeFeed, refreshFeed, refreshAll,
    markRead, markAllRead, toggleBookmark,
    stats,
  } = useAggregator();

  const [selectedFeedId, setSelectedFeedId] = useState(null);
  const [view, setView] = useState('all'); // 'all' | 'unread' | 'bookmarks'
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const searchTimer = useRef(null);

  function toast(message, type = 'info') {
    const id = ++toastIdRef.current;
    setToasts(t => [...t, { id, message, type }]);
  }
  function removeToast(id) { setToasts(t => t.filter(x => x.id !== id)); }

  function handleSearchChange(val) {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 350);
  }

  // ── Filter articles ──────────────────────────────────────────────────────────
  let filtered = articles;
  if (selectedFeedId) filtered = filtered.filter(a => a.feed_id === selectedFeedId);
  if (view === 'unread') filtered = filtered.filter(a => !readIds.has(a.id));
  if (view === 'bookmarks') filtered = filtered.filter(a => bookmarkIds.has(a.id));
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    );
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function handleAddFeed(url, category) {
    const result = await addFeed(url, category);
    toast(`✅ Added "${result.title}" — ${result.count} articles`, 'success');
  }

  async function handleDeleteFeed(feedId, e) {
    e.stopPropagation();
    if (!window.confirm('Remove this feed and all its articles?')) return;
    removeFeed(feedId);
    if (selectedFeedId === feedId) { setSelectedFeedId(null); setView('all'); }
    toast('Feed removed', 'info');
  }

  async function handleRefreshFeed(feedId, e) {
    e.stopPropagation();
    try {
      const r = await refreshFeed(feedId);
      toast(`Refreshed: ${r.count} articles`, 'success');
    } catch (err) {
      toast('Refresh failed: ' + err.message, 'error');
    }
  }

  async function handleRefreshAll() {
    setRefreshingAll(true);
    try {
      await refreshAll();
      toast('All feeds refreshed', 'success');
    } catch {
      toast('Some feeds failed to refresh', 'error');
    } finally {
      setRefreshingAll(false);
    }
  }

  function openArticle(article) {
    if (!readIds.has(article.id)) markRead(article.id, true);
    if (article.link) window.open(article.link, '_blank', 'noopener,noreferrer');
  }

  const currentFeed = feeds.find(f => f.id === selectedFeedId);
  const viewTitle = currentFeed ? currentFeed.title
    : view === 'unread' ? 'Unread Articles'
    : view === 'bookmarks' ? 'Bookmarked Articles'
    : 'All Articles';

  // Per-feed unread counts
  const unreadByFeed = {};
  articles.forEach(a => {
    if (!readIds.has(a.id)) unreadByFeed[a.feed_id] = (unreadByFeed[a.feed_id] || 0) + 1;
  });

  return (
    <div className="app-layout">
      {/* ─── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Icon.Rss />
            RSS Aggregator
          </div>
          <div className="sidebar-stats">
            <div className="stat-chip">
              <div className="num">{stats.total_feeds}</div>
              <div className="lbl">Feeds</div>
            </div>
            <div className="stat-chip">
              <div className="num">{stats.unread_articles}</div>
              <div className="lbl">Unread</div>
            </div>
          </div>
        </div>

        <div className="sidebar-nav">
          <button className={`nav-item ${view === 'all' && !selectedFeedId ? 'active' : ''}`}
            onClick={() => { setView('all'); setSelectedFeedId(null); }}>
            <Icon.Inbox /> All Articles
            <span className="badge">{stats.total_articles}</span>
          </button>
          <button className={`nav-item ${view === 'unread' && !selectedFeedId ? 'active' : ''}`}
            onClick={() => { setView('unread'); setSelectedFeedId(null); }}>
            <Icon.Star /> Unread
            <span className="badge">{stats.unread_articles}</span>
          </button>
          <button className={`nav-item ${view === 'bookmarks' ? 'active' : ''}`}
            onClick={() => { setView('bookmarks'); setSelectedFeedId(null); }}>
            <Icon.BookmarkNav /> Bookmarks
            <span className="badge">{stats.bookmarked_articles}</span>
          </button>
        </div>

        <div className="feeds-section">
          <div className="feeds-section-title">
            MY FEEDS <span>{feeds.length}</span>
          </div>

          {loading && feeds.length === 0 && (
            <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Loading feeds...
            </div>
          )}

          {feeds.map(feed => {
            const favicon = getFavicon(feed.url);
            const initials = (feed.title || 'F')[0].toUpperCase();
            const isRefreshing = refreshingIds.has(feed.id);
            const unread = unreadByFeed[feed.id] || 0;
            return (
              <div
                key={feed.id}
                className={`feed-item ${selectedFeedId === feed.id ? 'active' : ''}`}
                onClick={() => { setSelectedFeedId(feed.id); setView('all'); }}
              >
                {favicon
                  ? <img src={favicon} alt="" className="feed-favicon" onError={e => e.target.style.display='none'} />
                  : <div className="feed-favicon-placeholder">{initials}</div>}
                <span className="feed-name" title={feed.title}>{feed.title || feed.url}</span>
                {unread > 0 && <span className="feed-unread">{unread}</span>}
                <div className="feed-actions">
                  <button className="icon-btn" title="Refresh" style={{ color: 'var(--accent)' }}
                    onClick={e => handleRefreshFeed(feed.id, e)}>
                    <Icon.Refresh spinning={isRefreshing} />
                  </button>
                  <button className="icon-btn" title="Remove" onClick={e => handleDeleteFeed(feed.id, e)}>
                    <Icon.Trash />
                  </button>
                </div>
              </div>
            );
          })}

          {!loading && feeds.length === 0 && (
            <div style={{ padding: '12px 10px', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
              No feeds yet. Add your first RSS feed below!
            </div>
          )}
        </div>

        <div className="add-feed-area">
          <button className="btn-add-feed" onClick={() => setShowAddModal(true)}>
            <Icon.Plus /> Add RSS Feed
          </button>
        </div>
      </aside>

      {/* ─── Main ─────────────────────────────────────────────────────── */}
      <main className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">{viewTitle}</div>
            <div className="topbar-subtitle">
              {filtered.length} articles{search ? ` matching "${search}"` : ''}
            </div>
          </div>

          <div className="search-bar">
            <span className="search-icon"><Icon.Search /></span>
            <input
              type="text"
              placeholder="Search articles..."
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm"
              onClick={() => markAllRead(selectedFeedId || null)}>
              <Icon.Check /> Mark all read
            </button>
            <button className="btn btn-ghost btn-sm"
              onClick={handleRefreshAll} disabled={refreshingAll}>
              <Icon.Refresh spinning={refreshingAll} />
              {refreshingAll ? 'Refreshing...' : 'Refresh All'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Icon.Plus /> Add Feed
            </button>
          </div>
        </div>

        <div className="article-list-container">
          {loading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: 90, borderRadius: 10 }} className="skeleton" />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="empty-state">
              <Icon.Rss />
              <h3>{feeds.length === 0 ? 'No feeds yet' : 'No articles found'}</h3>
              <p>
                {feeds.length === 0
                  ? 'Click "Add RSS Feed" to subscribe to your first news source.'
                  : 'Try adjusting filters, changing the view, or adding more feeds.'}
              </p>
              {feeds.length === 0 && (
                <button className="btn btn-primary" style={{ marginTop: 8 }}
                  onClick={() => setShowAddModal(true)}>
                  <Icon.Plus /> Add Your First Feed
                </button>
              )}
            </div>
          )}

          {filtered.map(article => {
            const isRead = readIds.has(article.id);
            const isBookmarked = bookmarkIds.has(article.id);
            return (
              <ArticleCard
                key={article.id}
                article={article}
                isRead={isRead}
                isBookmarked={isBookmarked}
                onOpen={() => openArticle(article)}
                onToggleRead={() => markRead(article.id, !isRead)}
                onBookmark={() => toggleBookmark(article.id)}
              />
            );
          })}
        </div>
      </main>

      {showAddModal && (
        <AddFeedModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddFeed}
        />
      )}
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────
function ArticleCard({ article, isRead, isBookmarked, onOpen, onToggleRead, onBookmark }) {
  return (
    <div className={`article-card ${isRead ? 'read' : ''}`} onClick={onOpen}>
      {!isRead && <div className="article-unread-dot" />}

      {article.image_url && (
        <img
          src={article.image_url}
          alt=""
          className="article-image"
          onError={e => e.target.style.display = 'none'}
        />
      )}

      <div className="article-body">
        <div className="article-meta">
          <span className="article-feed-tag">{article.feed_title || 'Feed'}</span>
          {article.feed_category && article.feed_category !== 'General' && (
            <span className="article-feed-tag"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
              {article.feed_category}
            </span>
          )}
          {article.author && <span className="article-author">by {article.author}</span>}
          <span className="article-date">{formatDate(article.pub_date)}</span>
        </div>

        <div className="article-title">{article.title}</div>

        {article.description && (
          <div className="article-desc">{article.description}</div>
        )}

        <div className="article-actions" onClick={e => e.stopPropagation()}>
          <button
            className={`action-btn ${isBookmarked ? 'bookmarked' : ''}`}
            onClick={onBookmark}>
            <Icon.Bookmark filled={isBookmarked} />
            {isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
          <button className="action-btn" onClick={onToggleRead}>
            <Icon.Check />
            {isRead ? 'Mark unread' : 'Mark read'}
          </button>
          {article.link && (
            <button className="action-btn"
              onClick={() => window.open(article.link, '_blank', 'noopener,noreferrer')}>
              <Icon.Link /> Open
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
