import { useState } from 'react';

export default function AddFeedModal({ onClose, onAdd }) {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('General');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = ['General', 'Technology', 'Science', 'Business', 'Sports', 'Entertainment', 'Health', 'World News', 'Politics'];

  const presets = [
    { label: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
    { label: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { label: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
    { label: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { label: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onAdd(url.trim(), category);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            <span style={{ marginRight: 8 }}>📡</span> Add RSS Feed
          </h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">RSS Feed URL *</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={e => setUrl(e.target.value)}
              autoFocus
              required
            />
            <p className="form-hint">Paste any RSS, Atom, or RDF feed URL</p>
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Quick Add Presets</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {presets.map(p => (
                <button
                  key={p.url}
                  type="button"
                  className="filter-chip"
                  onClick={() => setUrl(p.url)}
                  style={{ cursor: 'pointer' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="form-error">❌ {error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /> Fetching...</> : '➕ Add Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

