// PATH: src/app_teacher/shared/ui/PcOnlyHint.tsx
// PC 전용 기능 안내 — 모바일에서 미지원 도메인 진입 시 표시.
// "데스크톱 버전 열기" 버튼으로 admin 라우트로 즉시 전환.
import { useNavigate } from "react-router-dom";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import { Monitor, ChevronLeft } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";

interface Props {
  title: string;
  description?: string;
  /** 데스크톱에서 열 admin 경로 (예: "/admin/fees") */
  desktopPath: string;
  /** 사유 (왜 모바일에서 못 하는지) */
  reason?: string;
}

export default function PcOnlyHint({ title, description, desktopPath, reason }: Props) {
  const navigate = useNavigate();

  const openDesktop = () => {
    setPreferAdmin(true);
    window.location.href = desktopPath;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button
          onClick={() => navigate(-1)}
          className="flex cursor-pointer"
          style={{
            padding: 8,
            minWidth: "var(--tc-touch-min)",
            minHeight: "var(--tc-touch-min)",
            background: "none",
            border: "none",
            color: "var(--tc-text-secondary)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {title}
        </h1>
      </div>

      <Card>
        <div className="flex flex-col items-center text-center" style={{ padding: "var(--tc-space-5) var(--tc-space-3)" }}>
          <div
            className="rounded-full flex items-center justify-center mb-3"
            style={{
              width: 56,
              height: 56,
              background: "var(--tc-primary-bg)",
              color: "var(--tc-primary)",
            }}
          >
            <Monitor size={28} />
          </div>
          <div className="text-[15px] font-bold mb-1" style={{ color: "var(--tc-text)" }}>
            PC에서 처리해주세요
          </div>
          {description && (
            <div className="text-[13px] mb-2" style={{ color: "var(--tc-text-secondary)", lineHeight: 1.5 }}>
              {description}
            </div>
          )}
          {reason && (
            <div
              className="text-[11px] mt-2 px-3 py-2 rounded"
              style={{
                background: "var(--tc-surface-soft)",
                color: "var(--tc-text-muted)",
                lineHeight: 1.5,
                maxWidth: 320,
              }}
            >
              {reason}
            </div>
          )}

          <button
            onClick={openDesktop}
            className="flex items-center justify-center gap-2 text-sm font-bold cursor-pointer mt-5"
            style={{
              padding: "12px 20px",
              minHeight: "var(--tc-touch-min)",
              borderRadius: "var(--tc-radius)",
              border: "none",
              background: "var(--tc-primary)",
              color: "#fff",
              minWidth: 200,
            }}
          >
            <Monitor size={14} /> 데스크톱 버전 열기
          </button>
        </div>
      </Card>
    </div>
  );
}
