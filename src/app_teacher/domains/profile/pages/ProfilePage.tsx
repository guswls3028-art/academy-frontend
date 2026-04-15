// PATH: src/app_teacher/domains/profile/pages/ProfilePage.tsx
// 내 프로필 — 간소 버전
import { useNavigate } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { useA2HS } from "@teacher/shared/hooks/useA2HS";

const ROLE_LABELS: Record<string, string> = {
  owner: "원장",
  admin: "관리자",
  teacher: "강사",
  staff: "직원",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canInstall, isInstalled, promptInstall } = useA2HS();
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

      {/* PWA 설치 카드 */}
      {canInstall && (
        <button
          onClick={promptInstall}
          className="flex items-center gap-3 rounded-xl cursor-pointer w-full text-left"
          style={{
            background: "var(--tc-primary-bg)",
            border: "1px solid var(--tc-primary)",
            padding: "var(--tc-space-4)",
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--tc-primary)", color: "#fff" }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: "var(--tc-primary)" }}>
              홈 화면에 추가
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-secondary)" }}>
              앱처럼 빠르게 접근할 수 있습니다
            </div>
          </div>
        </button>
      )}

      {isInstalled && (
        <div
          className="flex items-center gap-2 rounded-xl"
          style={{
            background: "var(--tc-success-bg)",
            border: "1px solid var(--tc-success)",
            padding: "var(--tc-space-3) var(--tc-space-4)",
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-success)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-[13px] font-medium" style={{ color: "var(--tc-success)" }}>
            앱이 설치되어 있습니다
          </span>
        </div>
      )}
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
