// PATH: src/features/staff/pages/OperationsPage/WorkRecordsPanel.tsx
import { useState } from "react";
import ActionButton from "../../components/ActionButton";
import { LockBadge } from "../../components/StatusBadge";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import CreateWorkRecordModal from "./CreateWorkRecordModal";

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
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-4">
        <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>
      </div>
    );
  }

  const rows = listQ.data ?? [];

  return (
    <div
      className={cx(
        "rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)]",
        "overflow-hidden"
      )}
    >
      <div
        className={cx(
          "px-5 py-4 border-b border-[var(--border-divider)]",
          locked ? "bg-[var(--color-danger-soft)]" : "bg-[var(--bg-surface-soft)]"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">근무 기록</div>
              {locked && <LockBadge state="LOCKED" />}
              <span className="text-xs text-[var(--text-muted)]">
                ({range.from} ~ {range.to})
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              * 근무시간·금액은 서버에서 자동 계산됩니다. (프론트 계산 금지)
            </div>
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
        </div>

        {locked && (
          <div className="mt-2 text-xs text-[var(--color-danger)]">
            마감된 월입니다 · 생성/수정/삭제 불가
          </div>
        )}
      </div>

      <div className={cx("p-5", locked && "opacity-95")}>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-5">
            <div className="text-sm font-semibold">기록 없음</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              근무 기록을 추가하면 이곳에 리스트가 표시됩니다.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {r.date} · {r.work_type_name}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      {r.start_time} ~ {r.end_time}{" "}
                      {typeof r.break_minutes === "number" && r.break_minutes > 0
                        ? `· 휴게 ${r.break_minutes}분`
                        : ""}
                    </div>
                    {!!r.memo && (
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        메모: {r.memo}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-[var(--text-muted)]">금액</div>
                      <div className="font-semibold">
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

      <div className="px-5 pb-4">
        <div className="text-[11px] text-[var(--text-muted)]">
          * 마감된 월은 서버에서 변경을 거부합니다(400). 프론트는 UX로만 차단합니다.
        </div>
      </div>
    </div>
  );
}
