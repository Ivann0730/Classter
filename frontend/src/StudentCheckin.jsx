import { useState } from "react";
import { BrowserWallet, Transaction } from "@meshsdk/core";

export default function StudentCheckin({ activeSession }) {
  const [walletAddress, setWalletAddress] = useState("");
  const [sessionKey, setSessionKey] = useState(activeSession?.sessionKey || "");
  const [classId, setClassId] = useState(activeSession?.classId || "CS301");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [wallet, setWallet] = useState(null);

  const connectLace = async () => {
    setError(""); setConnecting(true);
    try {
      if (!window.cardano) {
        setError("No Cardano wallet found. Please install Lace from lace.io");
        setConnecting(false); return;
      }

      const walletKey = window.cardano.lace ? "lace"
        : Object.keys(window.cardano)[0];

      if (!walletKey) {
        setError("No Cardano wallet detected.");
        setConnecting(false); return;
      }

      // Connect using MeshJS BrowserWallet
      const connectedWallet = await BrowserWallet.enable(walletKey);
      const addresses = await connectedWallet.getUsedAddresses();
      const addr = addresses.length > 0
        ? addresses[0]
        : (await connectedWallet.getUnusedAddresses())[0];

      setWallet(connectedWallet);
      setWalletAddress(addr);
    } catch (e) {
      setError("Wallet connection failed: " + e.message);
    }
    setConnecting(false);
  };

  const handleCheckin = async () => {
    setMessage(""); setError(""); setTxHash("");

    if (!walletAddress || !wallet) {
      setError("Please connect your Lace wallet first."); return;
    }
    if (!sessionKey) {
      setError("Please enter the session key from the QR code."); return;
    }

    setSubmitting(true);

    try {
      // Step 1 — Verify session key with backend
      const res = await fetch("http://192.168.1.22:4000/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, sessionKey, classId }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        setSubmitting(false); return;
      }

      // Step 2 — Build metadata transaction using MeshJS
      const metadata = {
        674: {
          app: "ClassTer",
          class_id: classId,
          student_id: data.studentId,
          session_key: sessionKey,
          timestamp: new Date().toISOString(),
          network: "preprod",
        }
      };

      const tx = new Transaction({ initiator: wallet })
        .setMetadata(674, metadata[674]);

      // Step 3 — Build, sign and submit
      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx);
      const hash = await wallet.submitTx(signedTx);

      setTxHash(hash);
      setMessage(`Attendance recorded for ${data.studentId} in ${classId}!`);

    } catch (e) {
      setError("Transaction failed: " + e.message);
    }

    setSubmitting(false);
  };

  return (
    <div style={{ fontFamily: "Times New Roman", maxWidth: 520, margin: "60px auto", padding: 32, border: "1px solid #000" }}>
      <h2 style={{ borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 24 }}>
        Student Check-In
      </h2>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>CLASS</label>
      <select
        value={classId}
        onChange={e => setClassId(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 14, marginBottom: 16, boxSizing: "border-box" }}
      >
        <option value="CS301">CS301 — Blockchain Technology</option>
        <option value="CS201">CS201 — Data Structures</option>
        <option value="IT401">IT401 — Software Engineering</option>
        <option value="CS101">CS101 — Introduction to Programming</option>
      </select>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>SESSION KEY (from QR code)</label>
      <input
        value={sessionKey}
        onChange={e => setSessionKey(e.target.value.toUpperCase())}
        placeholder="e.g. Q1MZMDE6NTKYNJA5"
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 14, marginBottom: 20, boxSizing: "border-box" }}
      />

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>WALLET</label>
      {walletAddress ? (
        <div style={{ padding: "10px 12px", border: "1px solid #000", fontSize: 11, marginBottom: 8, wordBreak: "break-all", background: "#f9f9f9" }}>
          {walletAddress}
        </div>
      ) : (
        <div style={{ padding: "10px 12px", border: "1px dashed #aaa", fontSize: 12, marginBottom: 8, color: "#aaa" }}>
          No wallet connected yet
        </div>
      )}

      <button
        onClick={connectLace}
        disabled={connecting}
        style={{ width: "100%", padding: 11, background: "#fff", color: "#000", border: "2px solid #000", fontFamily: "Times New Roman", fontSize: 13, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", marginBottom: 16 }}
      >
        {connecting ? "Connecting..." : walletAddress ? "↺ Reconnect Lace Wallet" : "Connect Lace Wallet"}
      </button>

      <button
        onClick={handleCheckin}
        disabled={submitting}
        style={{ width: "100%", padding: 13, background: submitting ? "#555" : "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontSize: 13, fontWeight: "bold", letterSpacing: 2, cursor: submitting ? "not-allowed" : "pointer" }}
      >
        {submitting ? "SUBMITTING TO BLOCKCHAIN..." : "CHECK IN"}
      </button>

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