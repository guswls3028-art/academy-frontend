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
        <span
          className="ds-status-badge ds-status-badge--1ch"
          data-tone={isFetching ? "warning" : "success"}
        >
          {isFetching ? "동기화" : "최신"}
        </span>
      )}

      {focusEnrollment && tab === "permission" && (
        <button
          type="button"
          style={{
            height: 24,
            padding: "0 var(--space-3)",
            fontSize: "var(--text-xs, 11px)",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            transition: "all 140ms ease",
          }}
          onClick={onClearFocus}
        >
          학생 필터 해제
        </button>
      )}
    </div>
  );
}
