// src/features/community/components/BoardTabs.tsx
import { NavLink } from "react-router-dom";

export default function BoardTabs() {
  const base = "/admin/community";

  const tabClass = ({ isActive }: any) =>
    `px-3 py-2 text-sm font-medium border-b-2 ${
      isActive 
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-600 hover:text-gray-800"
    }`;

  return (
    <div className="flex gap-6 border-b mb-6">
      <NavLink to={`${base}/admin?tab=notice`} className={tabClass}>공지사항</NavLink>
      <NavLink to={`${base}/qna`} className={tabClass}>질의응답</NavLink>
      <NavLink to={`${base}/review`} className={tabClass}>수강후기</NavLink>
    </div>
  );
}
