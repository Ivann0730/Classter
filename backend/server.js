// backend/server.js
const express = require('express');
const cors = require('cors');
const { BlockFrostAPI } = require("@blockfrost/blockfrost-js");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const api = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_KEY,
  network: "preprod",
});

// Database (Using a simple object for now - in production use MongoDB/PostgreSQL)
let registeredStudents = {}; 

// 1. Register Wallet Endpoint
app.post('/register', (req, res) => {
    const { studentId, walletAddress } = req.body;
    registeredStudents[studentId] = walletAddress;
    console.log(`Registered: ${studentId} with address ${walletAddress}`);
    res.json({ success: true, message: "Student registered locally!" });
});

// 2. Attendance Endpoint (Submits metadata to Cardano)
app.post('/mark-attendance', async (req, res) => {
    const { studentId, sessionCode } = req.body;
    const wallet = registeredStudents[studentId];

    if (!wallet) return res.status(400).json({ error: "Student not registered" });

    try {
        // This is where you'd typically build a transaction. 
        // For a beginner, we'll start by logging the intent to the blockchain metadata.
        console.log(`Sending Attendance for ${studentId} to Cardano...`);
        
        // Note: Real transactions require a "Signing" step from a wallet.
        res.json({ success: true, status: "Attendance Logged", studentId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(5000, () => console.log('Backend running on port 5000'));