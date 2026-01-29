// PATH: src/features/staff/components/WorkMonthLockBar.tsx
import { WorkMonthLock } from "../api/staffWorkMonthLock.api";

export default function WorkMonthLockBar({
  locks,
  isManager,
  onLock,
}: {
  locks?: WorkMonthLock[];
  isManager: boolean;
  onLock?: () => void;
}) {
  const locked = !!locks?.some((l) => !!l.is_locked);

  const lockDisabledReason = locked
    ? "이미 마감된 월입니다."
    : !isManager
    ? "마감은 관리자만 가능합니다."
    : "";

  return (
    <div className="space-y-2">
      <div
        className={[
          "flex items-center justify-between rounded-lg border px-4 py-3 text-sm",
          locked
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-green-300 bg-green-50 text-green-700",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <div className="font-semibold">{locked ? "🔒 마감된 월" : "🔓 열려있는 월"}</div>

          <span
            className={[
              "px-2 py-0.5 rounded-full text-xs font-semibold border",
              isManager
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-gray-50 text-gray-600 border-gray-200",
            ].join(" ")}
            title={isManager ? "관리자 권한" : "일반 사용자 권한"}
          >
            {isManager ? "관리자" : "일반 사용자"}
          </span>
        </div>

        <button
          disabled={!!lockDisabledReason}
          title={
            lockDisabledReason ||
            "이번 달 근무기록을 마감합니다. 이후 수정/삭제 불가하며 급여 스냅샷이 생성됩니다."
          }
          onClick={() => {
            if (locked || !isManager) return;
            if (
              !confirm(
                "이번 달 근무기록을 마감할까요?\n마감 이후에는 근무기록 수정/삭제가 불가능하며,\n급여 스냅샷(확정)이 생성됩니다."
              )
            )
              return;
            onLock?.();
          }}
          className={[
            "px-3 py-1.5 rounded-md text-xs font-semibold",
            lockDisabledReason
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-red-600 text-white hover:opacity-90",
          ].join(" ")}
        >
          이번달 마감
        </button>
      </div>

      {/* ✅ 고정 설명 */}
      <div className="text-[11px] text-[var(--text-muted)]">
        * <b>월 마감</b>은 해당 월의 근무/비용을 기준으로 <b>급여를 확정</b>하고, 이후 변경을 막기 위해{" "}
        <b>급여 스냅샷</b>을 생성합니다.
      </div>
    </div>
  );
}
