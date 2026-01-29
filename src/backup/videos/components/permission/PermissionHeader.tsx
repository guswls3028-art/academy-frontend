// src/features/videos/components/permission/PermissionHeader.tsx

import { TabKey } from "./permission.types";

export default function PermissionHeader({
  tab,
  onChangeTab,
  onClose,
  isFetching,
  focusEnrollment,
  onClearFocus,
}: {
  tab: TabKey;
  onChangeTab: (t: TabKey) => void;
  onClose: () => void;
  isFetching: boolean;
  focusEnrollment: number | null;
  onClearFocus: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
      <div className="flex items-center gap-2">
        {(["permission", "achievement", "log"] as TabKey[]).map((key) => (
          <button
            key={key}
            className={`text-sm px-3 py-1 rounded border ${
              tab === key ? "bg-white font-semibold" : "bg-gray-100"
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
          <span className="text-xs text-gray-500 ml-2">
            {isFetching ? "동기화 중..." : "최신"}
          </span>
        )}

        {focusEnrollment && tab === "permission" && (
          <button
            className="ml-2 text-xs px-2 py-1 border rounded bg-white"
            onClick={onClearFocus}
          >
            학생 필터 해제
          </button>
        )}
      </div>

      <button
        onClick={onClose}
        className="text-xs px-3 py-1 border rounded bg-white"
      >
        닫기
      </button>
    </div>
  );
}
