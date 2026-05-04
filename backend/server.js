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

  // 1. Verify session key is still valid
  const session = activeSessions[sessionKey];
  if (!session || Date.now() > session.expiresAt) {
    return res.status(400).json({ error: 'QR code expired. Ask teacher to refresh.' });
  }
  if (session.classId !== classId) {
    return res.status(400).json({ error: 'Wrong class.' });
  }

  // 2. Verify wallet is registered
  const studentId = registeredStudents[walletAddress];
  if (!studentId) {
    return res.status(400).json({ error: 'Wallet not registered. Contact your registrar.' });
  }

  // 3. Log attendance (blockchain metadata would go here in production)
  // For now we confirm the check-in and return success
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

app.listen(4000, () => console.log('ClassTer backend running on http://localhost:4000'));