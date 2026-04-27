// PATH: src/app_admin/domains/videos/components/features/video-permission/components/PermissionHeader.tsx

import type { TabKey } from "../permission.types";
import { Badge, Button } from "@/shared/ui/ds";

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
        <Badge variant="solid" tone={isFetching ? "warning" : "success"} oneChar>
          {isFetching ? "동기화" : "최신"}
        </Badge>
      )}

      {focusEnrollment && tab === "permission" && (
        <Button intent="ghost" size="sm" onClick={onClearFocus}>
          학생 필터 해제
        </Button>
      )}
    </div>
  );
}
