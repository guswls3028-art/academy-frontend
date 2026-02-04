// PATH: src/student/app/StudentLayout.tsx

import { NavLink, Outlet } from "react-router-dom";
import "@/student/app/student.css";

export default function StudentLayout() {
  return (
    <div className="student-app">
      {/* ===== Header ===== */}
      <header className="student-header">
        <div className="student-header__brand">STUDENT</div>

        <nav className="student-header__nav">
          <TopLink to="/student/dashboard" label="홈" />
          <TopLink to="/student/sessions" label="차시" />
          <TopLink to="/student/exams" label="시험" />
          <TopLink to="/student/grades" label="성적" />
          <TopLink to="/student/qna" label="Q&A" />
        </nav>
      </header>

      {/* ===== Content ===== */}
      <main className="student-content">
        <div className="student-page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function TopLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `student-header__link ${isActive ? "active" : ""}`
      }
    >
      {label}
    </NavLink>
  );
}
