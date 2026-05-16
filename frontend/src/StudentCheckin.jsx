import { useState } from "react";
import { BrowserWallet, Transaction } from "@meshsdk/core";
import API_BASE from "./config";

export default function StudentCheckin({ activeSession }) {
  const [studentId, setStudentId] = useState("");
  const [sessionKey, setSessionKey] = useState(activeSession?.sessionKey || "");
  const [classId, setClassId] = useState(activeSession?.classId || "CS301");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [txHash, setTxHash] = useState("");

  const handleCheckin = async () => {
    setMessage(""); setError(""); setResult(null); setTxHash("");
    if (!studentId) { setError("Please enter your Student ID."); return; }
    if (!sessionKey) { setError("Please enter the session key."); return; }

    setSubmitting(true);
    try {
      // Step 1 — Verify check-in with backend
      const res = await fetch(`${API_BASE}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, sessionKey, classId }),
      });
      const data = await res.json();

      if (!data.success) { setError(data.error); setSubmitting(false); return; }
      setResult(data);

      // Step 2 — Get student wallet from backend
      try {
        const walletRes = await fetch(`${API_BASE}/students/${studentId}/wallet`);
        const walletData = await walletRes.json();

        if (!walletData.wallet_address) throw new Error("No wallet registered");

        // Step 3 — Connect student Lace wallet
        if (!window.cardano) throw new Error("Lace wallet not found");
        const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];
        const wallet = await BrowserWallet.enable(walletKey);

        // Step 4 — Verify it's the correct wallet
        const addresses = await wallet.getUsedAddresses();
        const addr = addresses.length > 0 ? addresses[0] : (await wallet.getUnusedAddresses())[0];

        if (addr !== walletData.wallet_address) {
          throw new Error("Wrong wallet connected. Please use the wallet you registered with.");
        }

        // Step 5 — Build and sign check-in transaction
        const metadata = {
          app: "ClassTer",
          action: data.action,
          student_id: studentId,
          class_id: classId,
          check_in: data.checkIn,
          check_out: data.checkOut || null,
          timestamp: new Date().toISOString(),
        };

        const tx = new Transaction({ initiator: wallet }).setMetadata(674, metadata);
        const unsignedTx = await tx.build();
        const signedTx = await wallet.signTx(unsignedTx);

        // Send the student's signature to the backend for later aggregation by the teacher.
        try {
          await fetch(`${API_BASE}/session/sign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionKey, studentId, signedTx }),
          });
          // Indicate to the student that their signature was recorded (no chain submission yet)
          setMessage("Signature recorded — teacher will submit the attendance transaction.");
        } catch (e) {
          console.warn('Failed to send signature to backend', e.message);
        }

      } catch (txErr) {
        // Check-in recorded even if tx fails
        console.warn("Wallet signing skipped:", txErr.message);
      }

      if (data.action === "checkin") setMessage(`Checked IN at ${new Date(data.checkIn).toLocaleTimeString()}`);
      else if (data.action === "checkout") setMessage(`Checked OUT at ${new Date(data.checkOut).toLocaleTimeString()}`);
      else setMessage("Attendance already complete.");

    } catch {
      setError("Could not reach the server. Is the backend running?");
    }
    setSubmitting(false);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", border: "1px solid #000",
    fontFamily: "Times New Roman", fontSize: 14, marginBottom: 16, boxSizing: "border-box"
  };

  return (
    <div style={{ fontFamily: "Times New Roman", maxWidth: 480, margin: "60px auto", padding: 32, border: "1px solid #000" }}>
      <h2 style={{ borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 8 }}>Student Check-In / Check-Out</h2>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 24, lineHeight: 1.6 }}>
        Enter your Student ID and session key. Your Lace wallet will be asked to sign your attendance.
      </p>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>STUDENT ID</label>
      <input value={studentId} onChange={e => setStudentId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCheckin()} placeholder="e.g. 2021-0001" style={inputStyle} />

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>CLASS</label>
      <select value={classId} onChange={e => setClassId(e.target.value)} style={inputStyle}>
        <option value="CS301">CS301 — Blockchain Technology</option>
        <option value="CS201">CS201 — Data Structures</option>
        <option value="IT401">IT401 — Software Engineering</option>
        <option value="CS101">CS101 — Introduction to Programming</option>
      </select>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>SESSION KEY (from QR code)</label>
      <input value={sessionKey} onChange={e => setSessionKey(e.target.value.toUpperCase())} placeholder="e.g. Q1MZMDE6NTKYNJMX" style={inputStyle} />

      <button onClick={handleCheckin} disabled={submitting} style={{ width: "100%", padding: 13, background: submitting ? "#555" : "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontSize: 13, fontWeight: "bold", letterSpacing: 2, cursor: submitting ? "not-allowed" : "pointer", textTransform: "uppercase" }}>
        {submitting ? "PROCESSING..." : "CHECK IN / CHECK OUT"}
      </button>

      {result && (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #000", background: "#f9f9f9" }}>
          <p style={{ fontWeight: "bold", fontSize: 14, marginBottom: 10 }}>✓ {message}</p>
          {result.name && <p style={{ fontSize: 12, marginBottom: 4 }}>Name: <strong>{result.name}</strong></p>}
          {result.checkIn && <p style={{ fontSize: 12, marginBottom: 4 }}>Check-in: <strong>{new Date(result.checkIn).toLocaleTimeString()}</strong></p>}
          {result.checkOut && <p style={{ fontSize: 12, marginBottom: 4 }}>Check-out: <strong>{new Date(result.checkOut).toLocaleTimeString()}</strong></p>}
          {txHash && (
            <>
              <p style={{ fontSize: 11, color: "#555", marginTop: 8, marginBottom: 4 }}>Your attendance transaction:</p>
              <p style={{ fontSize: 10, fontFamily: "monospace", wordBreak: "break-all", marginBottom: 8 }}>{txHash}</p>
              <a href={`https://preprod.cardanoscan.io/transaction/${txHash}`} target="_blank" rel="noreferrer"
                style={{ display: "block", padding: 10, background: "#000", color: "#fff", textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 11, letterSpacing: 1 }}>
                VIEW ON CARDANO EXPLORER →
              </a>
            </>
          )}
        </div>
      )}
      {error && <p style={{ marginTop: 16, color: "red" }}>✗ {error}</p>}
    </div>
  );
}