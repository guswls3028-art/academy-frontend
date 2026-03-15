/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicOperationsConsolePage.tsx
 * 클리닉 진행 — 좌: 달력 + 해당일 클리닉 수업 목록 | 우: 해당 수업 대상자 관리 워크스페이스
 * SSOT: PanelWithTreeLayout (메시지 자동발송과 동일)
 */

import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { fetchClinicSessionTree } from "../../api/clinicSessions.api";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import ClinicConsoleSidebar from "./ClinicConsoleSidebar";
import ClinicConsoleWorkspace from "./ClinicConsoleWorkspace";

dayjs.locale("ko");

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

export default function ClinicOperationsConsolePage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const dateParam = sp.get("date");
  const initialDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();
  const [selectedDate, setSelectedDate] = useState(() => initialDate);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // URL date 쿼리와 동기화 (다른 화면에서 날짜와 함께 진입 시)
  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) setSelectedDate(dateParam);
  }, [dateParam]);

  const ym = useMemo(() => {
    const d = dayjs(selectedDate);
    return { year: d.year(), month: d.month() + 1 };
  }, [selectedDate]);

  const treeQ = useQuery({
    queryKey: ["clinic-sessions-tree", ym.year, ym.month],
    queryFn: () => fetchClinicSessionTree({ year: ym.year, month: ym.month }),
    retry: 0,
  });

  const sessionsForDay = useMemo(() => {
    const list = treeQ.data ?? [];
    return list.filter(
      (s) => dayjs(s.date).format("YYYY-MM-DD") === selectedDate
    ) as ClinicSessionTreeNode[];
  }, [treeQ.data, selectedDate]);

  const participants = useClinicParticipants({
    session: selectedSessionId ?? undefined,
    session_date_from: selectedDate,
    session_date_to: selectedDate,
  });

  const rows = (participants.listQ.data ?? []) as ClinicParticipant[];

  // Phase 2: 오늘 날짜일 때 세션 자동 선택 — URL session param 우선, 없으면 첫 번째
  const sessionParam = sp.get("session");
  useEffect(() => {
    if (!selectedSessionId && sessionsForDay.length > 0) {
      const targetId = sessionParam ? Number(sessionParam) : null;
      const match = targetId ? sessionsForDay.find((s) => s.id === targetId) : null;
      setSelectedSessionId(match?.id ?? sessionsForDay[0].id);
    }
  }, [sessionsForDay, selectedSessionId, sessionParam]);

  const headerDesc = "출석 확인하고 학생 관리하세요.";

  return (
    <div className="clinic-page">
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>클리닉 진행</h2>
          <p className={panelStyles.headerDesc}>{headerDesc}</p>
        </div>

        <div className={panelStyles.body}>
          <aside className={panelStyles.tree}>
            <div className={panelStyles.treeNavHeader}>
              <span className={panelStyles.treeNavTitle}>일정</span>
            </div>
            <div className={panelStyles.treeScroll}>
              <ClinicConsoleSidebar
                sessions={treeQ.data ?? []}
                selectedDay={selectedDate}
                todayISO={todayISO()}
                year={ym.year}
                month={ym.month}
                onSelectDay={(date) => {
                  setSelectedDate(date);
                  setSelectedSessionId(null);
                }}
                onPrevMonth={() => {
                  const d = dayjs(selectedDate).subtract(1, "month");
                  setSelectedDate(d.startOf("month").format("YYYY-MM-DD"));
                  setSelectedSessionId(null);
                }}
                onNextMonth={() => {
                  const d = dayjs(selectedDate).add(1, "month");
                  setSelectedDate(d.startOf("month").format("YYYY-MM-DD"));
                  setSelectedSessionId(null);
                }}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
              />
            </div>
          </aside>

          <div className={panelStyles.content}>
            <div className={panelStyles.contentInner}>
              {!selectedSessionId ? (
                <div className="clinic-console__empty-workspace">
                  {sessionsForDay.length === 0 ? (
                    <>
                      <p className="clinic-console__empty-text">
                        {dayjs(selectedDate).format("M월 D일")}에는 예정된 클리닉이 없습니다.
                      </p>
                      <button
                        type="button"
                        className="clinic-console__empty-cta"
                        onClick={() => navigate("/admin/clinic/schedule")}
                      >
                        <CalendarPlus size={16} aria-hidden />
                        일정 관리에서 만들기
                      </button>
                    </>
                  ) : (
                    <p className="clinic-console__empty-text">
                      좌측에서 클리닉 수업을 선택하세요.
                    </p>
                  )}
                </div>
              ) : (
                <ClinicConsoleWorkspace
                  selectedDate={selectedDate}
                  session={sessionsForDay.find((s) => s.id === selectedSessionId) ?? null}
                  participants={rows}
                  isLoading={participants.listQ.isLoading}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
