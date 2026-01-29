// PATH: src/features/staff/components/WorkMonthLockBar.tsx
import { WorkMonthLock } from "../api/workMonthLocks.api";
import ActionButton from "./ActionButton";
import { LockBadge, RoleBadge } from "./StatusBadge";

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

  const disabledReason = locked
    ? "이미 마감된 월입니다."
    : !isManager
    ? "마감은 관리자만 가능합니다."
    : "";

  return (
    <div className="space-y-2">
      <div
        className={[
          "flex items-start justify-between gap-4 rounded-2xl border px-5 py-4 text-sm",
          locked
            ? "border-[color-mix(in_srgb,var(--color-danger)_55%,transparent)] bg-[var(--color-danger-soft)]"
            : "border-[color-mix(in_srgb,var(--color-success)_55%,transparent)] bg-[var(--color-success-soft)]",
        ].join(" ")}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LockBadge state={locked ? "LOCKED" : "OPEN"} />
            <RoleBadge isManager={isManager} />
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            * 월 마감 = 급여 확정 · 이후 변경 불가
          </div>
        </div>

        <ActionButton
          variant="danger"
          size="sm"
          disabledReason={disabledReason}
          title={
            disabledReason ||
            "이번 달 근무/비용을 확정합니다. 이후 수정·삭제 불가하며 급여 스냅샷이 생성됩니다."
          }
          onClick={() => {
            if (disabledReason) return;
            if (
              !confirm(
                [
                  "이번 달을 마감할까요?",
                  "",
                  "- 마감 후에는 근무/비용 수정·삭제가 불가능합니다.",
                  "- 급여 스냅샷이 생성됩니다.",
                ].join("\n")
              )
            )
              return;
            onLock?.();
          }}
        >
          월 마감
        </ActionButton>
      </div>
    </div>
  );
}
