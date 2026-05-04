import { useState } from "react";
import { BrowserWallet } from "@meshsdk/core";

export default function RegisterStudent() {
  const [studentId, setStudentId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [wallet, setWallet] = useState(null);

  const connectLace = async () => {
    setError(""); setConnecting(true);
    try {
      if (!window.cardano) {
        setError("No Cardano wallet found. Please install Lace from lace.io");
        setConnecting(false); return;
      }
      const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];

      // Use MeshJS BrowserWallet — same as StudentCheckin
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

  const handleRegister = async () => {
    setMessage(""); setError("");
    if (!studentId || !walletAddress) {
      setError("Please fill in your Student ID and connect your wallet."); return;
    }
    try {
      const res = await fetch("http://192.168.1.22:4000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, walletAddress }),
      });
      const data = await res.json();
      if (data.success) setMessage(data.message);
      else setError(data.error);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    }
  };

  return (
    <div style={{ fontFamily: "Times New Roman", maxWidth: 480, margin: "60px auto", padding: 32, border: "1px solid #000" }}>
      <h2 style={{ borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 24 }}>
        Student Wallet Registration
      </h2>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
        Connect your Lace wallet and link it to your school ID. Do this once.
      </p>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>STUDENT ID</label>
      <input
        value={studentId}
        onChange={e => setStudentId(e.target.value)}
        placeholder="e.g. 2021-0001"
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 14, marginBottom: 20, boxSizing: "border-box" }}
      />

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>WALLET ADDRESS</label>
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
        onClick={handleRegister}
        style={{ width: "100%", padding: 13, background: "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontSize: 13, fontWeight: "bold", letterSpacing: 2, cursor: "pointer" }}
      >
        REGISTER WALLET
      </button>

      {message && <p style={{ marginTop: 16, color: "#000", fontWeight: "bold" }}>✓ {message}</p>}
      {error && <p style={{ marginTop: 16, color: "red" }}>✗ {error}</p>}
    </div>
  );
}