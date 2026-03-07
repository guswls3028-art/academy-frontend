// PATH: src/features/clinic/pages/OperationsPage/ClinicOperationsPage.tsx
// 운영 — 섹션형 SSOT, 3열(날짜 트리 | 일정 | 생성)

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicParticipantStatus } from "../../api/clinicParticipants.api";
import { fetchClinicSessionTree } from "../../api/clinicSessions.api";
import OperationsSessionTree from "../../components/OperationsSessionTree";
import ClinicDaySchedulePanel from "../../components/ClinicDaySchedulePanel";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";

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
  const [sp] = useSearchParams();
  const clinicStatus = normalizeClinicStatusParam(sp.get("status"));
  const [baseDate, setBaseDate] = useState(() => todayISO());
  const [mode, setMode] = useState<"day" | "week" | "month">("day");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

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
            onToday={() => {
              setBaseDate(todayISO());
              setMode("day");
              setSelectedSessionId(null);
            }}
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
    </div>
  );
}
