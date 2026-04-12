// PATH: src/app_admin/domains/staff/pages/OperationsPage/MonthLockPanel.tsx
// 월 마감 — 대형 섹션 카드 스타일 (staff-area), 전역 DS Button 사용

import { Button } from "@/shared/ui/ds";
import { LockBadge } from "../../components/StatusBadge";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import "../../styles/staff-area.css";

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
    <section
      className={cx(
        "staff-area staff-section-card overflow-hidden",
        locked
          ? "border-[color-mix(in_srgb,var(--color-danger)_25%,var(--color-border-divider))]"
          : "border-[color-mix(in_srgb,var(--color-success)_25%,var(--color-border-divider))]"
      )}
    >
      <div
        className={cx(
          "staff-section-card__header flex flex-wrap items-center justify-between gap-4",
          locked
            ? "bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))]"
            : "bg-[color-mix(in_srgb,var(--color-success)_8%,var(--color-bg-surface))]"
        )}
      >
        <div>
          <h2 className="staff-section-card__title flex items-center gap-2">
            월 마감
            <LockBadge state={locked ? "LOCKED" : "OPEN"} />
          </h2>
          <p className="staff-section-card__desc">
            {year}년 {month}월 · 마감 시 해당 월 급여가 확정됩니다.
          </p>
        </div>
        <div className="shrink-0">
          <Button
            intent="danger"
            size="sm"
            disabled={!!disabledReason || lockM.isPending}
            title={
              disabledReason ||
              (lockM.isPending ? "처리 중입니다." : "이번 달 근무·비용을 확정합니다. 마감 후에는 수정할 수 없습니다.")
            }
            onClick={() => {
              if (disabledReason || lockM.isPending) return;
              if (
                !confirm(
                  `${year}년 ${month}월을 마감할까요?\n\n마감 후에는 근무·비용 수정이 불가능합니다.`
                )
              )
                return;
              lockM.mutate();
            }}
          >
            {lockM.isPending ? "처리 중…" : "월 마감"}
          </Button>
        </div>
      </div>

      <div className="staff-section-card__body">
        {locked ? (
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_6%,var(--color-bg-surface))] px-4 py-3">
            <p className="staff-body font-semibold text-[var(--color-danger)]">
              이 달은 마감되었습니다.
            </p>
            <p className="staff-helper mt-1">
              마감된 월은 수정할 수 없습니다.
            </p>
          </div>
        ) : (
          <p className="staff-helper">
            마감 전까지 근무·비용을 수정할 수 있습니다. 마감하면 해당 월 급여가 확정됩니다.
          </p>
        )}
      </div>
    </section>
  );
}
