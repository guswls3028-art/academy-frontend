// PATH: src/features/clinic/pages/OperationsPage/ClinicOperationsPage.tsx
// 운영 — 섹션형 SSOT, 3열(날짜 트리 | 일정 | 생성)

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicParticipantStatus } from "../../api/clinicParticipants.api";
import { fetchClinicSessionTree, deleteClinicSession } from "../../api/clinicSessions.api";
import OperationsSessionTree from "../../components/OperationsSessionTree";
import ClinicDaySchedulePanel from "../../components/ClinicDaySchedulePanel";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

function normalizeClinicStatusParam(
  v: string | null
): ClinicParticipantStatus | undefined {
  if (!v) return undefined;
  const map: Record<string, ClinicParticipantStatus> = {
    NO_SHOW: "no_show",
    DONE: "attended",
    CANCELED: "cancelled",
    BOOKED: "booked",
    no_show: "no_show",
    attended: "attended",
    cancelled: "cancelled",
    booked: "booked",
  };
  return map[v];
}

function rangeFromMode(baseISO: string, mode: "day" | "week" | "month") {
  const d = dayjs(baseISO);
  if (mode === "day")
    return { from: d.format("YYYY-MM-DD"), to: d.format("YYYY-MM-DD") };
  if (mode === "week") {
    const start = d.startOf("week").add(1, "day");
    return {
      from: start.format("YYYY-MM-DD"),
      to: start.add(6, "day").format("YYYY-MM-DD"),
    };
  }
  return {
    from: d.startOf("month").format("YYYY-MM-DD"),
    to: d.endOf("month").format("YYYY-MM-DD"),
  };
}

export default function ClinicOperationsPage() {
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const clinicStatus = normalizeClinicStatusParam(sp.get("status"));
  const [baseDate, setBaseDate] = useState(() => todayISO());
  const [mode, setMode] = useState<"day" | "week" | "month">("day");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  /** 삭제 확인 모달: { id, label } 이면 표시 */
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; label: string } | null>(null);

  const range = useMemo(() => rangeFromMode(baseDate, mode), [baseDate, mode]);
  const participants = useClinicParticipants({
    session: selectedSessionId ?? undefined,
    session_date_from: range.from,
    session_date_to: range.to,
    status: clinicStatus,
  });

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

  return (
    <div className="clinic-page">
      <div className="clinic-three-panel">
        <aside className="clinic-three-panel__cell clinic-three-panel__cell--fixed hidden lg:block w-[320px]">
          <OperationsSessionTree
            sessions={treeQ.data ?? []}
            selectedDay={baseDate}
            year={ym.year}
            month={ym.month}
            todayISO={todayISO()}
            onPrevMonth={() => {
              const d = dayjs(baseDate).subtract(1, "month");
              setBaseDate(d.startOf("month").format("YYYY-MM-DD"));
              setMode("day");
              setSelectedSessionId(null);
            }}
            onNextMonth={() => {
              const d = dayjs(baseDate).add(1, "month");
              setBaseDate(d.startOf("month").format("YYYY-MM-DD"));
              setMode("day");
              setSelectedSessionId(null);
            }}
            onSelectDay={(date) => {
              setBaseDate(date);
              setMode("day");
              setSelectedSessionId(null);
            }}
          />
        </aside>
        <div className="clinic-three-panel__cell clinic-three-panel__cell--fixed w-full lg:w-[360px]">
          <ClinicDaySchedulePanel
            date={baseDate}
            sessionsForDay={(treeQ.data ?? []).filter(
              (s) => dayjs(s.date).format("YYYY-MM-DD") === baseDate
            )}
            rows={participants.listQ.data ?? []}
            onDeleteSession={(id, label) => setDeleteConfirm({ id, label })}
          />
        </div>
        <div className="clinic-three-panel__cell clinic-three-panel__cell--fill">
          <ClinicCreatePanel
            date={baseDate}
            onCreated={(createdDate) => {
              if (createdDate) {
                setBaseDate(createdDate);
                setMode("day");
                setSelectedSessionId(null);
              }
            }}
          />
        </div>
      </div>

      {/* 클리닉 삭제 확인 모달 */}
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
            <h2 id="clinic-delete-title" className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              클리닉 삭제
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-1">
              <strong>「{deleteConfirm.label}」</strong> 클리닉을 정말로 삭제하시겠습니까?
            </p>
            <p className="text-sm text-[var(--color-status-danger)] font-medium mb-4">
              주의: 삭제된 클리닉과 예약·출석 정보는 복구할 수 없습니다.
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
