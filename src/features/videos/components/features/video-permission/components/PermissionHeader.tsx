// PATH: src/features/videos/components/features/video-permission/components/PermissionHeader.tsx

import type { TabKey } from "../permission.types";

export default function PermissionHeader({
  tab,
  onChangeTab,
  isFetching,
  focusEnrollment,
  onClearFocus,
}: {
  tab: TabKey;
  onChangeTab: (t: TabKey) => void;
  isFetching: boolean;
  focusEnrollment: number | null;
  onClearFocus: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
      {(["permission", "achievement", "log"] as TabKey[]).map((key) => (
        <button
          key={key}
          className={`text-sm px-3 py-1 rounded border ${
            tab === key
              ? "bg-[var(--bg-surface)] font-semibold"
              : "bg-[var(--bg-surface-soft)]"
          }`}
          onClick={() => onChangeTab(key)}
        >
          {key === "permission"
            ? "권한 설정"
            : key === "achievement"
            ? "학습 성취도"
            : "시청 로그"}
        </button>
      ))}

      {tab === "permission" && (
        <span className="text-xs text-[var(--text-muted)] ml-2">
          {isFetching ? "동기화 중..." : "최신"}
        </span>
      )}

      {focusEnrollment && tab === "permission" && (
        <button
          className="ml-2 text-xs px-2 py-1 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-soft)]"
          onClick={onClearFocus}
        >
          학생 필터 해제
        </button>
      )}
    </div>
  );
}
