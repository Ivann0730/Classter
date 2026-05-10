import { useState, useEffect } from "react";
import API_BASE from "./config";

export default function RegisterStudent() {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    setMessage(""); setError("");
    if (!studentId) { setError("Please enter your Student ID."); return; }
    if (!studentName) { setError("Please enter your name."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/students/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, name: studentName }),
      });
      const data = await res.json();
      if (data.success) setMessage(data.message);
      else setError(data.error);
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
      <h2 style={{ borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 24 }}>
        Student Registration
      </h2>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
        Register your Student ID and name. Do this once before your first class.
        No wallet needed — just your school ID.
      </p>

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>STUDENT ID</label>
      <input
        value={studentId}
        onChange={e => setStudentId(e.target.value)}
        placeholder="e.g. 2021-0001"
        style={inputStyle}
      />

      <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>FULL NAME</label>
      <input
        value={studentName}
        onChange={e => setStudentName(e.target.value)}
        placeholder="e.g. Juan Dela Cruz"
        style={inputStyle}
      />

      <button
        onClick={handleRegister}
        disabled={submitting}
        style={{ width: "100%", padding: 13, background: submitting ? "#555" : "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontSize: 13, fontWeight: "bold", letterSpacing: 2, cursor: "pointer", textTransform: "uppercase" }}
      >
        {submitting ? "REGISTERING..." : "REGISTER"}
      </button>

      {message && <p style={{ marginTop: 16, color: "#000", fontWeight: "bold" }}>✓ {message}</p>}
      {error && <p style={{ marginTop: 16, color: "red" }}>✗ {error}</p>}
    </div>
  );
}