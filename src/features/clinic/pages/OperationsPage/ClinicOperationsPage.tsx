// PATH: src/features/clinic/pages/OperationsPage/ClinicOperationsPage.tsx
// 운영 — 2-zone 레이아웃 (사이드바 미니캘린더 | 메인 일정 카드) + 모달 기반 생성

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  fetchClinicSessionTree,
  deleteClinicSession,
} from "../../api/clinicSessions.api";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";
import OperationsSessionTree from "../../components/OperationsSessionTree";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import AdminModal from "@/shared/ui/modal/AdminModal";

dayjs.locale("ko");

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

function formatTime(s: string | undefined) {
  if (!s) return "";
  return s.slice(0, 5) || "";
}

type SlotStatus = "normal" | "almost" | "full";

function getSessionStatus(s: ClinicSessionTreeNode): SlotStatus {
  const max = s.max_participants;
  if (max == null || max <= 0) return "normal";
  const booked = s.booked_count ?? 0;
  if (booked >= max) return "full";
  if (booked >= Math.ceil(max * 0.8)) return "almost";
  return "normal";
}

const STATUS_DOT: Record<SlotStatus, string> = {
  normal: "clinic-schedule__status-dot--normal",
  almost: "clinic-schedule__status-dot--almost",
  full: "clinic-schedule__status-dot--full",
};

const STATUS_LABEL: Record<SlotStatus, string> = {
  normal: "여유",
  almost: "거의 참",
  full: "마감",
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function ClinicOperationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [baseDate, setBaseDate] = useState(() => todayISO());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const ym = useMemo(() => {
    const d = dayjs(baseDate);
    return { year: d.year(), month: d.month() + 1 };
  }, [baseDate]);

  const treeQ = useQuery({
    queryKey: ["clinic-sessions-tree", ym.year, ym.month],
    queryFn: () => fetchClinicSessionTree({ year: ym.year, month: ym.month }),
    retry: 0,
  });

  const deleteSessionM = useMutation({
    mutationFn: (id: number) => deleteClinicSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      setDeleteConfirm(null);
      feedback.success("클리닉이 삭제되었습니다.");
    },
    onError: (e: Error) => {
      feedback.error(e.message || "삭제에 실패했습니다.");
    },
  });

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    deleteSessionM.mutate(deleteConfirm.id);
  };

  const isPastDate = baseDate < todayISO();

  const sessionsForDay = useMemo(
    () =>
      (treeQ.data ?? []).filter(
        (s) => dayjs(s.date).format("YYYY-MM-DD") === baseDate
      ),
    [treeQ.data, baseDate]
  );

  // Sort by start_time
  const sortedSessions = useMemo(
    () =>
      [...sessionsForDay].sort((a, b) =>
        (a.start_time || "").localeCompare(b.start_time || "")
      ),
    [sessionsForDay]
  );

  const dayLabel = dayjs(baseDate).format("M/D (dd)");

  return (
    <div className="clinic-page">
      {isPastDate && (
        <div
          className="clinic-schedule__past-banner"
          role="alert"
          aria-live="polite"
        >
          지난 날짜입니다.
        </div>
      )}

      <div className="clinic-schedule">
        {/* LEFT: Mini calendar sidebar */}
        <aside className="clinic-schedule__sidebar">
          <OperationsSessionTree
            sessions={treeQ.data ?? []}
            selectedDay={baseDate}
            year={ym.year}
            month={ym.month}
            todayISO={todayISO()}
            onPrevMonth={() => {
              const d = dayjs(baseDate).subtract(1, "month");
              setBaseDate(d.startOf("month").format("YYYY-MM-DD"));
            }}
            onNextMonth={() => {
              const d = dayjs(baseDate).add(1, "month");
              setBaseDate(d.startOf("month").format("YYYY-MM-DD"));
            }}
            onSelectDay={(date) => {
              setBaseDate(date);
            }}
          />
        </aside>

        {/* RIGHT: Main content */}
        <div className="clinic-schedule__main">
          {/* Toolbar */}
          <div className="clinic-schedule__toolbar">
            <div className="clinic-schedule__toolbar-left">
              <h2 className="clinic-schedule__toolbar-date">{dayLabel}</h2>
              {sessionsForDay.length > 0 && (
                <span className="clinic-schedule__toolbar-count">
                  {sessionsForDay.length}건
                </span>
              )}
            </div>
            {!isPastDate && (
              <Button
                intent="primary"
                size="md"
                onClick={() => setCreateModalOpen(true)}
                className="clinic-schedule__create-btn"
              >
                <Plus size={16} strokeWidth={2.5} />
                클리닉 만들기
              </Button>
            )}
          </div>

          {/* Session cards */}
          <div className="clinic-schedule__cards">
            {sortedSessions.length === 0 ? (
              <div className="clinic-schedule__empty">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="clinic-schedule__empty-icon"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <p className="clinic-schedule__empty-text">
                  이 날에는 클리닉이 없습니다.
                </p>
                {!isPastDate && (
                  <button
                    type="button"
                    className="clinic-schedule__empty-action"
                    onClick={() => setCreateModalOpen(true)}
                  >
                    만들기 &rarr;
                  </button>
                )}
              </div>
            ) : (
              sortedSessions.map((s) => {
                const status = getSessionStatus(s);
                const booked = s.booked_count ?? 0;
                const max = s.max_participants;
                const capacityLabel =
                  max != null && max > 0
                    ? `${booked}/${max}명`
                    : `${booked}명`;
                const fillPct =
                  max != null && max > 0
                    ? Math.min(100, Math.round((booked / max) * 100))
                    : 0;

                return (
                  <div
                    key={s.id}
                    className={cx(
                      "clinic-schedule__card",
                      `clinic-schedule__card--${status}`,
                      isPastDate && "clinic-schedule__card--past",
                      "clinic-schedule__card--clickable"
                    )}
                    onClick={() => navigate(`/admin/clinic/operations?date=${baseDate}&session=${s.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/admin/clinic/operations?date=${baseDate}&session=${s.id}`); }}
                  >
                    <span
                      className="clinic-schedule__card-bar"
                      aria-hidden
                    />
                    <div className="clinic-schedule__card-body">
                      <div className="clinic-schedule__card-top">
                        <span className="clinic-schedule__card-time">
                          {formatTime(s.start_time) || "--:--"}
                        </span>
                        <span className="clinic-schedule__card-location">
                          {s.location || s.title || "—"}
                        </span>
                        <span className="clinic-schedule__card-capacity">
                          예약 {capacityLabel}
                        </span>
                        <span
                          className={cx(
                            "clinic-schedule__status-dot",
                            STATUS_DOT[status]
                          )}
                        />
                        <span
                          className={cx(
                            "clinic-schedule__status-label",
                            `clinic-schedule__status-label--${status}`
                          )}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                      {/* Capacity progress bar */}
                      {max != null && max > 0 && (
                        <div
                          className="clinic-schedule__capacity-bar"
                          role="meter"
                          aria-valuenow={booked}
                          aria-valuemin={0}
                          aria-valuemax={max}
                          aria-label={`예약 ${booked}/${max}명`}
                        >
                          <div
                            className={cx(
                              "clinic-schedule__capacity-fill",
                              `clinic-schedule__capacity-fill--${status}`
                            )}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      )}
                      {(s.target_grade || s.title) && (
                        <div className="clinic-schedule__card-meta">
                          {s.title && s.location && (
                            <span>{s.title}</span>
                          )}
                          {s.target_grade && (
                            <span>대상: {s.target_grade}학년</span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isPastDate && (
                      <div className="clinic-schedule__card-actions">
                        <button
                          type="button"
                          className="clinic-schedule__card-delete"
                          title="클리닉 삭제"
                          aria-label={`${s.location} 클리닉 삭제`}
                          onClick={() =>
                            setDeleteConfirm({
                              id: s.id,
                              label: `${formatTime(s.start_time)} ${s.location}`,
                            })
                          }
                        >
                          <Trash2 size={16} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      <AdminModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        width={520}
      >
        <ClinicCreatePanel
          asModal
          date={baseDate}
          onDateChange={(d) => {
            setBaseDate(d);
          }}
          onCreated={(createdDate) => {
            setCreateModalOpen(false);
            if (createdDate) {
              setBaseDate(createdDate);
            }
          }}
        />
      </AdminModal>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinic-delete-title"
          onClick={() => !deleteSessionM.isPending && setDeleteConfirm(null)}
        >
          <div
            className="bg-[var(--color-surface)] rounded-xl shadow-lg max-w-md w-full p-6 border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="clinic-delete-title"
              className="text-lg font-semibold text-[var(--color-text-primary)] mb-2"
            >
              클리닉 삭제
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-1">
              <strong>{`「${deleteConfirm.label}」`}</strong> 클리닉을 정말로
              삭제하시겠습니까?
            </p>
            <p className="text-sm text-[var(--color-status-danger)] font-medium mb-4">
              주의: 삭제된 클리닉과 예약/출석 정보는 복구할 수 없습니다.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                intent="secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteSessionM.isPending}
              >
                취소
              </Button>
              <Button
                intent="primary"
                onClick={handleConfirmDelete}
                disabled={deleteSessionM.isPending}
                className="!bg-[var(--color-status-danger)] hover:!opacity-90"
              >
                {deleteSessionM.isPending ? "삭제 중…" : "삭제"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
