// PATH: src/features/clinic/pages/BookingsPage/ClinicBookingsPage.tsx
// 예약대상자 — 3단 패널(예약신청자 | 예약대상자 | 클리닉생성). 운영 탭·클리닉 생성과 동일 패널 디자인.

import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ClinicTargetTable from "../../components/bookings/ClinicTargetTable";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import { patchClinicParticipantStatus } from "../../api/clinicParticipants.api";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";

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
  const hasPending = pendingList.length > 0;

  const patchStatusM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "booked" | "rejected" }) =>
      patchClinicParticipantStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
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

  return (
    <div className="clinic-page">
      <div className="clinic-three-panel">
        {/* 1단: 예약 신청 (승인 대기) — 클리닉 생성과 동일 헤더/카드 톤 */}
        <div className="clinic-three-panel__cell clinic-three-panel__cell--fixed w-full lg:w-[320px]">
          <div className="ds-card-modal clinic-panel h-full flex flex-col overflow-hidden">
            <div className="ds-card-modal__header flex items-center justify-between">
              <div className="ds-card-modal__accent" aria-hidden />
              <div className="ds-card-modal__header-inner">
                <h2 className="ds-card-modal__header-title">예약 신청 (승인 대기)</h2>
                <p className="ds-card-modal__header-description">대기 중인 신청</p>
              </div>
              <div className="ds-card-modal__header-right">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  {pendingList.length}건
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto border-t border-[var(--color-border-divider)] ds-card-modal__body">
              {pendingQ.listQ.isLoading ? (
                <div className="ds-section__empty py-10">불러오는 중…</div>
              ) : pendingList.length === 0 ? (
                <div className="ds-section__empty py-10">대기 중인 신청이 없습니다.</div>
              ) : (
                <ul className="divide-y divide-[var(--color-border-divider)]">
                  {pendingList.map((p) => (
                    <li
                      key={p.id}
                      className="ds-section__item flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="ds-section__item-label truncate">{p.student_name}</div>
                        <div className="ds-section__item-meta">
                          {p.session_date ?? "-"} {p.session_start_time?.slice(0, 5) ?? ""} · {p.session_location ?? "-"}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => patchStatusM.mutate({ id: p.id, status: "booked" })}
                          disabled={patchStatusM.isPending}
                          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--color-success)] text-white hover:opacity-90 transition-opacity"
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => patchStatusM.mutate({ id: p.id, status: "rejected" })}
                          disabled={patchStatusM.isPending}
                          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity"
                        >
                          거절
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* 2단: 예약대상자 — 1단과 동일 너비·동일 카드/헤더 톤 */}
        <div className="clinic-three-panel__cell clinic-three-panel__cell--fixed w-full lg:w-[320px]">
          <ClinicTargetTable selected={selected} onChangeSelected={setSelected} />
        </div>

        {/* 3단: 클리닉생성 */}
        <div className="clinic-three-panel__cell clinic-three-panel__cell--fill">
          <ClinicCreatePanel
            defaultMode="targets"
            selectedTargetEnrollmentIds={selected}
            onChangeSelectedTargetEnrollmentIds={setSelected}
            onCreated={() => setSelected([])}
          />
        </div>
      </div>
    </div>
  );
}
