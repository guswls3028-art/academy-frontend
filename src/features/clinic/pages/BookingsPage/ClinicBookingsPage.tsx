// PATH: src/features/clinic/pages/BookingsPage/ClinicBookingsPage.tsx
// 예약대상자 — 단일 컬럼 워크플로우: 승인대기(접이식) → 대상자 테이블 → 클리닉 만들기(모달)
// Phase 8: 선택 인원 표시, 미예약 전체선택, 미예약 우선 정렬

import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

import ClinicTargetTable from "../../components/bookings/ClinicTargetTable";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import { patchClinicParticipantStatus } from "../../api/clinicParticipants.api";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { AdminModal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

function useQueryParam(name: string) {
  const loc = useLocation();
  return useMemo(
    () => new URLSearchParams(loc.search).get(name),
    [loc.search, name]
  );
}

export default function ClinicBookingsPage() {
  const qc = useQueryClient();
  const focus = useQueryParam("focus");
  const today = dayjs().format("YYYY-MM-DD");
  const [selected, setSelected] = useState<number[]>([]);
  const didAutoSelect = useRef(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const wk = useMemo(() => {
    const d = dayjs(today);
    const start = d.startOf("week").add(1, "day");
    const end = start.add(6, "day");
    return { from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") };
  }, [today]);

  const targetsQ = useClinicTargets();
  const weekP = useClinicParticipants({
    session_date_from: wk.from,
    session_date_to: wk.to,
  });
  const pendingQ = useClinicParticipants({ status: "pending" });

  const pendingList: ClinicParticipant[] = pendingQ.listQ.data ?? [];

  const patchStatusM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "booked" | "rejected" }) =>
      patchClinicParticipantStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      feedback.error("처리에 실패했습니다. 다시 시도해 주세요.");
    },
  });

  const bookedEnrollmentIds = useMemo(() => {
    const set = new Set<number>();
    (weekP.listQ.data ?? []).forEach((p) => {
      if (!p.enrollment_id || p.status === "cancelled") return;
      set.add(p.enrollment_id);
    });
    return set;
  }, [weekP.listQ.data]);

  const requiredEnrollmentIds = useMemo(() => {
    const targets = targetsQ.data ?? [];
    return targets
      .filter((t) => !bookedEnrollmentIds.has(t.enrollment_id))
      .map((t) => t.enrollment_id);
  }, [targetsQ.data, bookedEnrollmentIds]);

  useEffect(() => {
    if (focus !== "required" || didAutoSelect.current) return;
    if (requiredEnrollmentIds.length > 0) {
      setSelected(requiredEnrollmentIds);
      didAutoSelect.current = true;
    }
  }, [focus, requiredEnrollmentIds]);

  // Pending approvals section: expanded when items exist
  const [pendingOpen, setPendingOpen] = useState(true);
  useEffect(() => {
    if (pendingList.length === 0) setPendingOpen(false);
    else setPendingOpen(true);
  }, [pendingList.length]);

  const totalTargets = targetsQ.data?.length ?? 0;
  const unbookedCount = requiredEnrollmentIds.length;

  // Phase 8: 미예약 전체 선택
  const selectAllUnbooked = () => {
    const current = new Set(selected);
    requiredEnrollmentIds.forEach((enrollmentId) => current.add(enrollmentId));
    setSelected(Array.from(current));
  };

  // Phase 8: 선택 인원 표시 텍스트
  const createBtnLabel = selected.length > 0
    ? `선택한 ${selected.length}명으로 클리닉 만들기`
    : "학생을 선택하세요";

  return (
    <div className="clinic-page">
      <div className="clinic-bookings">
        {/* Toolbar */}
        <div className="clinic-bookings__toolbar">
          <div className="clinic-bookings__toolbar-info">
            <span className="clinic-bookings__toolbar-stat">
              이번 주 대상자 <strong>{totalTargets}</strong>명
            </span>
            <span className="clinic-bookings__toolbar-divider" aria-hidden />
            <span className={`clinic-bookings__toolbar-stat ${unbookedCount > 0 ? "clinic-bookings__toolbar-stat--alert" : ""}`}>
              미예약 <strong>{unbookedCount}</strong>명
            </span>
            {/* Phase 8: 미예약 전체 선택 버튼 */}
            {unbookedCount > 0 && (
              <>
                <span className="clinic-bookings__toolbar-divider" aria-hidden />
                <button
                  type="button"
                  className="clinic-bookings__select-unbooked-btn"
                  onClick={selectAllUnbooked}
                >
                  미예약 학생 전체 선택
                </button>
              </>
            )}
            {selected.length > 0 && (
              <>
                <span className="clinic-bookings__toolbar-divider" aria-hidden />
                <button
                  type="button"
                  className="clinic-bookings__deselect-btn"
                  onClick={() => setSelected([])}
                >
                  전체 해제
                </button>
              </>
            )}
          </div>
          <div className="clinic-bookings__toolbar-actions">
            <Button
              intent="primary"
              size="md"
              onClick={() => setCreateModalOpen(true)}
              disabled={selected.length === 0}
            >
              <Plus size={16} />
              {createBtnLabel}
            </Button>
          </div>
        </div>

        {/* Pending approvals — only shown when items exist */}
        {pendingList.length > 0 && (
          <div className="clinic-bookings__pending">
            <button
              type="button"
              className="clinic-bookings__pending-header"
              onClick={() => setPendingOpen((v) => !v)}
            >
              <span className="clinic-bookings__pending-toggle">
                {pendingOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <span className="clinic-bookings__pending-title">
                승인 대기
              </span>
              <span className="clinic-bookings__pending-badge">
                {pendingList.length}건
              </span>
            </button>

            {pendingOpen && (
              <div className="clinic-bookings__pending-body">
                {pendingQ.listQ.isLoading ? (
                  <div className="ds-section__empty py-6">불러오는 중…</div>
                ) : (
                  <ul className="clinic-bookings__pending-list">
                    {pendingList.map((p) => (
                      <li key={p.id} className="clinic-bookings__pending-item">
                        <div className="clinic-bookings__pending-item-info">
                          <span className="clinic-bookings__pending-item-name">
                            {p.student_name}
                          </span>
                          <span className="clinic-bookings__pending-item-meta">
                            {p.session_date ?? "-"}{" "}
                            {p.session_start_time?.slice(0, 5) ?? ""}{" "}
                            {p.session_location ?? "-"}
                          </span>
                        </div>
                        <div className="clinic-bookings__pending-actions">
                          <button
                            type="button"
                            onClick={() => patchStatusM.mutate({ id: p.id, status: "booked" })}
                            disabled={patchStatusM.isPending}
                            className="clinic-bookings__action-btn clinic-bookings__action-btn--approve"
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            onClick={() => patchStatusM.mutate({ id: p.id, status: "rejected" })}
                            disabled={patchStatusM.isPending}
                            className="clinic-bookings__action-btn clinic-bookings__action-btn--reject"
                          >
                            거절
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section divider between approval and target table */}
        <div className="clinic-bookings__section-divider" />

        {/* Target table — Phase 8: pass unbooked IDs for sorting */}
        <ClinicTargetTable
          selected={selected}
          onChangeSelected={setSelected}
          bookedEnrollmentIds={bookedEnrollmentIds}
          unbookedEnrollmentIds={requiredEnrollmentIds}
        />
      </div>

      {/* Floating selection bar */}
      {selected.length > 0 && (
        <div className="clinic-bookings__floating-bar">
          <span className="clinic-bookings__floating-bar-text">
            {selected.length}명 선택됨
          </span>
          <button
            type="button"
            className="clinic-bookings__floating-bar-btn"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={14} />
            클리닉 만들기
          </button>
        </div>
      )}

      {/* Create clinic modal */}
      <AdminModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        width={560}
      >
        <ClinicCreatePanel
          asModal
          defaultMode="targets"
          selectedTargetEnrollmentIds={selected}
          onChangeSelectedTargetEnrollmentIds={setSelected}
          onCreated={() => {
            setSelected([]);
            setCreateModalOpen(false);
          }}
        />
      </AdminModal>
    </div>
  );
}
