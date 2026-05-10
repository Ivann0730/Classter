import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserWallet, Transaction } from "@meshsdk/core";
import API_BASE from "./config";

const DEFAULT_CLASSES = [
  { class_id: "CS301", name: "Blockchain Technology", room: "Room 101" },
  { class_id: "CS201", name: "Data Structures", room: "Room 203" },
  { class_id: "IT401", name: "Software Engineering", room: "Lab 2" },
  { class_id: "CS101", name: "Introduction to Programming", room: "Room 105" },
];

function generateQRDataURL(text, size = 220) {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
  const modules = 21, cell = Math.floor(size / (modules + 2));
  const offset = Math.floor((size - modules * cell) / 2);
  const seed = text.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (i) => ((seed * 1103515245 + i * 12345) & 0x7fffffff) % 100;
  ctx.fillStyle = "#000000";
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const isFinder = (r < 7 && c < 7) || (r < 7 && c >= modules - 7) || (r >= modules - 7 && c < 7);
      const isModule = isFinder ? r === 0 || r === 6 || c === 0 || c === 6 || (r > 1 && r < 5 && c > 1 && c < 5) : rand(r * modules + c) > 45;
      if (isModule) ctx.fillRect(offset + c * cell, offset + r * cell, cell - 1, cell - 1);
    }
  }
  return canvas.toDataURL();
}

export default function TeacherDashboard({ activeSession, setActiveSession }) {
  const [classes, setClasses] = useState(DEFAULT_CLASSES);
  const [selectedClass, setSelectedClass] = useState(DEFAULT_CLASSES[0]);
  const [sessionActive, setSessionActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [blockHeight, setBlockHeight] = useState(4669611);
  const [sessionKey, setSessionKey] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [sessionTime, setSessionTime] = useState(0);
  const [tab, setTab] = useState("qr");
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [submittingTx, setSubmittingTx] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClass, setNewClass] = useState({ class_id: "", name: "", room: "" });
  const timerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const blockRef = useRef(null);
  const sessionKeyRef = useRef("");

  // Fetch classes
  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/classes`);
      const data = await res.json();
      if (data.classes?.length) { setClasses(data.classes); setSelectedClass(data.classes[0]); }
    } catch {}
  }, []);

  // Fetch students
  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/students`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch {}
  }, []);

  // Fetch live attendance for current session
  const fetchAttendance = useCallback(async () => {
    if (!sessionKeyRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/attendance/${sessionKeyRef.current}`);
      const data = await res.json();
      setAttendance(data.attendance || []);
    } catch {}
  }, []);

  // Fetch session history
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {}
  }, []);

  useEffect(() => { fetchClasses(); fetchStudents(); }, [fetchClasses, fetchStudents]);

  const generateSessionKey = useCallback((classId, bHeight) => {
    const ts = Math.floor(Date.now() / 30000);
    return btoa(`${classId}:${ts}:${bHeight}`).slice(0, 16).toUpperCase();
  }, []);

  const refreshQR = useCallback(() => {
    const key = generateSessionKey(selectedClass.class_id, blockHeight);
    sessionKeyRef.current = key;
    setSessionKey(key);
    fetch(`${API_BASE}/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: selectedClass.class_id, sessionKey: key }),
    }).catch(() => {});
    setQrDataUrl(generateQRDataURL(JSON.stringify({ class_id: selectedClass.class_id, session_key: key, block: blockHeight })));
    setTimeLeft(30);
    if (setActiveSession) setActiveSession({ sessionKey: key, classId: selectedClass.class_id });
  }, [selectedClass, blockHeight, generateSessionKey, setActiveSession]);

  useEffect(() => {
    if (!sessionActive) return;
    refreshQR();
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { refreshQR(); return 30; } return t - 1; });
    }, 1000);
    // Poll attendance every 5 seconds
    const attPoll = setInterval(fetchAttendance, 5000);
    return () => { clearInterval(timerRef.current); clearInterval(attPoll); };
  }, [sessionActive, refreshQR, fetchAttendance]);

  useEffect(() => {
    if (!sessionActive) return;
    sessionTimerRef.current = setInterval(() => setSessionTime(s => s + 1), 1000);
    return () => clearInterval(sessionTimerRef.current);
  }, [sessionActive]);

  useEffect(() => {
    blockRef.current = setInterval(() => setBlockHeight(b => b + 1), 20000);
    return () => clearInterval(blockRef.current);
  }, []);

  const startSession = () => {
    setAttendance([]);
    setSessionTime(0);
    setSessionActive(true);
    setTab("qr");
  };

  const endSession = async () => {
    setSessionActive(false);
    clearInterval(timerRef.current);
    clearInterval(sessionTimerRef.current);
    setSubmittingTx(true);

    try {
      // Get full attendance from backend
      const res = await fetch(`${API_BASE}/session/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, classId: selectedClass.class_id }),
      });
      const data = await res.json();
      if (!data.success) { setSubmittingTx(false); return; }

      setAttendance(data.attendance || []);

      // Build metadata from full attendance list
      const metadata = {
        app: "ClassTer",
        class_id: selectedClass.class_id,
        class_name: selectedClass.name,
        session_key: sessionKey,
        date: new Date().toISOString().slice(0, 10),
        total_students: data.attendance.length,
        attendance: data.attendance.map(a => ({
          id: a.student_id,
          name: a.student_name || a.student_id,
          in: a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : null,
          out: a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString() : null,
        })),
      };

      // Connect teacher wallet
      if (!window.cardano) {
        alert("Please install Lace wallet to submit attendance to the blockchain.");
        setSubmittingTx(false);
        return;
      }

      const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];
      const wallet = await BrowserWallet.enable(walletKey);

      // Build and submit transaction
      const tx = new Transaction({ initiator: wallet }).setMetadata(674, metadata);
      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx);
      const txHash = await wallet.submitTx(signedTx);

      // Save tx hash to database
      await fetch(`${API_BASE}/session/tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, txHash }),
      });

      if (setActiveSession) setActiveSession(null);
      alert(`✓ Attendance recorded on Cardano!\n\nTransaction Hash:\n${txHash}\n\nView at:\nhttps://preprod.cardanoscan.io/transaction/${txHash}`);
      fetchSessions();

    } catch (e) {
      alert("Session ended but blockchain submission failed: " + e.message);
      if (setActiveSession) setActiveSession(null);
    }
    setSubmittingTx(false);
  };

  const handleAddClass = async () => {
    if (!newClass.class_id || !newClass.name || !newClass.room) return;
    try {
      const res = await fetch(`${API_BASE}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClass),
      });
      const data = await res.json();
      if (data.success) { setClasses(data.classes); setNewClass({ class_id: "", name: "", room: "" }); setShowAddClass(false); }
    } catch {}
  };

  const exportCSV = () => {
    const rows = [["Student ID", "Name", "Check-In", "Check-Out"],
      ...attendance.map(a => [a.student_id, a.student_name || "", a.check_in_time || "", a.check_out_time || ""])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `attendance_${selectedClass.class_id}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const present = attendance.filter(a => a.check_in_time).length;
  const checkedOut = attendance.filter(a => a.check_out_time).length;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .db-root { font-family: 'Times New Roman', Times, serif; background: #ffffff; min-height: 100vh; color: #000; }
        .db-inner { max-width: 1100px; margin: 0 auto; padding: 32px 28px; }
        .db-header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; flex-wrap: wrap; gap: 8px; }
        .db-logo { font-size: 26px; font-weight: bold; }
        .db-meta { font-size: 12px; color: #555; display: flex; gap: 20px; }
        .db-class-bar { display: flex; gap: 0; margin-bottom: 10px; border: 1px solid #000; overflow-x: auto; }
        .db-class-btn { flex-shrink: 0; background: #fff; border: none; border-right: 1px solid #000; padding: 10px 14px; cursor: pointer; text-align: left; font-family: 'Times New Roman', Times, serif; }
        .db-class-btn:last-child { border-right: none; }
        .db-class-btn:hover { background: #f5f5f5; }
        .db-class-btn.active { background: #000; color: #fff; }
        .db-class-name { font-size: 13px; font-weight: bold; }
        .db-class-sub { font-size: 11px; margin-top: 2px; opacity: 0.7; }
        .db-grid { display: grid; grid-template-columns: 1fr 300px; gap: 20px; }
        @media (max-width: 720px) { .db-grid { grid-template-columns: 1fr; } }
        .db-card { border: 1px solid #000; }
        .db-card-header { padding: 10px 16px; border-bottom: 1px solid #000; display: flex; align-items: center; justify-content: space-between; background: #000; color: #fff; }
        .db-card-title { font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
        .db-card-body { padding: 18px; }
        .db-tabs { display: flex; border-bottom: 1px solid #000; overflow-x: auto; }
        .db-tab { flex-shrink: 0; padding: 10px 14px; background: none; border: none; border-right: 1px solid #000; cursor: pointer; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Times New Roman', Times, serif; }
        .db-tab:last-child { border-right: none; }
        .db-tab:hover { background: #f5f5f5; }
        .db-tab.active { background: #000; color: #fff; }
        .qr-wrap { display: flex; flex-direction: column; align-items: center; padding: 24px 20px; gap: 16px; }
        .qr-frame { width: 230px; height: 230px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; background: #fff; }
        .qr-img { width: 220px; height: 220px; }
        .qr-inactive { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #aaa; text-align: center; }
        .qr-inactive-icon { font-size: 36px; }
        .qr-inactive-text { font-size: 12px; line-height: 1.6; }
        .timer-wrap { text-align: center; }
        .timer-num { font-size: 40px; font-weight: bold; line-height: 1; }
        .timer-label { font-size: 11px; color: #555; margin-top: 2px; }
        .timer-bar { width: 200px; height: 4px; background: #e0e0e0; margin: 6px auto 0; }
        .timer-bar-fill { height: 100%; background: #000; transition: width 1s linear; }
        .key-wrap { text-align: center; width: 100%; }
        .key-label { font-size: 11px; color: #555; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
        .key-badge { font-size: 14px; font-weight: bold; letter-spacing: 3px; border: 1px solid #000; padding: 6px 16px; display: inline-block; }
        .copy-btn { margin-top: 8px; padding: 6px 16px; background: #fff; border: 1px solid #000; font-family: 'Times New Roman', serif; font-size: 11px; cursor: pointer; }
        .db-btn { width: 100%; padding: 13px; border: 2px solid #000; font-family: 'Times New Roman', serif; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; }
        .db-btn-start { background: #000; color: #fff; }
        .db-btn-end { background: #fff; color: #000; }
        .stats-row { display: flex; gap: 0; margin-bottom: 14px; border: 1px solid #000; }
        .stat-block { flex: 1; padding: 12px; border-right: 1px solid #000; text-align: center; }
        .stat-block:last-child { border-right: none; }
        .stat-label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #555; margin-bottom: 4px; }
        .stat-val { font-size: 26px; font-weight: bold; }
        .prog-bar { height: 6px; background: #e0e0e0; }
        .prog-fill { height: 100%; background: #000; transition: width 0.6s ease; }
        .prog-label { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 4px; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #eee; font-size: 12px; }
        .info-row:last-child { border-bottom: none; }
        .info-key { color: #555; text-transform: uppercase; font-size: 11px; }
        .info-val { font-weight: bold; }
        .badge { font-size: 10px; font-weight: bold; letter-spacing: 1px; padding: 2px 8px; border: 1px solid currentColor; }
        .badge-live { color: #000; }
        .badge-idle { color: #aaa; border-color: #aaa; }
        .divider { border: none; border-top: 1px solid #ddd; margin: 8px 0; }
        .att-item { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-bottom: 1px solid #eee; font-size: 12px; }
        .att-item:last-child { border-bottom: none; }
        .att-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-in { background: #000; }
        .dot-out { background: #555; }
        .dot-pending { background: #ddd; border: 1px solid #aaa; }
        .side { display: flex; flex-direction: column; gap: 16px; }
        .export-btn { flex: 1; padding: 8px; background: #fff; border: 1px solid #000; font-family: 'Times New Roman', serif; font-size: 11px; font-weight: bold; cursor: pointer; letter-spacing: 1px; text-transform: uppercase; }
        .export-btn:hover { background: #000; color: #fff; }
        .add-class-form { border: 1px solid #000; padding: 14px; margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
        .add-class-input { padding: "7px 10px"; border: "1px solid #000"; font-family: "Times New Roman", serif; font-size: 13px; }
        .session-row { padding: 10px 18px; border-bottom: 1px solid #eee; font-size: 12px; }
        .session-row:last-child { border-bottom: none; }
      `}</style>

      <div className="db-root">
        <div className="db-inner">

          <div className="db-header">
            <div className="db-logo">ClassTer</div>
            <div className="db-meta">
              <span>Cardano Preprod</span>
              <span>Block #{blockHeight.toLocaleString()}</span>
              <span>{new Date().toLocaleDateString("en-PH", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>

          {/* Class selector */}
          <div className="db-class-bar">
            {classes.map((c) => (
              <button key={c.class_id} className={`db-class-btn ${selectedClass.class_id === c.class_id ? "active" : ""}`}
                onClick={() => { setSelectedClass(c); if (sessionActive) return; }}>
                <div className="db-class-name">{c.name}</div>
                <div className="db-class-sub">{c.class_id} · {c.room}</div>
              </button>
            ))}
          </div>

          {/* Add class */}
          <div style={{ marginBottom: 16 }}>
            {!showAddClass ? (
              <button onClick={() => setShowAddClass(true)} style={{ padding: "6px 14px", background: "#fff", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                + Add Class
              </button>
            ) : (
              <div className="add-class-form">
                <div>
                  <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>CLASS ID</div>
                  <input value={newClass.class_id} onChange={e => setNewClass({ ...newClass, class_id: e.target.value.toUpperCase() })} placeholder="CS401" style={{ padding: "7px 10px", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 13, width: 90 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>NAME</div>
                  <input value={newClass.name} onChange={e => setNewClass({ ...newClass, name: e.target.value })} placeholder="Web Development" style={{ padding: "7px 10px", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 13, width: 180 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>ROOM</div>
                  <input value={newClass.room} onChange={e => setNewClass({ ...newClass, room: e.target.value })} placeholder="Room 201" style={{ padding: "7px 10px", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 13, width: 110 }} />
                </div>
                <button onClick={handleAddClass} style={{ padding: "7px 14px", background: "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>Add</button>
                <button onClick={() => setShowAddClass(false)} style={{ padding: "7px 14px", background: "#fff", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              </div>
            )}
          </div>

          <div className="db-grid">
            {/* Left panel */}
            <div className="db-card">
              <div className="db-tabs">
                <button className={`db-tab ${tab === "qr" ? "active" : ""}`} onClick={() => setTab("qr")}>QR Code</button>
                <button className={`db-tab ${tab === "attendance" ? "active" : ""}`} onClick={() => { setTab("attendance"); fetchAttendance(); }}>
                  Live Attendance ({present})
                </button>
                <button className={`db-tab ${tab === "students" ? "active" : ""}`} onClick={() => { setTab("students"); fetchStudents(); }}>
                  Students ({students.length})
                </button>
                <button className={`db-tab ${tab === "history" ? "active" : ""}`} onClick={() => { setTab("history"); fetchSessions(); }}>
                  History
                </button>
              </div>

              {/* QR Tab */}
              {tab === "qr" && (
                <div className="qr-wrap">
                  <div className="qr-frame">
                    {sessionActive && qrDataUrl
                      ? <img src={qrDataUrl} alt="QR" className="qr-img" />
                      : <div className="qr-inactive"><div className="qr-inactive-icon">▣</div><div className="qr-inactive-text">Start a session<br />to generate QR</div></div>
                    }
                  </div>
                  {sessionActive && (
                    <>
                      <div className="timer-wrap">
                        <div className="timer-num">{timeLeft}</div>
                        <div className="timer-label">Seconds until refresh</div>
                        <div className="timer-bar"><div className="timer-bar-fill" style={{ width: `${(timeLeft / 30) * 100}%` }} /></div>
                      </div>
                      <div className="key-wrap">
                        <div className="key-label">Session Key</div>
                        <div className="key-badge">{sessionKey}</div>
                        <div>
                          <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(sessionKey); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }}>
                            {copySuccess ? "✓ Copied!" : "Copy Key"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  <div style={{ width: "100%" }}>
                    {!sessionActive
                      ? <button className="db-btn db-btn-start" onClick={startSession}>Start Session</button>
                      : <button className="db-btn db-btn-end" onClick={endSession} disabled={submittingTx}>
                          {submittingTx ? "SUBMITTING TO BLOCKCHAIN..." : "END SESSION + RECORD ON CHAIN"}
                        </button>
                    }
                  </div>
                </div>
              )}

              {/* Live Attendance Tab */}
              {tab === "attendance" && (
                <>
                  <div style={{ padding: "10px 18px", borderBottom: "1px solid #eee", fontSize: 11, color: "#555", display: "flex", justifyContent: "space-between" }}>
                    <span>STUDENT</span><span>CHECK-IN</span><span>CHECK-OUT</span>
                  </div>
                  {attendance.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>No check-ins yet for this session</div>
                  ) : (
                    attendance.map((a, i) => (
                      <div key={i} className="att-item">
                        <div className={`att-dot ${a.check_out_time ? "dot-out" : a.check_in_time ? "dot-in" : "dot-pending"}`} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold" }}>{a.student_name || a.student_id}</div>
                          <div style={{ fontSize: 10, color: "#777" }}>{a.student_id}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#555" }}>{a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : "—"}</div>
                        <div style={{ fontSize: 11, color: "#555", marginLeft: 12 }}>{a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString() : "—"}</div>
                      </div>
                    ))
                  )}
                  {attendance.length > 0 && (
                    <div style={{ padding: "10px 18px" }}>
                      <button className="export-btn" style={{ width: "100%" }} onClick={exportCSV}>Export CSV</button>
                    </div>
                  )}
                </>
              )}

              {/* Students Tab */}
              {tab === "students" && (
                <>
                  <div style={{ padding: "10px 18px", borderBottom: "1px solid #eee", fontSize: 11, color: "#555", display: "flex", justifyContent: "space-between" }}>
                    <span>STUDENT ID</span><span>NAME</span><span>REGISTERED</span>
                  </div>
                  {students.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>No students registered yet</div>
                  ) : (
                    students.map((s, i) => (
                      <div key={i} className="att-item">
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold" }}>{s.student_id}</div>
                          <div style={{ fontSize: 11, color: "#777" }}>{s.name}</div>
                        </div>
                        <div style={{ fontSize: 10, color: "#aaa" }}>{new Date(s.created_at).toLocaleDateString()}</div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* History Tab */}
              {tab === "history" && (
                <>
                  <div style={{ padding: "10px 18px", borderBottom: "1px solid #eee", fontSize: 11, color: "#555", display: "flex", justifyContent: "space-between" }}>
                    <span>CLASS</span><span>DATE</span><span>STATUS</span><span>TX</span>
                  </div>
                  {sessions.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>No sessions recorded yet</div>
                  ) : (
                    sessions.map((s, i) => (
                      <div key={i} className="session-row">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "bold" }}>{s.class_id}</span>
                          <span style={{ fontSize: 11, color: "#555" }}>{new Date(s.started_at).toLocaleDateString()}</span>
                          <span style={{ fontSize: 10, padding: "2px 6px", border: "1px solid #000", fontWeight: "bold" }}>{s.status.toUpperCase()}</span>
                          {s.tx_hash ? (
                            <a href={`https://preprod.cardanoscan.io/transaction/${s.tx_hash}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#000", fontFamily: "monospace" }}>
                              {s.tx_hash.slice(0, 8)}...
                            </a>
                          ) : <span style={{ fontSize: 10, color: "#aaa" }}>No tx</span>}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Right sidebar */}
            <div className="side">
              <div className="db-card">
                <div className="db-card-header">
                  <span className="db-card-title">Attendance</span>
                  <span className={`badge ${sessionActive ? "badge-live" : "badge-idle"}`}>{sessionActive ? "LIVE" : "IDLE"}</span>
                </div>
                <div className="db-card-body">
                  <div className="stats-row">
                    <div className="stat-block"><div className="stat-label">Checked In</div><div className="stat-val">{present}</div></div>
                    <div className="stat-block"><div className="stat-label">Checked Out</div><div className="stat-val">{checkedOut}</div></div>
                  </div>
                  <div className="prog-bar"><div className="prog-fill" style={{ width: present > 0 ? `${(checkedOut / present) * 100}%` : "0%" }} /></div>
                  <div className="prog-label"><span>0%</span><span>{present > 0 ? Math.round((checkedOut / present) * 100) : 0}% checked out</span><span>100%</span></div>
                </div>
              </div>

              <div className="db-card">
                <div className="db-card-header"><span className="db-card-title">Session Info</span></div>
                <div className="db-card-body">
                  <div className="info-row"><span className="info-key">Class</span><span className="info-val">{selectedClass.class_id}</span></div>
                  <div className="info-row"><span className="info-key">Room</span><span className="info-val">{selectedClass.room}</span></div>
                  <div className="info-row"><span className="info-key">Network</span><span className="info-val">Preprod</span></div>
                  <div className="info-row"><span className="info-key">Block</span><span className="info-val">#{blockHeight.toLocaleString()}</span></div>
                  <hr className="divider" />
                  <div className="info-row"><span className="info-key">Duration</span><span className="info-val">{fmt(sessionTime)}</span></div>
                  <div className="info-row"><span className="info-key">QR Refresh</span><span className="info-val">Every 30s</span></div>
                  <div className="info-row"><span className="info-key">Session Key</span><span className="info-val" style={{ fontSize: 10, wordBreak: "break-all" }}>{sessionActive ? sessionKey : "—"}</span></div>
                </div>
              </div>

              <div className="db-card">
                <div className="db-card-header"><span className="db-card-title">How It Works</span></div>
                <div className="db-card-body">
                  {[["1.", "Select class & start session"], ["2.", "Project QR on screen"], ["3.", "Students enter ID + session key"], ["4.", "Students check in and out"], ["5.", "End session → sends all attendance to Cardano as one transaction"]].map(([n, t]) => (
                    <div key={n} className="info-row"><span className="info-key">{n}</span><span style={{ fontSize: 11 }}>{t}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 