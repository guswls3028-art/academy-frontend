import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FiUser } from "react-icons/fi";

const menu = [
  { label: "강의", path: "lectures" },
  { label: "학생", path: "students" },
  { label: "클리닉", path: "clinic" },
  { label: "상담", path: "counsel" },
  { label: "공지", path: "notice" },
  { label: "메시지", path: "message" },
  { label: "커뮤니티", path: "community" },
  { label: "직원관리", path: "staff" }, // ← admin → staff 네이밍 변경 예정
];

export default function Sidebar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const user = {
    name: "사용자 정보",
  };

  return (
    <aside className="w-60 bg-[#f8f9fb] border-r border-gray-200 flex flex-col justify-between">

      {/* Menu */}
      <nav className="px-3 py-4 space-y-1">
        {menu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User Menu */}
      <div className="relative px-3 py-4 border-t border-gray-200">

        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 transition-colors"
          onClick={() => setOpen((prev) => !prev)}
        >
          <FiUser size={18} className="text-gray-500" />
          <span className="text-sm font-medium">{user.name}</span>
        </button>

        {open && (
          <div className="absolute left-4 right-4 bottom-16 bg-white shadow-lg border border-gray-200 rounded-lg py-2 z-50">

            <button
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
              onClick={() => navigate("profile/info")}
            >
              내 정보
            </button>

            <button
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
              onClick={() => navigate("profile/records")}
            >
              근태 기록
            </button>

            <button
              className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
              onClick={() => console.log("logout")}
            >
              로그아웃
            </button>

          </div>
        )}

      </div>
    </aside>
  );
}
