// src/features/community/components/BoardTabs.tsx
// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab)
import { NavLink } from "react-router-dom";

export default function BoardTabs() {
  const base = "/admin/community";

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `ds-tab ${isActive ? "is-active" : ""}`;

  return (
    <div className="ds-tabs ds-tabs--flat border-b border-[var(--color-border-divider)] mb-6" role="tablist">
      <NavLink to={`${base}/admin?tab=notice`} className={tabClass}>공지사항</NavLink>
      <NavLink to={`${base}/qna`} className={tabClass}>QnA</NavLink>
      <NavLink to={`${base}/review`} className={tabClass}>수강후기</NavLink>
    </div>
  );
}
