// PATH: src/features/staff/pages/OperationsPage/WorkRecordsPanel.tsx
// 월 전체 근무기록 — 섹션 카드 스타일 (staff-area)

import { useState } from "react";
import ActionButton from "../../components/ActionButton";
import { LockBadge } from "../../components/StatusBadge";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import CreateWorkRecordModal from "./CreateWorkRecordModal";
import "../../styles/staff-area.css";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function WorkRecordsPanel() {
  const { staffId, range, locked } = useWorkMonth();
  const { listQ, deleteM } = useWorkRecords({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });

  const [open, setOpen] = useState(false);

  if (listQ.isLoading) {
    return (
      <section className="staff-area staff-section-card">
        <div className="staff-section-card__body">
          <p className="staff-helper">불러오는 중...</p>
        </div>
      </section>
    );
  }

  const rows = listQ.data ?? [];

  return (
    <section
      className={cx(
        "staff-area staff-section-card",
        "overflow-hidden"
      )}
    >
      <div
        className={cx(
          "staff-section-card__header flex flex-wrap items-center justify-between gap-4",
          locked ? "bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))]" : ""
        )}
      >
        <div>
          <h2 className="staff-section-card__title flex items-center gap-2">
            월 전체 근무 기록
            {locked && <LockBadge state="LOCKED" />}
          </h2>
          <p className="staff-section-card__desc">
            {range.from} ~ {range.to} · 근무시간·금액은 서버에서 자동 계산됩니다.
          </p>
        </div>
        <div className="shrink-0">
          <ActionButton
            variant="primary"
            size="xs"
            disabledReason={locked ? "마감된 월입니다." : ""}
            onClick={() => setOpen(true)}
          >
            + 추가
          </ActionButton>
        </div>
        {locked && (
          <p className="staff-helper text-[var(--color-danger)] w-full mt-1">
            마감된 월입니다 · 생성/수정/삭제 불가
          </p>
        )}
      </div>

      <div className={cx("staff-section-card__body", locked && "opacity-95")}>
        {rows.length === 0 ? (
          <div className="staff-section-card__empty">
            <div className="staff-section-title">기록 없음</div>
            <p className="staff-helper mt-2">근무 기록을 추가하면 이곳에 리스트가 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="staff-body font-semibold">
                      {r.date} · {r.work_type_name}
                    </div>
                    <div className="staff-helper mt-1">
                      {r.start_time} ~ {r.end_time}{" "}
                      {typeof r.break_minutes === "number" && r.break_minutes > 0
                        ? `· 휴게 ${r.break_minutes}분`
                        : ""}
                    </div>
                    {!!r.memo && (
                      <div className="staff-helper mt-1">메모: {r.memo}</div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <div className="text-right">
                      <div className="staff-helper">금액</div>
                      <div className="staff-body font-semibold tabular-nums">
                        {r.amount?.toLocaleString() ?? "-"}원
                      </div>
                    </div>

                    <ActionButton
                      variant="danger-outline"
                      size="xs"
                      disabledReason={locked ? "마감된 월입니다." : deleteM.isPending ? "처리 중..." : ""}
                      onClick={() => {
                        if (locked || deleteM.isPending) return;
                        if (!confirm("이 근무 기록을 삭제할까요?")) return;
                        deleteM.mutate(r.id);
                      }}
                    >
                      삭제
                    </ActionButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!locked && <CreateWorkRecordModal open={open} onClose={() => setOpen(false)} />}
      </div>

      <div className="staff-section-card__footer">
        마감된 월은 서버에서 변경을 거부합니다(400). 프론트는 UX로만 차단합니다.
      </div>
    </section>
  );
}
