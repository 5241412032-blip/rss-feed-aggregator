# RSS Feed Aggregator

A clean, fast RSS feed dashboard — built with React + Node.js + SQLite.

## Features
- 📡 Add any RSS, Atom, or RDF feed by URL
- 🗄️ SQLite caching — works offline once fetched
- 🔍 Search across all headlines
- 📂 Feed categories
- 🔖 Bookmark articles
- ✅ Read / unread tracking
- 🔄 Auto-refresh every 30 minutes
- 🌙 Dark mode UI

## Quick Start (Production)

Double-click **`start.bat`** — it installs deps, builds the React client, and opens the app automatically.

Or manually:

```bash
# Install
cd server && npm install && cd ..
cd client && npm install && npm run build && cd ..

# Run
node server/index.js
# Open http://localhost:3001
```

## Development Mode

```bash
# Double-click dev.bat, or:
# Terminal 1 - Backend
cd server && node index.js

# Terminal 2 - Frontend (hot reload)
cd client && npm start
# Open http://localhost:3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/feeds | List all feeds |
| POST | /api/feeds | Add a new feed |
| DELETE | /api/feeds/:id | Remove a feed |
| POST | /api/feeds/:id/refresh | Refresh one feed |
| POST | /api/feeds/refresh-all | Refresh all feeds |
| GET | /api/articles | List articles (filterable) |
| PATCH | /api/articles/:id/read | Mark read/unread |
| PATCH | /api/articles/:id/bookmark | Toggle bookmark |
| GET | /api/stats | Dashboard stats |

## Folder Structure

```
WT PROJECT/
├── server/
│   ├── index.js       # Express API server
│   ├── db.js          # SQLite schema & connection
│   ├── fetcher.js     # RSS parser & caching logic
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.js     # Main dashboard UI
│   │   ├── App.css    # Dark theme styles
│   │   ├── hooks.js   # API & data hooks
│   │   ├── AddFeedModal.js
│   │   └── Toast.js
│   └── package.json
├── start.bat          # One-click launcher
├── dev.bat            # Dev mode launcher
└── README.md
```

