import { useState, useEffect } from "react";
import { BrowserWallet } from "@meshsdk/core";
import API_BASE from "./config";

export default function RegisterStudent() {
  const [studentId, setStudentId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/classes`)
      .then(r => r.json())
      .then(d => setAvailableClasses(d.classes || []))
      .catch(() => {});
  }, []);

  const connectLace = async () => {
    setError(""); setConnecting(true);
    try {
      if (!window.cardano) { setError("Lace wallet not found."); setConnecting(false); return; }
      const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];
      const connectedWallet = await BrowserWallet.enable(walletKey);
      const addresses = await connectedWallet.getUsedAddresses();
      const addr = addresses.length > 0 ? addresses[0] : (await connectedWallet.getUnusedAddresses())[0];
      setWalletAddress(addr);
    } catch (e) { setError("Wallet connection failed: " + e.message); }
    setConnecting(false);
  };

  const toggleClass = (classId) => {
    setSelectedClasses(prev =>
      prev.includes(classId) ? prev.filter(c => c !== classId) : [...prev, classId]
    );
  };

  const handleRegister = async () => {
    setMessage(""); setError("");
    if (!studentId || !walletAddress) { setError("Please fill in your Student ID and connect your wallet."); return; }
    if (selectedClasses.length === 0) { setError("Please select at least one class."); return; }
    setRegistering(true);
    try {
      // Register wallet
      const regRes = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, walletAddress }),
      });
      const regData = await regRes.json();
      if (!regData.success) { setError(regData.error); setRegistering(false); return; }

      // Enroll in each selected class
      for (const classId of selectedClasses) {
        await fetch(`${API_BASE}/enroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, walletAddress, classId }),
        });
      }
      setMessage(`Wallet registered and enrollment request sent for: ${selectedClasses.join(", ")}`);
    } catch { setError("Could not reach the server."); }
    setRegistering(false);
  };

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 14, marginBottom: 16, boxSizing: "border-box" };

  return (
    <div style={{ fontFamily: "Times New Roman", maxWidth: 520, margin: "60px auto", padding: 32, border: "1px solid #000" }}>
      <h2 style={{ borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 24 }}>Student Wallet Registration</h2>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>Connect your Lace wallet, enter your ID, and select your classes.</p>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>STUDENT ID</label>
      <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="e.g. 2021-0001" style={inputStyle} />

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>WALLET ADDRESS</label>
      {walletAddress ? (
        <div style={{ padding: "10px 12px", border: "1px solid #000", fontSize: 11, marginBottom: 8, wordBreak: "break-all", background: "#f9f9f9" }}>{walletAddress}</div>
      ) : (
        <div style={{ padding: "10px 12px", border: "1px dashed #aaa", fontSize: 12, marginBottom: 8, color: "#aaa" }}>No wallet connected yet</div>
      )}
      <button onClick={connectLace} disabled={connecting} style={{ width: "100%", padding: 11, background: "#fff", color: "#000", border: "2px solid #000", fontFamily: "Times New Roman", fontSize: 13, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", marginBottom: 20 }}>
        {connecting ? "Connecting..." : walletAddress ? "↺ Reconnect Lace Wallet" : "Connect Lace Wallet"}
      </button>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 8 }}>SELECT CLASSES TO ENROLL</label>
      <div style={{ border: "1px solid #000", marginBottom: 20 }}>
        {availableClasses.map((c, i) => (
          <div key={c.id} onClick={() => toggleClass(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < availableClasses.length - 1 ? "1px solid #eee" : "none", cursor: "pointer", background: selectedClasses.includes(c.id) ? "#f0f0f0" : "#fff" }}>
            <div style={{ width: 16, height: 16, border: "1.5px solid #000", background: selectedClasses.includes(c.id) ? "#000" : "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {selectedClasses.includes(c.id) && <span style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: "bold" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#777" }}>{c.id} · {c.room}</div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleRegister} disabled={registering} style={{ width: "100%", padding: 13, background: "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontSize: 13, fontWeight: "bold", letterSpacing: 2, cursor: "pointer" }}>
        {registering ? "REGISTERING..." : "REGISTER & ENROLL"}
      </button>

      {message && <p style={{ marginTop: 16, color: "#000", fontWeight: "bold" }}>✓ {message}</p>}
      {error && <p style={{ marginTop: 16, color: "red" }}>✗ {error}</p>}
    </div>
  );
}