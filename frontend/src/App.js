import { useState } from "react";
import TeacherDashboard from "./TeacherDashboard";
import RegisterStudent from "./RegisterStudent";
import StudentCheckin from "./StudentCheckin";
import TransactionDemo from "./TransactionDemo";

export default function App() {
  const [page, setPage] = useState("teacher");
  const [activeSession, setActiveSession] = useState(null);
  // activeSession = { sessionKey, classId, expiresAt } or null

  const navStyle = (p) => ({
    padding: "8px 20px", cursor: "pointer", fontFamily: "Times New Roman",
    fontSize: 13, fontWeight: "bold", letterSpacing: 1,
    background: page === p ? "#000" : "#fff",
    color: page === p ? "#fff" : "#000",
    border: "1px solid #000", borderRight: "none",
  });

  return (
    <div>
      <div style={{ display: "flex", borderBottom: "2px solid #000", padding: "16px 28px 0" }}>
        <button style={navStyle("teacher")} onClick={() => setPage("teacher")}>Teacher Dashboard</button>
        <button style={navStyle("register")} onClick={() => setPage("register")}>Register Student</button>
        <button style={{ ...navStyle("checkin"), borderRight: "1px solid #000" }} onClick={() => setPage("checkin")}>Student Check-In/Check-Out</button>
        {activeSession && (
          <span style={{
            marginLeft: "auto", alignSelf: "center",
            fontSize: 11, fontFamily: "Times New Roman",
            background: "#000", color: "#fff",
            padding: "4px 12px", letterSpacing: 1
          }}>
            SESSION ACTIVE: {activeSession.classId} — KEY: {activeSession.sessionKey}
          </span>
        )}
      </div>

      {page === "teacher" && (
        <TeacherDashboard
          activeSession={activeSession}
          setActiveSession={setActiveSession}
        />
      )}
      {page === "register" && <RegisterStudent />}
      {page === "checkin" && (
        <StudentCheckin activeSession={activeSession} />
      )}
      {page === "demo" && <TransactionDemo />}
    </div>
  );
}