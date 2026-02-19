// PATH: src/features/clinic/pages/OperationsPage/ClinicOperationsPage.tsx
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";

import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicParticipantStatus } from "../../api/clinicParticipants.api";

import {
  fetchClinicSessionTree,
  type ClinicSessionTreeNode,
} from "../../api/clinicSessions.api";

import OperationsSessionTree from "../../components/OperationsSessionTree";
import ClinicDaySchedulePanel from "../../components/ClinicDaySchedulePanel";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import ClinicRemoteControl from "../../components/ClinicRemoteControl";
import ClinicRemoteControl from "../../components/ClinicRemoteControl";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeClinicStatusParam(
  v: string | null
): ClinicParticipantStatus | undefined {
  if (!v) return undefined;
  if (v === "NO_SHOW") return "no_show";
  if (v === "DONE") return "attended";
  if (v === "CANCELED") return "cancelled";
  if (v === "BOOKED") return "booked";
  if (
    v === "no_show" ||
    v === "attended" ||
    v === "cancelled" ||
    v === "booked"
  ) {
    return v;
  }
  return undefined;
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
    <div className="flex gap-4">
      {/* 좌측: 날짜 트리 */}
      <div className="hidden lg:block">
        <OperationsSessionTree
          sessions={treeQ.data ?? []}
          selectedDay={baseDate}
          year={ym.year}
          month={ym.month}
          onSelectDay={(date) => {
            setBaseDate(date);
            setMode("day");
            setSelectedSessionId(null);
          }}
          onClear={() => setSelectedSessionId(null)}
        />
      </div>

      {/* 중간: 일정(참가자 기준) */}
      <div className="w-[360px] shrink-0">
        <ClinicDaySchedulePanel date={baseDate} rows={participants.listQ.data ?? []} />
      </div>

      {/* 우측: 생성 패널 + 리모컨 */}
      <div className="flex-1 space-y-4">
        <ClinicRemoteControl />
        <ClinicCreatePanel date={baseDate} />
      </div>
    </div>
  );
}
