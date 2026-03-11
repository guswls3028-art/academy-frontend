// PATH: src/features/videos/components/features/video-permission/components/PermissionHeader.tsx

import type { TabKey } from "../permission.types";

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: "permission", label: "권한 설정" },
  { key: "achievement", label: "학습 성취도" },
  { key: "log", label: "시청 로그" },
];

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
    <div className="flex items-center gap-3">
      {/* Segmented tab bar */}
      <div className="permission-tab-bar">
        {TAB_ITEMS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={[
              "permission-tab",
              tab === key && "permission-tab--active",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChangeTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "permission" && (
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {isFetching ? "동기화 중…" : "최신"}
        </span>
      )}

      {focusEnrollment && tab === "permission" && (
        <button
          type="button"
          className="ml-1 text-[11px] px-2 py-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] transition"
          onClick={onClearFocus}
        >
          학생 필터 해제
        </button>
      )}
    </div>
  );
}
