const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'fotobooth.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    date       TEXT,
    op_user    TEXT NOT NULL UNIQUE,
    op_pass    TEXT NOT NULL,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id           TEXT    PRIMARY KEY,
    event_id     TEXT    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    filename     TEXT    NOT NULL,
    url          TEXT    NOT NULL,
    timestamp    TEXT    NOT NULL,
    in_slideshow INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_id, timestamp);
`);

const q = {
  // Events
  createEvent:     db.prepare(`INSERT INTO events (id,name,date,op_user,op_pass) VALUES (?,?,?,?,?)`),
  listEvents:      db.prepare(`
    SELECT e.*, (SELECT COUNT(*) FROM photos p WHERE p.event_id=e.id) AS photo_count
    FROM events e ORDER BY e.created_at DESC
  `),
  getEventById:    db.prepare(`SELECT * FROM events WHERE id=?`),
  getEventByUser:  db.prepare(`SELECT * FROM events WHERE op_user=? AND active=1`),
  setEventActive:  db.prepare(`UPDATE events SET active=? WHERE id=?`),
  updateEvent:     db.prepare(`UPDATE events SET name=COALESCE(?,name), date=COALESCE(?,date), op_user=COALESCE(?,op_user), op_pass=COALESCE(?,op_pass) WHERE id=?`),
  deleteEvent:     db.prepare(`DELETE FROM events WHERE id=?`),

  // Photos
  addPhoto:            db.prepare(`INSERT INTO photos (id,event_id,filename,url,timestamp) VALUES (?,?,?,?,?)`),
  getPhotos:           db.prepare(`SELECT * FROM photos WHERE event_id=? ORDER BY timestamp DESC`),
  getPhoto:            db.prepare(`SELECT * FROM photos WHERE id=? AND event_id=?`),
  deletePhoto:         db.prepare(`DELETE FROM photos WHERE id=? AND event_id=?`),
  toggleSlideshow:     db.prepare(`UPDATE photos SET in_slideshow = CASE WHEN in_slideshow=1 THEN 0 ELSE 1 END WHERE id=? AND event_id=?`),
  getSlideshowPhotos:  db.prepare(`SELECT * FROM photos WHERE event_id=? AND in_slideshow=1 ORDER BY timestamp ASC`),
};

module.exports = { db, q };
