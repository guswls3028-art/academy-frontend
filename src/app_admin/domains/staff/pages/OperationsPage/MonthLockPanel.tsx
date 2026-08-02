// PATH: src/app_admin/domains/staff/pages/OperationsPage/MonthLockPanel.tsx
// 월 마감 — 대형 섹션 카드 스타일 (staff-area), 전역 DS Button 사용

import { Button } from "@/shared/ui/ds";
import { cx } from "@/shared/utils/cx";
import { LockBadge } from "../../components/StatusBadge";
import { useWorkMonth } from "../../operations/context/workMonthHooks";
import { useConfirm } from "@/shared/ui/confirm";
import "../../styles/staff-area.css";

export default function MonthLockPanel() {
  const confirm = useConfirm();
  const {
    year,
    month,
    locked,
    lockCheckPending,
    lockCheckFailed,
    retryLockCheck,
    canManage,
    payType,
    lockM,
  } = useWorkMonth();

  const disabledReason = payType === "MONTHLY"
    ? "월급 직원은 근로계약·수당·공제를 별도로 확인해야 합니다."
    : locked
    ? "이미 마감된 월입니다."
    : lockCheckPending
    ? "마감 상태를 확인하는 중입니다."
    : lockCheckFailed
    ? "마감 상태를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요."
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
            {!lockCheckFailed && !lockCheckPending && (
              <LockBadge state={locked ? "LOCKED" : "OPEN"} />
            )}
          </h2>
          <p className="staff-section-card__desc">
            {year}년 {month}월 · 근태와 승인 선결제 환급을 고정합니다.
          </p>
        </div>
        <div className="shrink-0">
          <Button
            intent="danger"
            size="sm"
            disabled={!!disabledReason || lockM.isPending}
            title={
              disabledReason ||
              (lockM.isPending ? "처리 중입니다." : "이번 달 근태·환급 기록을 고정합니다. 마감 후에는 수정할 수 없습니다.")
            }
            onClick={() => {
              if (disabledReason || lockM.isPending) return;
              void (async () => {
                const ok = await confirm({
                  title: `${year}년 ${month}월 마감`,
                  message: "근태와 승인 환급을 고정합니다. 마감 후에는 해당 월 기록을 수정할 수 없습니다.",
                  confirmText: "월 마감",
                  danger: true,
                });
                if (ok) lockM.mutate();
              })();
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
        ) : lockCheckFailed ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="staff-helper text-[var(--color-danger)]">
              마감 상태를 확인하지 못해 안전을 위해 작업을 막았습니다.
            </p>
            <Button intent="secondary" size="sm" onClick={retryLockCheck}>
              다시 확인
            </Button>
          </div>
        ) : (
          <p className="staff-helper">
            {payType === "MONTHLY"
              ? "월급 직원은 자동 마감하지 않습니다. 근로계약·수당·공제를 별도로 확인해 주세요."
              : "마감 전까지 근태·환급 기록을 수정할 수 있습니다. 마감하면 해당 월 참고 합계가 고정됩니다."}
          </p>
        )}
      </div>
    </section>
  );
}
