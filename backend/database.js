const Database = require('better-sqlite3');
const path = require('path');

module.exports = function(dbPath = path.join(__dirname, 'classter.db')) {
  const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);
  const db = new Database(resolvedPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT,
      wallet_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      room TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT UNIQUE NOT NULL,
      class_id TEXT NOT NULL,
      teacher_id TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      tx_hash TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      check_in_time DATETIME,
      check_out_time DATETIME,
      status TEXT DEFAULT 'present',
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      signed_tx TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);

  const studentColumns = db.prepare("PRAGMA table_info(students)").all();
  if (!studentColumns.some(column => column.name === 'wallet_address')) {
    db.prepare('ALTER TABLE students ADD COLUMN wallet_address TEXT').run();
    console.log('Migrated students table: added wallet_address column.');
  }

  const classCount = db.prepare('SELECT COUNT(*) as count FROM classes').get();
  if (classCount.count === 0) {
    const insertClass = db.prepare('INSERT OR IGNORE INTO classes (class_id, name, room) VALUES (?, ?, ?)');
    insertClass.run('CS301', 'Blockchain Technology', 'Room 101');
    insertClass.run('CS201', 'Data Structures', 'Room 203');
    insertClass.run('IT401', 'Software Engineering', 'Lab 2');
    insertClass.run('CS101', 'Introduction to Programming', 'Room 105');
    console.log('Default classes seeded.');
  }

  return db;
};
