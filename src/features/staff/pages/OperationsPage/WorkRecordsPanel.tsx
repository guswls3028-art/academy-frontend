// PATH: src/features/staff/pages/OperationsPage/WorkRecordsPanel.tsx
// 월 전체 근무기록 — 섹션 카드 스타일 (staff-area), 전역 DS Button 사용

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/ds";
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
            {range.from} ~ {range.to}
          </p>
        </div>
        <div className="shrink-0">
          <Button
            intent="primary"
            size="sm"
            leftIcon={<Plus size={14} strokeWidth={2.5} />}
            disabled={locked}
            title={locked ? "마감된 월입니다." : undefined}
            onClick={() => setOpen(true)}
          >
            추가
          </Button>
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
                        {r.amount != null ? `${r.amount.toLocaleString()}원` : "-"}
                      </div>
                    </div>

                    <Button
                      intent="danger"
                      size="sm"
                      disabled={locked || deleteM.isPending}
                      title={
                        locked
                          ? "마감된 월입니다."
                          : deleteM.isPending
                          ? "처리 중…"
                          : undefined
                      }
                      onClick={() => {
                        if (locked || deleteM.isPending) return;
                        if (!confirm("이 근무 기록을 삭제할까요?")) return;
                        deleteM.mutate(r.id);
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!locked && <CreateWorkRecordModal open={open} onClose={() => setOpen(false)} />}
      </div>
    </section>
  );
}
