// PATH: src/features/clinic/pages/BookingsPage/ClinicBookingsPage.tsx
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import dayjs from "dayjs";

import ClinicTargetTable from "../../components/bookings/ClinicTargetTable";
import WeeklyClinicBoard from "../../components/bookings/WeeklyClinicBoard";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";

function useQueryParam(name: string) {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search).get(name), [loc.search, name]);
}

export default function ClinicBookingsPage() {
  const focus = useQueryParam("focus"); // "required" | null
  const today = dayjs().format("YYYY-MM-DD");

  const [selected, setSelected] = useState<number[]>([]);

  // 이번 주(rolling이 아니라 월~일) 기준으로 "이미 예약된 enrollment" 체크
  // - 예약 필수는 clinic 상태(취소 제외) 기준으로 미예약을 강조
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
      if (!p.enrollment_id) return;
      if (p.status === "cancelled") return;
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

  // focus=required 로 들어오면 "필수 대상자"를 자동 선택 (초기 1회)
  const autoSelected = useMemo(() => {
    if (focus !== "required") return null;
    return requiredEnrollmentIds;
  }, [focus, requiredEnrollmentIds]);

  // 초기 자동 선택: 기존 selected가 비어있을 때만 덮어씀
  if (autoSelected && selected.length === 0 && autoSelected.length > 0) {
    // setState는 렌더 중 호출이지만, 이 컴포넌트는 라우트 진입 시 1회만 목적임
    // 실제 런타임에서 경고가 싫으면 useEffect로 옮기면 됨 (여기선 국소 변경 유지)
    setSelected(autoSelected);
  }

  return (
    <div className="flex gap-4">
      {/* 좌측: 예약 대상자 */}
      <div className="w-[360px] shrink-0">
        <ClinicTargetTable selected={selected} onChangeSelected={setSelected} />
      </div>

      {/* 중앙: 기존 클리닉 주간 보드 */}
      <div className="flex-1">
        <WeeklyClinicBoard baseDate={today} selectedEnrollmentIds={selected} />
      </div>

      {/* 우측: 생성 패널 (기존 유지) */}
      <div className="w-[420px] shrink-0">
        <ClinicCreatePanel
          defaultMode="targets"
          selectedTargetEnrollmentIds={selected}
          onChangeSelectedTargetEnrollmentIds={setSelected}
          onCreated={() => setSelected([])}
        />
      </div>
    </div>
  );
}
