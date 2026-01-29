// PATH: src/features/staff/pages/OperationsPage/MonthLockPanel.tsx
import ActionButton from "../../components/ActionButton";
import { LockBadge } from "../../components/StatusBadge";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function MonthLockPanel() {
  const { year, month, locked, canManage, lockM } = useWorkMonth();

  const disabledReason = locked
    ? "이미 마감된 월입니다."
    : !canManage
    ? "마감은 관리자만 가능합니다."
    : "";

  return (
    <div
      className={cx(
        "rounded-2xl border px-5 py-4 space-y-2",
        locked
          ? "border-[color-mix(in_srgb,var(--color-danger)_55%,transparent)] bg-[var(--color-danger-soft)]"
          : "border-[color-mix(in_srgb,var(--color-success)_55%,transparent)] bg-[var(--color-success-soft)]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">
              {year}년 {month}월
            </div>
            <LockBadge state={locked ? "LOCKED" : "OPEN"} />
          </div>

          <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            * <b>월 마감 = 급여 확정</b> · 마감 후 근무/비용 <b>생성·수정·삭제</b> 불가
            <br />
            * 급여 스냅샷(PayrollSnapshot)이 생성되며 이후 변경되지 않습니다.
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <ActionButton
            variant="danger"
            size="sm"
            disabledReason={disabledReason || (lockM.isPending ? "처리 중입니다." : "")}
            title={
              disabledReason ||
              "이번 달 근무/비용을 확정합니다. 이후 수정·삭제 불가하며 급여 스냅샷이 생성됩니다."
            }
            onClick={() => {
              if (disabledReason || lockM.isPending) return;

              if (
                !confirm(
                  [
                    `${year}년 ${month}월을 마감할까요?`,
                    "",
                    "- 마감 후에는 근무/비용 수정·삭제가 불가능합니다.",
                    "- 급여 스냅샷이 생성됩니다.",
                  ].join("\n")
                )
              )
                return;

              lockM.mutate();
            }}
          >
            월 마감
          </ActionButton>
        </div>
      </div>

      {locked && (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-danger-soft)_70%,white)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--color-danger)]">
            마감 완료: 이 달은 확정 데이터입니다.
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            마감된 월은 변경이 불가능합니다. (서버에서 400으로 보장)
          </div>
        </div>
      )}
    </div>
  );
}
