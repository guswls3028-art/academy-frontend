import { Outlet, NavLink } from "react-router-dom";
import "./studentLayout.css";

export default function StudentLayout() {
  return (
    <div className="student-app">
      <header className="student-header">
        <h1>ACADEMY</h1>
      </header>

      <main className="student-content">
        <Outlet />
      </main>

<nav className="student-tab">
  <NavLink to="/student/dashboard">홈</NavLink>
  <NavLink to="/student/lectures">강의</NavLink>
  <NavLink to="/student/qna">Q&A</NavLink>
  <NavLink to="/student/grades">성적</NavLink>

  {/* ✅ 영상은 영상으로 간다 */}
  <NavLink to="/student/media">영상</NavLink>
</nav>


    </div>
  );
}
