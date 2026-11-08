const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

// Set defaults
db.defaults({
  feeds: [],
  articles: [],
  _feedCounter: 0,
  _articleCounter: 0,
}).write();

// Helper: get next id for a resource
function nextId(resource) {
  const key = `_${resource}Counter`;
  const id = db.get(key).value() + 1;
  db.set(key, id).write();
  return id;
}

module.exports = { db, nextId };
