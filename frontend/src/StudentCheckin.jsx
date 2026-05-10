import { useState } from "react";
import API_BASE from "./config";

export default function StudentCheckin({ activeSession }) {
  const [studentId, setStudentId] = useState("");
  const [sessionKey, setSessionKey] = useState(activeSession?.sessionKey || "");
  const [classId, setClassId] = useState(activeSession?.classId || "CS301");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheckin = async () => {
    setMessage(""); setError(""); setResult(null);
    if (!studentId) { setError("Please enter your Student ID."); return; }
    if (!sessionKey) { setError("Please enter the session key from the QR code."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, sessionKey, classId }),
      });
      const data = await res.json();

      if (data.success) {
        setResult(data);
        if (data.action === "checkin") {
          setMessage(`Checked IN successfully at ${new Date(data.checkIn).toLocaleTimeString()}`);
        } else if (data.action === "checkout") {
          setMessage(`Checked OUT successfully at ${new Date(data.checkOut).toLocaleTimeString()}`);
        } else {
          setMessage("Your attendance is already complete for this session.");
        }
      } else {
        setError(data.error);
      }
    } catch {
      setError("Could not reach the server. Is the backend running?");
    }
    setSubmitting(false);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", border: "1px solid #000",
    fontFamily: "Times New Roman", fontSize: 14,
    marginBottom: 16, boxSizing: "border-box"
  };

  return (
    <div style={{ fontFamily: "Times New Roman", maxWidth: 480, margin: "60px auto", padding: 32, border: "1px solid #000" }}>
      <h2 style={{ borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 8 }}>
        Student Check-In / Check-Out
      </h2>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 24, lineHeight: 1.6 }}>
        Enter your Student ID and the session key from the QR code.
        Use the same form again to check out at the end of class.
      </p>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>STUDENT ID</label>
      <input
        value={studentId}
        onChange={e => setStudentId(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleCheckin()}
        placeholder="e.g. 2021-0001"
        style={inputStyle}
      />

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>CLASS</label>
      <select value={classId} onChange={e => setClassId(e.target.value)} style={inputStyle}>
        <option value="CS301">CS301 — Blockchain Technology</option>
        <option value="CS201">CS201 — Data Structures</option>
        <option value="IT401">IT401 — Software Engineering</option>
        <option value="CS101">CS101 — Introduction to Programming</option>
      </select>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>SESSION KEY (from QR code)</label>
      <input
        value={sessionKey}
        onChange={e => setSessionKey(e.target.value.toUpperCase())}
        placeholder="e.g. Q1MZMDE6NTKYNJMX"
        style={inputStyle}
      />

      <button
        onClick={handleCheckin}
        disabled={submitting}
        style={{ width: "100%", padding: 13, background: submitting ? "#555" : "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontSize: 13, fontWeight: "bold", letterSpacing: 2, cursor: submitting ? "not-allowed" : "pointer", textTransform: "uppercase" }}
      >
        {submitting ? "PROCESSING..." : "CHECK IN / CHECK OUT"}
      </button>

      {result && (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #000", background: "#f9f9f9" }}>
          <p style={{ fontWeight: "bold", fontSize: 14, marginBottom: 10 }}>✓ {message}</p>
          {result.name && <p style={{ fontSize: 12, marginBottom: 4 }}>Name: <strong>{result.name}</strong></p>}
          {result.checkIn && <p style={{ fontSize: 12, marginBottom: 4 }}>Check-in time: <strong>{new Date(result.checkIn).toLocaleTimeString()}</strong></p>}
          {result.checkOut && <p style={{ fontSize: 12 }}>Check-out time: <strong>{new Date(result.checkOut).toLocaleTimeString()}</strong></p>}
        </div>
      )}

      {error && <p style={{ marginTop: 16, color: "red" }}>✗ {error}</p>}
    </div>
  );
}