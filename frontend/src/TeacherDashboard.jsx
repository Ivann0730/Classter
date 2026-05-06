import { useState, useEffect, useRef, useCallback } from "react";
import API_BASE from "./config";

const CLASSES = [
  { id: "CS301", name: "Blockchain Technology", room: "Room 101" },
  { id: "CS201", name: "Data Structures", room: "Room 203" },
  { id: "IT401", name: "Software Engineering", room: "Lab 2" },
  { id: "CS101", name: "Introduction to Programming", room: "Room 105" },
];

const MOCK_STUDENTS = [
  { id: "2021-0001", name: "Alice Reyes", time: null, status: "absent" },
  { id: "2021-0002", name: "Ben Santos", time: null, status: "absent" },
  { id: "2021-0003", name: "Carla Mendez", time: null, status: "absent" },
  { id: "2021-0004", name: "Diego Cruz", time: null, status: "absent" },
  { id: "2021-0005", name: "Elena Gomez", time: null, status: "absent" },
  { id: "2021-0006", name: "Felix Tan", time: null, status: "absent" },
  { id: "2021-0007", name: "Grace Lim", time: null, status: "absent" },
  { id: "2021-0008", name: "Hiro Dela Cruz", time: null, status: "absent" },
];

function generateQRDataURL(text, size = 220) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const modules = 21;
  const cell = Math.floor(size / (modules + 2));
  const offset = Math.floor((size - modules * cell) / 2);
  const seed = text.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (i) => ((seed * 1103515245 + i * 12345) & 0x7fffffff) % 100;
  ctx.fillStyle = "#000000";
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const isFinder =
        (r < 7 && c < 7) ||
        (r < 7 && c >= modules - 7) ||
        (r >= modules - 7 && c < 7);
      const isModule = isFinder
        ? r === 0 || r === 6 || c === 0 || c === 6 || (r > 1 && r < 5 && c > 1 && c < 5)
        : rand(r * modules + c) > 45;
      if (isModule) {
        ctx.fillRect(offset + c * cell, offset + r * cell, cell - 1, cell - 1);
      }
    }
  }
  return canvas.toDataURL();
}

export default function TeacherDashboard({ activeSession, setActiveSession }) {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [sessionActive, setSessionActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [blockHeight, setBlockHeight] = useState(4669611);
  const [sessionKey, setSessionKey] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [sessionTime, setSessionTime] = useState(0);
  const [tab, setTab] = useState("qr");
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [enrollments, setEnrollments] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClass, setNewClass] = useState({ id: "", name: "", room: "" });
  const [classes, setClasses] = useState(CLASSES);
  const timerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const blockRef = useRef(null);
  const sessionKeyRef = useRef("");

  // Fetch registered students from backend
  const fetchRegistered = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/students`);
      const data = await res.json();
      setRegisteredStudents(data.students || []);
    } catch {
      // backend might not be running
    }
  }, []);

  useEffect(() => {
    fetchRegistered();
  }, [fetchRegistered]);

  // Generate session key with long expiry (5 minutes for cross-device use)
  const generateSessionKey = useCallback((classId, bHeight) => {
    const ts = Math.floor(Date.now() / 30000); // 5 minute window
    return btoa(`${classId}:${ts}:${bHeight}`).slice(0, 16).toUpperCase();
  }, []);

  const refreshQR = useCallback(() => {
    const key = generateSessionKey(selectedClass.id, blockHeight);
    sessionKeyRef.current = key;
    setSessionKey(key);

    // Register session with backend so other devices can verify it
  fetch(`${API_BASE}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classId: selectedClass.id, sessionKey: key }),
  }).catch(() => {});

    const payload = JSON.stringify({
      class_id: selectedClass.id,
      session_key: key,
      block: blockHeight,
      ts: new Date().toISOString(),
    });
    setQrDataUrl(generateQRDataURL(payload));
    setTimeLeft(30);

    // Save to App level for cross-tab use
    if (setActiveSession) {
      setActiveSession({ sessionKey: key, classId: selectedClass.id });
    }
  }, [selectedClass, blockHeight, generateSessionKey, setActiveSession]);

  useEffect(() => {
    if (!sessionActive) return;
    refreshQR();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { refreshQR(); return 30; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [sessionActive, refreshQR]);

  useEffect(() => {
    if (!sessionActive) return;
    sessionTimerRef.current = setInterval(() => setSessionTime((s) => s + 1), 1000);
    return () => clearInterval(sessionTimerRef.current);
  }, [sessionActive]);

  useEffect(() => {
    blockRef.current = setInterval(() => setBlockHeight((b) => b + 1), 20000);
    return () => clearInterval(blockRef.current);
  }, []);

  const startSession = () => {
  setStudents(MOCK_STUDENTS); 
  setSessionTime(0);
  setSessionActive(true);
  setTab("qr");
};
  const fetchEnrollments = useCallback(async () => {
  try {
    const res = await fetch(`${API_BASE}/enrollments/${selectedClass.id}`);
    const data = await res.json();
    setEnrollments(data.enrollments || []);
  } catch {}
}, [selectedClass]);

const fetchCheckins = useCallback(async () => {
  try {
    const res = await fetch(`${API_BASE}/checkins/${selectedClass.id}`);
    const data = await res.json();
    setCheckins(data.checkins || []);
  } catch {}
}, [selectedClass]);

const handleEnrollmentAction = async (studentId, action) => {
  try {
    await fetch(`${API_BASE}/enrollment/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, classId: selectedClass.id, action }),
    });
    fetchEnrollments();
  } catch {}
};

const handleAddClass = async () => {
  if (!newClass.id || !newClass.name || !newClass.room) return;
  try {
    const res = await fetch(`${API_BASE}/classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClass),
    });
    const data = await res.json();
    if (data.success) {
      setClasses(data.classes);
      setNewClass({ id: "", name: "", room: "" });
      setShowAddClass(false);
    }
  } catch {}
};
useEffect(() => {
  fetchEnrollments();
  
  // Custom fetch to update the Roster UI when check-ins arrive
 const updateRosterWithCheckins = async () => {
  try {
    const res = await fetch(`${API_BASE}/checkins/${selectedClass.id}`);
    const data = await res.json();
    
    // Defensive check: handle both {checkins: []} and direct []
    const backendCheckins = data.checkins || (Array.isArray(data) ? data : []);
    
    setCheckins(backendCheckins);

    setStudents(prevStudents => 
      prevStudents.map(student => {
        // Log this to your console to see if IDs are actually matching
        const record = backendCheckins.find(c => 
          c.studentId.toString().trim() === student.id.toString().trim()
        );
        
        if (record) {
          return { 
            ...student, 
            status: "present", 
            time: new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          };
        }
        return student;
      })
    );
  } catch (err) {
    console.error("Failed to sync roster:", err);
  }
};

  updateRosterWithCheckins();
  
  // Optional: Set an interval to poll for new check-ins every 5 seconds
  const interval = setInterval(updateRosterWithCheckins, 5000);
  return () => clearInterval(interval);

}, [selectedClass, fetchEnrollments]); // Removed fetchCheckins from deps to avoid loops

  const endSession = () => {
    setSessionActive(false);
    if (setActiveSession) setActiveSession(null);
    clearInterval(timerRef.current);
    clearInterval(sessionTimerRef.current);
  };

  const copySessionKey = () => {
    navigator.clipboard.writeText(sessionKey).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Export attendance as CSV
  const exportCSV = () => {
    const rows = [
      ["Student ID", "Name", "Status", "Time"],
      ...students.map(s => [s.id, s.name, s.status, s.time || "—"]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${selectedClass.id}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as JSON
  const exportJSON = () => {
    const data = {
      class: selectedClass,
      date: new Date().toISOString(),
      sessionKey,
      students,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${selectedClass.id}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const present = students.filter((s) => s.status === "present").length;
  const absent = students.length - present;
  const pct = Math.round((present / students.length) * 100);
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .db-root { font-family: 'Times New Roman', Times, serif; background: #ffffff; min-height: 100vh; color: #000000; }
        .db-inner { max-width: 1100px; margin: 0 auto; padding: 32px 28px; }
        .db-header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; flex-wrap: wrap; gap: 8px; }
        .db-logo { font-size: 26px; font-weight: bold; letter-spacing: 1px; }
        .db-meta { font-size: 12px; color: #555; display: flex; gap: 20px; }
        .db-class-bar { display: flex; gap: 0; margin-bottom: 24px; border: 1px solid #000; }
        .db-class-btn { flex: 1; background: #fff; border: none; border-right: 1px solid #000; padding: 10px 14px; cursor: pointer; text-align: left; transition: background 0.15s; font-family: 'Times New Roman', Times, serif; }
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
        .db-tabs { display: flex; border-bottom: 1px solid #000; }
        .db-tab { flex: 1; padding: 11px; background: none; border: none; border-right: 1px solid #000; cursor: pointer; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; font-family: 'Times New Roman', Times, serif; transition: background 0.15s; }
        .db-tab:last-child { border-right: none; }
        .db-tab:hover { background: #f5f5f5; }
        .db-tab.active { background: #000; color: #fff; }
        .qr-wrap { display: flex; flex-direction: column; align-items: center; padding: 28px 20px; gap: 18px; }
        .qr-frame { width: 230px; height: 230px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; background: #fff; }
        .qr-img { width: 220px; height: 220px; }
        .qr-inactive { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #aaa; text-align: center; }
        .qr-inactive-icon { font-size: 36px; }
        .qr-inactive-text { font-size: 12px; line-height: 1.6; }
        .timer-wrap { text-align: center; }
        .timer-num { font-size: 40px; font-weight: bold; line-height: 1; }
        .timer-label { font-size: 11px; color: #555; margin-top: 2px; letter-spacing: 1px; }
        .timer-bar { width: 200px; height: 4px; background: #e0e0e0; margin: 8px auto 0; }
        .timer-bar-fill { height: 100%; background: #000; transition: width 1s linear; }
        .key-wrap { text-align: center; width: 100%; }
        .key-label { font-size: 11px; color: #555; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
        .key-badge { font-size: 14px; font-weight: bold; letter-spacing: 3px; border: 1px solid #000; padding: 6px 16px; display: inline-block; }
        .copy-btn { margin-top: 8px; padding: 6px 16px; background: #fff; border: 1px solid #000; font-family: 'Times New Roman', Times, serif; font-size: 11px; cursor: pointer; letter-spacing: 1px; }
        .copy-btn:hover { background: #f0f0f0; }
        .db-btn { width: 100%; padding: 13px; border: 2px solid #000; font-family: 'Times New Roman', Times, serif; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .db-btn-start { background: #000; color: #fff; }
        .db-btn-start:hover { background: #333; }
        .db-btn-end { background: #fff; color: #000; }
        .db-btn-end:hover { background: #f0f0f0; }
        .stats-row { display: flex; gap: 0; margin-bottom: 14px; border: 1px solid #000; }
        .stat-block { flex: 1; padding: 12px; border-right: 1px solid #000; text-align: center; }
        .stat-block:last-child { border-right: none; }
        .stat-label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #555; margin-bottom: 4px; }
        .stat-val { font-size: 28px; font-weight: bold; }
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
        .roster-list { padding: 0; }
        .roster-item { display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-bottom: 1px solid #eee; font-size: 13px; }
        .roster-item:last-child { border-bottom: none; }
        .roster-item.present { background: #f9f9f9; }
        .roster-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #000; flex-shrink: 0; }
        .dot-present { background: #000; }
        .dot-absent { background: #fff; }
        .roster-name { flex: 1; font-weight: bold; }
        .roster-id { font-size: 11px; color: #777; }
        .roster-time { font-size: 11px; color: #555; }
        .roster-time.absent { color: #ccc; }
        .side { display: flex; flex-direction: column; gap: 16px; }
        .export-row { display: flex; gap: 8px; margin-top: 12px; }
        .export-btn { flex: 1; padding: 8px; background: #fff; border: 1px solid #000; font-family: 'Times New Roman', Times, serif; font-size: 11px; font-weight: bold; cursor: pointer; letter-spacing: 1px; text-transform: uppercase; }
        .export-btn:hover { background: #000; color: #fff; }
        .reg-item { display: flex; justify-content: space-between; padding: 8px 18px; border-bottom: 1px solid #eee; font-size: 12px; }
        .reg-item:last-child { border-bottom: none; }
        .reg-wallet { font-size: 10px; color: #777; font-family: monospace; word-break: break-all; }
      `}</style>

      <div className="db-root">
        <div className="db-inner">

          <div className="db-header">
            <div className="db-logo">ClassTer</div>
            <div className="db-meta">
              <span>Cardano Preprod Testnet</span>
              <span>Block #{blockHeight.toLocaleString()}</span>
              <span>{new Date().toLocaleDateString("en-PH", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>

          <div className="db-class-bar">
            {CLASSES.map((c) => (
              <button
                key={c.id}
                className={`db-class-btn ${selectedClass.id === c.id ? "active" : ""}`}
                onClick={() => { setSelectedClass(c); if (sessionActive) endSession(); }}
              >
                <div className="db-class-name">{c.name}</div>
                <div className="db-class-sub">{c.id} · {c.room}</div>
              </button>
            ))}
          </div>

          <div className="db-grid">
            <div className="db-card">
            <div className="db-tabs">
              <button className={`db-tab ${tab === "qr" ? "active" : ""}`} onClick={() => setTab("qr")}>QR Code</button>
              <button className={`db-tab ${tab === "checkins" ? "active" : ""}`} onClick={() => { setTab("checkins"); fetchCheckins(); }}>
                Check-Ins ({checkins.length})
              </button>
              <button className={`db-tab ${tab === "enrollments" ? "active" : ""}`} onClick={() => { setTab("enrollments"); fetchEnrollments(); }}>
                Enrollments ({enrollments.filter(e => e.status === "pending").length} pending)
              </button>
              <button className={`db-tab ${tab === "registered" ? "active" : ""}`} onClick={() => { setTab("registered"); fetchRegistered(); }}>Registered</button>
            </div>

              {tab === "qr" && (
                <div className="qr-wrap">
                  <div className="qr-frame">
                    {sessionActive && qrDataUrl
                      ? <img src={qrDataUrl} alt="QR Code" className="qr-img" />
                      : (
                        <div className="qr-inactive">
                          <div className="qr-inactive-icon">▣</div>
                          <div className="qr-inactive-text">Start a session<br />to generate the QR code</div>
                        </div>
                      )
                    }
                  </div>

                  {sessionActive && (
                    <>
                      <div className="timer-wrap">
                        <div className="timer-num">{timeLeft}</div>
                        <div className="timer-label">Seconds until refresh</div>
                        <div className="timer-bar">
                          <div className="timer-bar-fill" style={{ width: `${(timeLeft / 30) * 100}%` }} />
                        </div>
                      </div>
                      <div className="key-wrap">
                        <div className="key-label">Session Key</div>
                        <div className="key-badge">{sessionKey}</div>
                        <div>
                          <button className="copy-btn" onClick={copySessionKey}>
                            {copySuccess ? "✓ Copied!" : "Copy Key"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ width: "100%" }}>
                    {!sessionActive
                      ? <button className="db-btn db-btn-start" onClick={startSession}>Start Session</button>
                      : <button className="db-btn db-btn-end" onClick={endSession}>End Session</button>
                    }
                  </div>
                </div>
              )}

              {tab === "roster" && (
                <>
                  <div className="roster-list">
                    {students.map((s) => (
                      <div key={s.id} className={`roster-item ${s.status}`}>
                        <div className={`roster-dot ${s.status === "present" ? "dot-present" : "dot-absent"}`} />
                        <div style={{ flex: 1 }}>
                          <div className="roster-name">{s.name}</div>
                          <div className="roster-id">{s.id}</div>
                        </div>
                        <div className={`roster-time ${s.status === "absent" ? "absent" : ""}`}>
                          {s.time ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="export-row" style={{ padding: "12px 18px" }}>
                    <button className="export-btn" onClick={exportCSV}>Export CSV</button>
                    <button className="export-btn" onClick={exportJSON}>Export JSON</button>
                  </div>
                </>
              )}

              {tab === "registered" && (
                <div>
                  <div style={{ padding: "10px 18px", borderBottom: "1px solid #eee", fontSize: 11, color: "#555", display: "flex", justifyContent: "space-between" }}>
                    <span>STUDENT ID</span>
                    <span>WALLET ADDRESS</span>
                  </div>
                  {registeredStudents.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>
                      No students registered yet
                    </div>
                  ) : (
                    registeredStudents.map((s, i) => (
                      <div key={i} className="reg-item">
                        <span style={{ fontWeight: "bold" }}>{s.studentId}</span>
                        <span className="reg-wallet">{s.walletAddress.slice(0, 20)}...{s.walletAddress.slice(-8)}</span>
                      </div>
                    ))
                  )}
                  <div style={{ padding: "12px 18px" }}>
                    <button className="export-btn" style={{ width: "100%" }} onClick={() => {
                      const csv = ["Student ID,Wallet Address", ...registeredStudents.map(s => `${s.studentId},${s.walletAddress}`)].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url;
                      a.download = "registered_students.csv"; a.click();
                      URL.revokeObjectURL(url);
                    }}>Export Registered Students CSV</button>
                  </div>
                </div>
              )}
            </div>

            <div className="side">
              <div className="db-card">
                <div className="db-card-header">
                  <span className="db-card-title">Attendance</span>
                  <span className={`badge ${sessionActive ? "badge-live" : "badge-idle"}`}>
                    {sessionActive ? "Live" : "Idle"}
                  </span>
                </div>
                <div className="db-card-body">
                  <div className="stats-row">
                    <div className="stat-block"><div className="stat-label">Present</div><div className="stat-val">{present}</div></div>
                    <div className="stat-block"><div className="stat-label">Absent</div><div className="stat-val">{absent}</div></div>
                    <div className="stat-block"><div className="stat-label">Total</div><div className="stat-val">{students.length}</div></div>
                  </div>
                  <div className="prog-bar"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
                  <div className="prog-label"><span>0%</span><span>{pct}% present</span><span>100%</span></div>
                </div>
              </div>

              <div className="db-card">
                <div className="db-card-header"><span className="db-card-title">Session Info</span></div>
                <div className="db-card-body">
                  <div className="info-row"><span className="info-key">Class</span><span className="info-val">{selectedClass.id}</span></div>
                  <div className="info-row"><span className="info-key">Room</span><span className="info-val">{selectedClass.room}</span></div>
                  <div className="info-row"><span className="info-key">Network</span><span className="info-val">Preprod</span></div>
                  <div className="info-row"><span className="info-key">Block</span><span className="info-val">#{blockHeight.toLocaleString()}</span></div>
                  <hr className="divider" />
                  <div className="info-row"><span className="info-key">Duration</span><span className="info-val">{fmt(sessionTime)}</span></div>
                  <div className="info-row"><span className="info-key">QR Refresh</span><span className="info-val">Every 30s</span></div>
                  <div className="info-row"><span className="info-key">Session Key</span><span className="info-val">{sessionActive ? sessionKey : "—"}</span></div>
                </div>
              </div>

              <div className="db-card">
                <div className="db-card-header"><span className="db-card-title">How It Works</span></div>
                <div className="db-card-body">
                  {[["1.", "Select your class above"], ["2.", "Press Start Session"], ["3.", "Project the QR on the board"], ["4.", "Students scan with their wallet"], ["5.", "Attendance recorded on Cardano"]].map(([n, t]) => (
                    <div key={n} className="info-row"><span className="info-key">{n}</span><span style={{ fontSize: 12 }}>{t}</span></div>
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