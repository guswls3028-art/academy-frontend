// PATH: src/app_teacher/domains/profile/pages/ProfilePage.tsx
// 내 프로필 — 간소 버전
import { useNavigate } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";

const ROLE_LABELS: Record<string, string> = {
  owner: "원장",
  admin: "관리자",
  teacher: "강사",
  staff: "직원",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const name = user?.name || "사용자";
  const roleLabel = ROLE_LABELS[user?.tenantRole || ""] || "직원";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>
          내 프로필
        </h1>
      </div>

      <div
        className="flex flex-col items-center gap-3 rounded-xl"
        style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-5)" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
          style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}
        >
          {name[0]}
        </div>
        <div className="text-center">
          <div className="text-lg font-bold" style={{ color: "var(--tc-text)" }}>{name}</div>
          <div className="text-[13px] mt-0.5" style={{ color: "var(--tc-text-secondary)" }}>{roleLabel}</div>
        </div>
      </div>

      <div
        className="rounded-xl"
        style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
      >
        {user?.username && (
          <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid var(--tc-border-subtle)" }}>
            <span className="text-[13px]" style={{ color: "var(--tc-text-muted)" }}>아이디</span>
            <span className="text-sm" style={{ color: "var(--tc-text)" }}>{user.username}</span>
          </div>
        )}
        {user?.phone && (
          <div className="flex justify-between py-1.5">
            <span className="text-[13px]" style={{ color: "var(--tc-text-muted)" }}>전화</span>
            <span className="text-sm" style={{ color: "var(--tc-text)" }}>{user.phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
