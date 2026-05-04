const express = require('express');
const cors = require('cors');
const { authenticator } = require('otplib');
const { BlockFrostAPI } = require('@blockfrost/blockfrost-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const api = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_KEY,
  network: 'preprod',
});

// In-memory storage (replace with a real DB later)
const registeredStudents = {}; // { walletAddress: studentId }
const activeSessions = {};     // { sessionKey: { classId, expiresAt } }

// ── Route 1: Register student wallet ─────────────────────────────────────────
app.post('/register', (req, res) => {
  const { studentId, walletAddress } = req.body;
  if (!studentId || !walletAddress) {
    return res.status(400).json({ error: 'studentId and walletAddress are required' });
  }
  registeredStudents[walletAddress] = studentId;
  console.log(`Registered: ${studentId} -> ${walletAddress}`);
  res.json({ success: true, message: `Wallet linked to ${studentId}` });
});

// ── Route 2: Start a session and get session key ──────────────────────────────
app.post('/session/start', (req, res) => {
  const { classId } = req.body;
  if (!classId) return res.status(400).json({ error: 'classId required' });

  const sessionKey = authenticator.generate(process.env.TOTP_SECRET || 'classter-secret');
  const expiresAt = Date.now() + 30000; // 30 seconds
  activeSessions[sessionKey] = { classId, expiresAt };

  res.json({ sessionKey, classId, expiresAt });
});

// ── Route 3: Student checks in ────────────────────────────────────────────────
app.post('/checkin', async (req, res) => {
  const { walletAddress, sessionKey, classId } = req.body;

  // Check all active sessions - accept if any match within 5 minutes
  const session = activeSessions[sessionKey];
  if (!session || Date.now() > session.expiresAt) {
    // Also try to auto-accept if session key matches current or previous window
    const currentWindow = Math.floor(Date.now() / 300000);
    const prevWindow = currentWindow - 1;
    const isValid = [currentWindow, prevWindow, currentWindow + 1].some(w => {
      ['CS301','CS201','IT401','CS101'].forEach(c => {
        const testKey = Buffer.from(`${c}:${w}:${4669611}`).toString('base64').slice(0,16).toUpperCase();
        if (testKey === sessionKey) activeSessions[sessionKey] = { classId: c, expiresAt: Date.now() + 300000 };
      });
      return activeSessions[sessionKey];
    });

    if (!activeSessions[sessionKey]) {
      return res.status(400).json({ error: 'QR code expired. Ask teacher to refresh.' });
    }
  }

  const studentId = registeredStudents[walletAddress];
  if (!studentId) {
    return res.status(400).json({ error: 'Wallet not registered. Contact your registrar.' });
  }

  console.log(`Check-in: ${studentId} in ${classId} at ${new Date().toISOString()}`);
  res.json({
    success: true,
    studentId,
    classId,
    timestamp: new Date().toISOString(),
    message: 'Attendance recorded!',
  });
});

// ── Route 4: Get latest block height from Cardano ─────────────────────────────
app.get('/block', async (req, res) => {
  try {
    const block = await api.blocksLatest();
    res.json({ height: block.height });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add this route to get all registered students
app.get('/students', (req, res) => {
  const list = Object.entries(registeredStudents).map(([walletAddress, studentId]) => ({
    studentId,
    walletAddress,
  }));
  res.json({ students: list });
});

// Update session/start to accept a sessionKey from frontend
app.post('/session/start', (req, res) => {
  const { classId, sessionKey } = req.body;
  if (!classId) return res.status(400).json({ error: 'classId required' });

  const key = sessionKey || authenticator.generate(process.env.TOTP_SECRET || 'classter-secret');
  const expiresAt = Date.now() + 300000; // 5 minutes
  activeSessions[key] = { classId, expiresAt };

  res.json({ sessionKey: key, classId, expiresAt });
});

app.listen(4000, () => console.log('ClassTer backend running on http://localhost:4000'));