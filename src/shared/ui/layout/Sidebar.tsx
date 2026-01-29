// PATH: src/shared/ui/layout/Sidebar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FiUser } from "react-icons/fi";

import { useTheme } from "@/context/ThemeContext";

const menu = [
  { label: "강의", path: "lectures" },
  { label: "학생", path: "students" },
  { label: "클리닉", path: "clinic" },
  { label: "상담", path: "counsel" },
  { label: "공지", path: "notice" },
  { label: "메시지", path: "message" },
  { label: "자료실", path: "materials" },
  { label: "커뮤니티", path: "community" },
  { label: "직원관리", path: "staff" },
];

const themes = [
  { key: "modern", label: "모던" },
  { key: "navy", label: "네이비" },
  { key: "kakao", label: "카카오" },
  { key: "naver", label: "네이버" },
  { key: "purple", label: "퍼플" },
] as const;

export default function Sidebar() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [userOpen, setUserOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  return (
    <aside className="sidebar w-40 flex flex-col py-4">
      {/* ================= Top Menu ================= */}
      <nav className="nav px-3">
        {menu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 mb-3 mx-3 h-px bg-[var(--border-divider)] opacity-60" />

      {/* ================= User Action ================= */}
      <div className="relative px-3 mb-2">
        <button
          className="
            nav-item w-full
            flex items-center gap-2
            text-[var(--sidebar-text-secondary)]
            hover:text-[var(--sidebar-text-primary)]
          "
          onClick={() => {
            setUserOpen((p) => !p);
            setThemeOpen(false);
          }}
        >
          <FiUser size={14} />
          사용자 정보
        </button>

        {userOpen && (
          <div
            className="
              absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2
              min-w-[160px]
              rounded-md
              border border-[var(--border-divider)]
              bg-[var(--bg-surface)]
              shadow-md
              overflow-hidden
              z-50
            "
          >
            <button
              className="
                block w-full px-3 py-2 text-left text-sm
                text-[var(--text-primary)]
                hover:bg-[var(--sidebar-hover-bg)]
              "
              onClick={() => {
                setUserOpen(false);
                navigate("/admin/profile/account");
              }}
            >
              내 정보
            </button>

            <button
              className="
                block w-full px-3 py-2 text-left text-sm
                text-[var(--text-primary)]
                hover:bg-[var(--sidebar-hover-bg)]
              "
              onClick={() => {
                setUserOpen(false);
                navigate("/admin/profile/expense");
              }}
            >
              근태 기록
            </button>

            <div className="h-px bg-[var(--border-divider)]" />

            <button
              className="
                block w-full px-3 py-2 text-left text-sm
                text-red-400
                hover:bg-[var(--sidebar-hover-bg)]
              "
              onClick={() => {
                setUserOpen(false);
                console.log("logout");
              }}
            >
              로그아웃
            </button>
          </div>
        )}
      </div>

      {/* ================= Theme Action ================= */}
      <div className="relative px-3">
        <button
          className="
            nav-item w-full
            flex items-center
            text-[var(--sidebar-text-secondary)]
            hover:text-[var(--sidebar-text-primary)]
          "
          onClick={() => {
            setThemeOpen((p) => !p);
            setUserOpen(false);
          }}
        >
          테마 변경
        </button>

        {themeOpen && (
          <div
            className="
              absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2
              min-w-[160px]
              rounded-md
              border border-[var(--border-divider)]
              bg-[var(--bg-surface)]
              shadow-md
              overflow-hidden
              z-50
            "
          >
            {themes.map((t) => (
              <button
                key={t.key}
                className={`
                  block w-full px-3 py-2 text-left text-sm
                  ${
                    theme === t.key
                      ? "text-[var(--color-primary)] bg-[var(--sidebar-hover-bg)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--sidebar-hover-bg)]"
                  }
                `}
                onClick={() => {
                  setTheme(t.key);
                  setThemeOpen(false);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
