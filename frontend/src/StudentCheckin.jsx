import { useState } from "react";
import { BrowserWallet, Transaction } from "@meshsdk/core";
import API_BASE from "./config"; 

export default function StudentCheckin({ activeSession }) {
  const [studentId, setStudentId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [sessionKey, setSessionKey] = useState(activeSession?.sessionKey || "");
  const [classId, setClassId] = useState(activeSession?.classId || "CS301");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [wallet, setWallet] = useState(null);
  const [walletReady, setWalletReady] = useState(false);

  // Step 1 — Student enters ID, system fetches their wallet
  const lookupStudent = async () => {
    setError(""); setWalletAddress(""); setWalletReady(false);
    if (!studentId) { setError("Please enter your Student ID."); return; }
    setLooking(true);
    try {
      const res = await fetch(`${API_BASE}/student/${studentId}`);
      const data = await res.json();
      if (res.ok) {
        setWalletAddress(data.walletAddress);
        // Auto-connect Lace in background
        await connectWallet(data.walletAddress);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Could not reach the server. Is the backend running?");
    }
    setLooking(false);
  };

  // Step 2 — Connect Lace silently using the saved wallet address
  const connectWallet = async (savedAddress) => {
    try {
      if (!window.cardano) return;
      const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];
      const connectedWallet = await BrowserWallet.enable(walletKey);
      const addresses = await connectedWallet.getUsedAddresses();
      const addr = addresses.length > 0
        ? addresses[0]
        : (await connectedWallet.getUnusedAddresses())[0];

      // Verify connected wallet matches registered wallet
      if (addr !== savedAddress) {
        setError("Connected wallet does not match your registered wallet. Please use the same Lace account you registered with.");
        return;
      }
      setWallet(connectedWallet);
      setWalletReady(true);
    } catch (e) {
      setError("Wallet connection failed: " + e.message);
    }
  };

  const handleCheckin = async () => {
  setMessage(""); setError(""); setTxHash("");

  if (!studentId || !walletAddress || !sessionKey) {
    setError("Please ensure all fields are filled.");
    return;
  }

  setSubmitting(true);
  try {
    // Step 1 — Verify with backend
    const res = await fetch(`${API_BASE}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, sessionKey, classId }),
    });
    const data = await res.json();

    if (!data.success) {
      setError(data.error);
      setSubmitting(false); 
      return;
    }

    // --- TEMPORARY RECORDING CODE START ---
    // We set the success message immediately because the backend validated the student.
    // This allows the student to see they are "checked in" even if the next block fails.
    setMessage(`Attendance recorded for ${data.studentId} in ${classId}! (Local Sync)`);
    // --- TEMPORARY RECORDING CODE END ---

    try {
      if (!window.cardano) throw new Error("No Cardano wallet found.");
      
      const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];
      const connectedWallet = await BrowserWallet.enable(walletKey);

      const metadata = {
        app: "ClassTer",
        class_id: classId,
        student_id: data.studentId,
        session_key: sessionKey,
        timestamp: new Date().toISOString(),
        network: "preprod",
      };

      const tx = new Transaction({ initiator: connectedWallet }).setMetadata(674, metadata);
      const unsignedTx = await tx.build();
      const signedTx = await connectedWallet.signTx(unsignedTx);
      const hash = await connectedWallet.submitTx(signedTx);

      setTxHash(hash);
      // Update message to confirm blockchain sync
      setMessage(`Attendance recorded and synced to Blockchain!`);

    } catch (txError) {
      console.warn("Blockchain sync failed:", txError.message);
      // We don't clear the success message here so the student knows the backend got it.
      setError("Note: Attendance saved locally, but blockchain sync failed: " + txError.message);
    }

  } catch {
    setError("Could not reach the server.");
  }
  setSubmitting(false);
};

  const inputStyle = {
    width: "100%", padding: "10px 12px", border: "1px solid #000",
    fontFamily: "Times New Roman", fontSize: 14,
    marginBottom: 16, boxSizing: "border-box"
  };
  const btnStyle = (bg, color) => ({
    width: "100%", padding: 13, background: bg, color,
    border: "2px solid #000", fontFamily: "Times New Roman",
    fontSize: 13, fontWeight: "bold", letterSpacing: 2,
    cursor: "pointer", marginBottom: 12, textTransform: "uppercase"
  });

  return (
    <div style={{ fontFamily: "Times New Roman", maxWidth: 520, margin: "60px auto", padding: 32, border: "1px solid #000" }}>
      <h2 style={{ borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 24 }}>
        Student Check-In
      </h2>

      {/* Step 1 — Student ID lookup */}
      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
        STEP 1 — ENTER YOUR STUDENT ID
      </label>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookupStudent()}
          placeholder="e.g. 2021-0001"
          style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
        />
        <button
          onClick={lookupStudent}
          disabled={looking}
          style={{ padding: "10px 16px", background: "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {looking ? "..." : "Look Up"}
        </button>
      </div>

      {/* Wallet status */}
      {walletAddress && (
        <div style={{ padding: "10px 12px", border: `1px solid ${walletReady ? "#000" : "#aaa"}`, fontSize: 11, marginBottom: 16, background: walletReady ? "#f9f9f9" : "#fff" }}>
          <div style={{ fontWeight: "bold", marginBottom: 4, fontSize: 12 }}>
            {walletReady ? "✓ Wallet verified" : "⚠ Wallet found but not connected"}
          </div>
          <div style={{ wordBreak: "break-all", color: "#555" }}>{walletAddress}</div>
        </div>
      )}

      {/* Step 2 — Class and session key */}
      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
        STEP 2 — SELECT CLASS
      </label>
      <select
        value={classId}
        onChange={e => setClassId(e.target.value)}
        style={{ ...inputStyle }}
      >
        <option value="CS301">CS301 — Blockchain Technology</option>
        <option value="CS201">CS201 — Data Structures</option>
        <option value="IT401">IT401 — Software Engineering</option>
        <option value="CS101">CS101 — Introduction to Programming</option>
      </select>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
        STEP 3 — ENTER SESSION KEY (from QR code)
      </label>
      <input
        value={sessionKey}
        onChange={e => setSessionKey(e.target.value.toUpperCase())}
        placeholder="e.g. Q1MZMDE6NTKYNJMX"
        style={inputStyle}
      />

      {/* Check in button */}
      <button
        onClick={handleCheckin}
        disabled={submitting}
        style={btnStyle(submitting ? "#555" : "#000", "#fff")}
      >
        {submitting ? "SUBMITTING TO BLOCKCHAIN..." : "CHECK IN"}
      </button>

      {/* If Lace not connected, show manual connect option */}
      {walletAddress && !walletReady && (
        <button
          onClick={() => connectWallet(walletAddress)}
          style={btnStyle("#fff", "#000")}
        >
          Connect Lace Wallet Manually
        </button>
      )}

      {/* Result */}
      {message && (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #000", background: "#f9f9f9" }}>
          <p style={{ fontWeight: "bold", marginBottom: 8 }}>✓ {message}</p>
          {txHash && (
            <>
              <p style={{ fontSize: 11, marginBottom: 6 }}>Transaction Hash:</p>
              <p style={{ fontSize: 10, wordBreak: "break-all", fontFamily: "monospace", marginBottom: 10 }}>{txHash}</p>
              <a
                href={`https://preprod.cardanoscan.io/transaction/${txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", padding: "10px", background: "#000", color: "#fff", textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 12, letterSpacing: 1 }}
              >
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