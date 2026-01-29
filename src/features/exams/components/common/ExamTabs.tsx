/**
 * ExamTabs
 *
 * WHY:
 * - disabled 탭을 "숨김"하지 않고, 왜 막혔는지 툴팁/사유로 명시
 * - 라우팅/탭 구조 유지 (state 기반 탭 전환 유지)
 * - session/assets gate는 UI에서만 안내하고, 계산/판정은 절대 하지 않는다
 */

import type { ExamTabKey } from "../../types";

type Props = {
  activeTab: ExamTabKey;
  onChange: (k: ExamTabKey) => void;
  hasSession: boolean;
  assetsReady: boolean;
};

const TABS: { key: ExamTabKey; label: string }[] = [
  { key: "setup", label: "기본 설정" },
  { key: "assets", label: "자산" },
  { key: "submissions", label: "제출" },
  { key: "results", label: "결과" },
];

function disabledReason(
  key: ExamTabKey,
  hasSession: boolean,
  assetsReady: boolean
) {
  if (key === "submissions") {
    if (!hasSession) return "세션 컨텍스트(session_id)가 필요합니다.";
    if (!assetsReady) return "시험 자산(PDF/OMR)이 준비되어야 합니다.";
  }

  if (key === "results") {
    if (!hasSession) return "세션 컨텍스트(session_id)가 필요합니다.";
  }

  return "";
}

export default function ExamTabs({
  activeTab,
  onChange,
  hasSession,
  assetsReady,
}: Props) {
  return (
    <div className="flex gap-6 border-b border-[var(--border-divider)]">
      {TABS.map((t) => {
        const reason = disabledReason(t.key, hasSession, assetsReady);
        const disabled = !!reason;

        const isActive = activeTab === t.key;

        return (
          <div key={t.key} className="flex flex-col">
            <button
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(t.key)}
              title={disabled ? reason : undefined}
              className={[
                "pb-2 text-sm border-b-2 transition-colors",
                disabled && "opacity-40 cursor-not-allowed",
                isActive
                  ? "border-[var(--color-primary)] font-semibold text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {t.label}
            </button>

            {/* ✅ disabled 사유를 hover뿐 아니라 텍스트로도 노출 (접근성/현장 UX) */}
            {disabled && (
              <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                {reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
