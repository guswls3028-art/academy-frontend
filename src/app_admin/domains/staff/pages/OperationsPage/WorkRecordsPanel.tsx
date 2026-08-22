// PATH: src/app_admin/domains/staff/pages/OperationsPage/WorkRecordsPanel.tsx
// 월 전체 근무기록 — 섹션 카드 스타일 (staff-area), 전역 DS Button 사용

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { cx } from "@/shared/utils/cx";
import { useConfirm } from "@/shared/ui/confirm";
import { LockBadge } from "../../components/StatusBadge";
import { useWorkMonth } from "../../operations/context/workMonthHooks";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import type { WorkRecord } from "../../api/workRecords.api";
import CreateWorkRecordModal from "./CreateWorkRecordModal";
import "../../styles/staff-area.css";

export default function WorkRecordsPanel() {
  const confirm = useConfirm();
  const {
    staffId,
    range,
    locked,
    lockCheckPending,
    lockCheckFailed,
    writeBlocked,
  } = useWorkMonth();
  const { listQ, deleteM } = useWorkRecords({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkRecord | null>(null);

  if (listQ.isLoading) {
    return (
      <section className="staff-area staff-section-card">
        <div className="staff-section-card__body">
          <p className="staff-helper">불러오는 중...</p>
        </div>
      </section>
    );
  }
  if (listQ.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="근무기록을 불러오지 못했습니다"
        description="연결 상태를 확인한 뒤 다시 시도해 주세요."
        actions={
          <Button intent="secondary" size="sm" onClick={() => void listQ.refetch()}>
            다시 시도
          </Button>
        }
      />
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
            disabled={writeBlocked}
            title={
              locked
                ? "마감된 월입니다."
                : lockCheckPending
                  ? "마감 상태를 확인하는 중입니다."
                  : lockCheckFailed
                    ? "마감 상태를 확인하지 못해 추가할 수 없습니다."
                    : undefined
            }
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
        {lockCheckFailed && (
          <p className="staff-helper text-[var(--color-danger)] w-full mt-1">
            마감 상태를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.
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
                data-testid={`staff-work-record-${r.id}`}
                className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div
                    data-testid="staff-work-record-summary"
                    className="min-w-0"
                  >
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

                  <div
                    data-testid="staff-work-record-actions"
                    className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-3"
                  >
                    <div className="mr-auto text-left sm:mr-0 sm:text-right">
                      <div className="staff-helper">금액</div>
                      <div className="staff-body font-semibold tabular-nums">
                        {r.amount != null ? `${r.amount.toLocaleString()}원` : "-"}
                      </div>
                    </div>

                    <Button
                      intent="secondary"
                      size="sm"
                      leftIcon={<Pencil size={14} />}
                      disabled={writeBlocked}
                      title={
                        locked
                          ? "마감된 월입니다."
                          : lockCheckPending
                            ? "마감 상태를 확인하는 중입니다."
                            : lockCheckFailed
                              ? "마감 상태를 확인하지 못했습니다."
                              : undefined
                      }
                      onClick={() => {
                        if (writeBlocked) return;
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      수정
                    </Button>

                    <Button
                      intent="danger"
                      size="sm"
                      disabled={writeBlocked || deleteM.isPending}
                      title={
                        locked
                          ? "마감된 월입니다."
                          : lockCheckPending
                            ? "마감 상태를 확인하는 중입니다."
                            : lockCheckFailed
                              ? "마감 상태를 확인하지 못했습니다."
                          : deleteM.isPending
                          ? "처리 중…"
                          : undefined
                      }
                      onClick={() => {
                        if (writeBlocked || deleteM.isPending) return;
                        void (async () => {
                          const ok = await confirm({
                            title: "근무 기록 삭제",
                            message: `${r.date} · ${r.work_type_name} 근무 기록을 삭제하시겠습니까?`,
                            confirmText: "삭제",
                            danger: true,
                          });
                          if (ok) deleteM.mutate(r.id);
                        })();
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

        {!writeBlocked && (
          <CreateWorkRecordModal
            open={open}
            initial={editing}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        )}
      </div>
    </section>
  );
}
