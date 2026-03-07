// PATH: src/features/clinic/pages/BookingsPage/ClinicBookingsPage.tsx
// 예약대상자 — 섹션형 SSOT, 3열(대상자 | 주간보드 | 생성)

import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import dayjs from "dayjs";
import ClinicTargetTable from "../../components/bookings/ClinicTargetTable";
import WeeklyClinicBoard from "../../components/bookings/WeeklyClinicBoard";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";

function useQueryParam(name: string) {
  const loc = useLocation();
  return useMemo(
    () => new URLSearchParams(loc.search).get(name),
    [loc.search, name]
  );
}

export default function ClinicBookingsPage() {
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
        <div className="clinic-three-panel__cell clinic-three-panel__cell--fixed w-full lg:w-[360px]">
          <ClinicTargetTable selected={selected} onChangeSelected={setSelected} />
        </div>
        <div className="clinic-three-panel__cell clinic-three-panel__cell--fill">
          <WeeklyClinicBoard baseDate={today} selectedEnrollmentIds={selected} />
        </div>
        <div className="clinic-three-panel__cell clinic-three-panel__cell--fixed w-full lg:w-[420px]">
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
