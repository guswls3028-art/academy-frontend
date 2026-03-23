// PATH: src/features/clinic/components/home/ClinicWeeklySummary.tsx
import { useState } from "react";
import dayjs from "dayjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { ClinicParticipant } from "../../api/clinicParticipants.api";
import {
  deleteClinicSession,
  type ClinicSessionDetail,
} from "../../api/clinicSessions.api";
import ClinicCreatePanel from "../ClinicCreatePanel";
import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  MODAL_WIDTH,
} from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";

type SessionBlock = {
  sessionId: number;
  start: string;
  end?: string;
  count: number;
};

function buildWeek(from: string) {
  return Array.from({ length: 7 }, (_, i) =>
    dayjs(from).add(i, "day").format("YYYY-MM-DD")
  );
}

function buildSessionBlocks(rows: ClinicParticipant[]): SessionBlock[] {
  const bySession = new Map<number, ClinicParticipant[]>();

  rows.forEach((r) => {
    if (!r.session) return;
    bySession.set(r.session, [...(bySession.get(r.session) ?? []), r]);
  });

  const blocks: SessionBlock[] = [];

  for (const [sessionId, items] of bySession.entries()) {
    const first = items[0];
    const start = (first.session_start_time || "").slice(0, 5);
    const end = first.session_end_time
      ? first.session_end_time.slice(0, 5)
      : undefined;

    blocks.push({
      sessionId,
      start,
      end,
      count: items.length,
    });
  }

  blocks.sort((a, b) => (a.start > b.start ? 1 : -1));
  return blocks;
}

export default function ClinicWeeklySummary({
  from,
  to,
  rows,
  loading,
  onSelectDay,
}: {
  from: string;
  to: string;
  rows: ClinicParticipant[];
  loading: boolean;
  onSelectDay: (date: string) => void;
}) {
  const qc = useQueryClient();
  const days = buildWeek(from);

  /* ── 수정/삭제 상태 ── */
  const [actionMenuBlock, setActionMenuBlock] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<ClinicSessionDetail | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SessionBlock | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteClinicSession(id),
    onSuccess: () => {
      invalidateAll();
      setDeleteConfirm(null);
      feedback.success("클리닉이 삭제되었습니다.");
    },
    onError: () => feedback.error("삭제에 실패했습니다."),
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
    qc.invalidateQueries({ queryKey: ["clinic-sessions-month"] });
    qc.invalidateQueries({ queryKey: ["clinic-participants"] });
  }

  async function handleEdit(block: SessionBlock) {
    setActionMenuBlock(null);
    try {
      const res = await api.get(`/clinic/sessions/${block.sessionId}/`);
      setEditSession(res.data);
      setEditModalOpen(true);
    } catch {
      feedback.error("세션 정보를 불러올 수 없습니다.");
    }
  }

  function handleDeleteClick(block: SessionBlock) {
    setActionMenuBlock(null);
    setDeleteConfirm(block);
  }

  const rowsByDay: Record<string, ClinicParticipant[]> = Object.fromEntries(
    days.map((d) => [d, []])
  );

  rows.forEach((r) => {
    if (rowsByDay[r.session_date]) {
      rowsByDay[r.session_date].push(r);
    }
  });

  return (
    <div className="rounded-2xl border bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b bg-[var(--color-bg-surface-soft)]">
        <div className="text-sm font-semibold">주간 요약</div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {from} ~ {to}
        </div>
      </div>

      <div className="p-5">
        {loading && (
          <div className="text-xs text-[var(--color-text-muted)]">불러오는 중...</div>
        )}

        {!loading && (
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const dayRows = rowsByDay[d];
              const blocks = buildSessionBlocks(dayRows);
              const sessionCount = blocks.length;
              const participantCount = dayRows.length;
              const dow = dayjs(d).format("dd");

              return (
                <div key={d} className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-3 text-left">
                  {/* 요일 헤더 — 클릭하면 해당 날짜로 이동 */}
                  <button
                    type="button"
                    onClick={() => onSelectDay(d)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="text-sm font-semibold">{dow}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      {sessionCount}회 | {participantCount}명
                    </div>
                  </button>

                  {/* 세션 타임 블록 */}
                  <div className="mt-2 space-y-1">
                    {blocks.map((b) => (
                      <div
                        key={b.sessionId}
                        className="clinic-session-block group"
                      >
                        <span className="clinic-session-block__text">
                          {b.start}{b.end ? ` ~ ${b.end}` : ""} | {b.count}명
                        </span>

                        {/* 톱니 아이콘 — hover 시 표시 */}
                        <button
                          type="button"
                          className="clinic-session-block__gear"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuBlock(
                              actionMenuBlock === b.sessionId ? null : b.sessionId
                            );
                          }}
                          aria-label="세션 관리"
                        >
                          <Settings size={12} />
                        </button>

                        {/* 액션 드롭다운 */}
                        {actionMenuBlock === b.sessionId && (
                          <div className="clinic-session-block__menu">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleEdit(b); }}
                            >
                              <Pencil size={12} />
                              수정
                            </button>
                            <button
                              type="button"
                              className="clinic-session-block__menu-danger"
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(b); }}
                            >
                              <Trash2 size={12} />
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {blocks.length === 0 && (
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        일정 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-5 pb-4">
        <div className="text-[11px] text-[var(--color-text-muted)]">
          * 날짜 클릭 시 해당 일자의 운영 화면으로 이동합니다.
        </div>
      </div>

      {/* ── 수정 모달 ── */}
      <AdminModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditSession(null); }}
        type="action"
        width={MODAL_WIDTH.md}
      >
        <ModalHeader type="action" title="클리닉 세션 수정" />
        <ModalBody>
          {editSession && (
            <ClinicCreatePanel
              asModal
              editSession={editSession}
              onUpdated={() => {
                setEditModalOpen(false);
                setEditSession(null);
                invalidateAll();
              }}
            />
          )}
        </ModalBody>
      </AdminModal>

      {/* ── 삭제 확인 모달 ── */}
      <AdminModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        type="action"
        width={MODAL_WIDTH.sm}
      >
        <ModalHeader type="action" title="클리닉 세션 삭제" />
        <ModalBody>
          <div className="clinic-session-block__delete-warn">
            <div className="clinic-session-block__delete-warn-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="clinic-session-block__delete-warn-body">
              <p className="clinic-session-block__delete-warn-title">
                이 세션을 삭제하시겠습니까?
              </p>
              <p className="clinic-session-block__delete-warn-desc">
                삭제하면 해당 세션의 <strong>예약, 참가자, 출결 기록이 모두 함께 삭제</strong>됩니다.
                이 작업은 되돌릴 수 없습니다.
              </p>
              {deleteConfirm && (
                <div className="clinic-session-block__delete-warn-detail">
                  {deleteConfirm.start}
                  {deleteConfirm.end ? ` ~ ${deleteConfirm.end}` : ""}
                  {" "}| {deleteConfirm.count}명 예약
                </div>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter
          right={
            <div className="flex items-center gap-2">
              <Button
                intent="secondary"
                size="md"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteMutation.isPending}
              >
                취소
              </Button>
              <Button
                intent="danger"
                size="md"
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.sessionId)}
                loading={deleteMutation.isPending}
              >
                삭제
              </Button>
            </div>
          }
        />
      </AdminModal>
    </div>
  );
}
