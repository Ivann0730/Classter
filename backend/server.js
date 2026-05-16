const express = require('express');
const cors = require('cors');
const { authenticator } = require('otplib');
const { BlockFrostAPI } = require('@blockfrost/blockfrost-js');
const path = require('path');
require('dotenv').config();

const dbFile = process.env.DB_FILE || 'classter.db';
const db = require('./database')(path.join(__dirname, dbFile));

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const blockfrostProjectId = process.env.BLOCKFROST_KEY;
if (!blockfrostProjectId) {
  console.error('ERROR: Missing BLOCKFROST_KEY environment variable.');
  console.error('Set BLOCKFROST_KEY in Railway variables or in a local .env file.');
  process.exit(1);
}

const blockfrost = new BlockFrostAPI({
  projectId: blockfrostProjectId,
  network: 'preprod',
});

const activeSessions = {};

// ── CLASSES ───────────────────────────────────────────────────────────────────
app.get('/classes', (req, res) => {
  const classes = db.prepare('SELECT * FROM classes ORDER BY class_id').all();
  res.json({ classes });
});

app.post('/classes', (req, res) => {
  const { class_id, name, room } = req.body;
  if (!class_id || !name || !room) return res.status(400).json({ error: 'class_id, name and room required' });
  try {
    db.prepare('INSERT INTO classes (class_id, name, room) VALUES (?, ?, ?)').run(class_id, name, room);
    const classes = db.prepare('SELECT * FROM classes').all();
    res.json({ success: true, classes });
  } catch (e) {
    res.status(400).json({ error: 'Class ID already exists' });
  }
});

// ── STUDENTS ──────────────────────────────────────────────────────────────────
app.get('/students', (req, res) => {
  const students = db.prepare('SELECT * FROM students ORDER BY student_id').all();
  res.json({ students });
});

app.post('/students/register', (req, res) => {
  const { student_id, name, wallet_address } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  try {
    db.prepare('INSERT OR REPLACE INTO students (student_id, name, wallet_address) VALUES (?, ?, ?)')
      .run(student_id, name || student_id, wallet_address || null);
    res.json({ success: true, message: `Student ${student_id} registered successfully` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/students/:studentId/wallet', (req, res) => {
  const student = db.prepare('SELECT wallet_address FROM students WHERE student_id = ?').get(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!student.wallet_address) return res.status(404).json({ error: 'No wallet registered for this student' });
  res.json({ wallet_address: student.wallet_address });
});

// ── SESSIONS ──────────────────────────────────────────────────────────────────
app.post('/session/start', (req, res) => {
  const { classId, sessionKey, teacherId } = req.body;
  if (!classId || !sessionKey) return res.status(400).json({ error: 'classId and sessionKey required' });

  const expiresAt = Date.now() + 300000;
  activeSessions[sessionKey] = { classId, expiresAt };

  try {
    db.prepare('INSERT INTO sessions (session_key, class_id, teacher_id) VALUES (?, ?, ?)').run(sessionKey, classId, teacherId || 'teacher');
  } catch (e) {
    db.prepare('UPDATE sessions SET status = ? WHERE session_key = ?').run('active', sessionKey);
  }

  const session = db.prepare('SELECT * FROM sessions WHERE session_key = ?').get(sessionKey);
  res.json({ success: true, sessionId: session.id, sessionKey, classId, expiresAt });
});

app.post('/session/end', (req, res) => {
  const { sessionKey, classId } = req.body;
  const session = db.prepare('SELECT * FROM sessions WHERE session_key = ?').get(sessionKey);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const attendance = db.prepare(`
    SELECT a.*, s.name as student_name
    FROM attendance a
    LEFT JOIN students s ON a.student_id = s.student_id
    WHERE a.session_id = ?
    ORDER BY a.check_in_time
  `).all(session.id);

  const endTime = new Date().toISOString();
  db.prepare('UPDATE sessions SET ended_at = ?, status = ? WHERE id = ?').run(endTime, 'ended', session.id);
  delete activeSessions[sessionKey];

  res.json({ success: true, session: { ...session, ended_at: endTime }, attendance, readyForBlockchain: true });
});

app.post('/session/tx', (req, res) => {
  const { sessionKey, txHash } = req.body;
  db.prepare('UPDATE sessions SET tx_hash = ? WHERE session_key = ?').run(txHash, sessionKey);
  res.json({ success: true, txHash });
});

app.get('/sessions', (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all();
  res.json({ sessions });
});

app.get('/sessions/:sessionKey', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE session_key = ?').get(req.params.sessionKey);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const attendance = db.prepare(`
    SELECT a.*, s.name as student_name
    FROM attendance a
    LEFT JOIN students s ON a.student_id = s.student_id
    WHERE a.session_id = ?
    ORDER BY a.check_in_time
  `).all(session.id);
  res.json({ session, attendance });
});

// ── ATTENDANCE ────────────────────────────────────────────────────────────────
app.post('/checkin', (req, res) => {
  const { studentId, sessionKey, classId } = req.body;

  // Verify session is active
  const session = activeSessions[sessionKey];
  if (!session || Date.now() > session.expiresAt) {
    return res.status(400).json({ error: 'QR code expired. Ask teacher to refresh.' });
  }

  // Verify student exists
  const student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(studentId);
  if (!student) return res.status(400).json({ error: 'Student not registered. Please register first.' });

  // Get session from DB
  const dbSession = db.prepare('SELECT * FROM sessions WHERE session_key = ? AND status = ?').get(sessionKey, 'active');
  if (!dbSession) return res.status(400).json({ error: 'Session not found in database.' });

  // Check if already has attendance record
  const existing = db.prepare('SELECT * FROM attendance WHERE session_id = ? AND student_id = ?').get(dbSession.id, studentId);

  const now = new Date().toISOString();

  if (existing) {
    if (existing.check_out_time) {
      return res.json({ success: true, action: 'already_complete', studentId, name: student.name, checkIn: existing.check_in_time, checkOut: existing.check_out_time });
    }
    // Check out
    db.prepare('UPDATE attendance SET check_out_time = ? WHERE id = ?').run(now, existing.id);
    console.log(`Check-OUT: ${studentId} from ${classId} at ${now}`);
    return res.json({ success: true, action: 'checkout', studentId, name: student.name, checkIn: existing.check_in_time, checkOut: now });
  }

  // Check in
  db.prepare('INSERT INTO attendance (session_id, student_id, class_id, check_in_time) VALUES (?, ?, ?, ?)').run(dbSession.id, studentId, classId, now);
  console.log(`Check-IN: ${studentId} in ${classId} at ${now}`);
  res.json({ success: true, action: 'checkin', studentId, name: student.name, checkIn: now, checkOut: null });
});

// Receive a student's signed transaction (no submission) for later aggregation by the teacher
app.post('/session/sign', (req, res) => {
  const { sessionKey, studentId, signedTx } = req.body;
  if (!sessionKey || !studentId || !signedTx) return res.status(400).json({ error: 'sessionKey, studentId and signedTx required' });

  const session = db.prepare('SELECT * FROM sessions WHERE session_key = ?').get(sessionKey);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    // Basic server-side validation: ensure signedTx contains the studentId and classId strings
    const buf = Buffer.from(signedTx, 'hex');
    const classId = req.body.classId || '';
    const containsStudent = buf.includes(Buffer.from(String(studentId)));
    const containsClass = classId ? buf.includes(Buffer.from(String(classId))) : true;

    if (!containsStudent || !containsClass) {
      return res.status(400).json({ error: 'signedTx failed validation (metadata mismatch)' });
    }

    db.prepare('INSERT INTO signatures (session_id, student_id, signed_tx) VALUES (?, ?, ?)')
      .run(session.id, studentId, signedTx);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch all stored signatures for a session (teacher use)
app.get('/session/signatures/:sessionKey', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE session_key = ?').get(req.params.sessionKey);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const sigs = db.prepare('SELECT student_id, signed_tx, created_at FROM signatures WHERE session_id = ?').all(session.id);
  res.json({ success: true, signatures: sigs });
});

// Merge stored student signatures into the provided unsigned tx and return a partial signed tx
const CSL = (() => {
  try { return require('@emurgo/cardano-serialization-lib-nodejs'); } catch (e) { return null; }
})();

app.post('/session/merge', (req, res) => {
  const { sessionKey, unsignedTxHex } = req.body;
  if (!sessionKey || !unsignedTxHex) return res.status(400).json({ error: 'sessionKey and unsignedTxHex required' });

  if (!CSL) return res.status(500).json({ error: 'Cardano serialization lib not available on server' });

  const session = db.prepare('SELECT * FROM sessions WHERE session_key = ?').get(sessionKey);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const sigs = db.prepare('SELECT signed_tx FROM signatures WHERE session_id = ?').all(session.id);
  try {
    const unsignedTx = CSL.Transaction.from_bytes(Buffer.from(unsignedTxHex, 'hex'));
    const unsignedBody = unsignedTx.body();
    const aux = unsignedTx.auxiliary_data();

    // Build merged witness set
    const mergedWits = CSL.TransactionWitnessSet.new();
    const baseWits = unsignedTx.witness_set();
    if (baseWits && baseWits.vkeys()) mergedWits.set_vkeys(baseWits.vkeys());

    for (const row of sigs) {
      try {
        const stx = CSL.Transaction.from_bytes(Buffer.from(row.signed_tx, 'hex'));
        // Ensure the signed tx body matches the unsigned body
        if (!Buffer.from(stx.body().to_bytes()).equals(Buffer.from(unsignedBody.to_bytes()))) {
          continue; // skip mismatched signature
        }
        const sw = stx.witness_set();
        if (!sw) continue;
        const vkeys = sw.vkeys();
        if (!vkeys) continue;
        // Append vkeys to mergedWits
        const targetVkeys = mergedWits.vkeys() || CSL.Vkeywitnesses.new();
        for (let i = 0; i < vkeys.len(); i++) {
          targetVkeys.add(vkeys.get(i));
        }
        mergedWits.set_vkeys(targetVkeys);
      } catch (e) {
        console.warn('Skipping invalid stored signature', e.message);
      }
    }

    const mergedTx = CSL.Transaction.new(unsignedBody, mergedWits, aux);
    const mergedHex = Buffer.from(mergedTx.to_bytes()).toString('hex');
    res.json({ success: true, partialTx: mergedHex });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/attendance/:sessionKey', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE session_key = ?').get(req.params.sessionKey);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const attendance = db.prepare(`
    SELECT a.*, s.name as student_name
    FROM attendance a
    LEFT JOIN students s ON a.student_id = s.student_id
    WHERE a.session_id = ?
    ORDER BY a.check_in_time
  `).all(session.id);
  res.json({ session, attendance });
});

// ── BLOCK ─────────────────────────────────────────────────────────────────────
app.get('/block', async (req, res) => {
  try {
    const block = await blockfrost.blocksLatest();
    res.json({ height: block.height });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`ClassTer backend running on http://0.0.0.0:${PORT}`));