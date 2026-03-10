/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicOperationsConsolePage.tsx
 * 클리닉 운영 콘솔 — 좌: 달력 + 해당일 클리닉 수업 목록 | 우: 해당 수업 대상자 관리 워크스페이스
 * SSOT: PanelWithTreeLayout (메시지 자동발송과 동일)
 */

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, FileQuestion, BookOpen, User } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { fetchClinicSessionTree } from "../../api/clinicSessions.api";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import OperationsSessionTree from "../../components/OperationsSessionTree";
import ClinicConsoleWorkspace from "./ClinicConsoleWorkspace";

dayjs.locale("ko");

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

export default function ClinicOperationsConsolePage() {
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

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

  return (
    <div className="clinic-page">
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>운영 콘솔</h2>
          <p className={panelStyles.headerDesc}>
            날짜와 클리닉 수업을 선택하면 해당 수업의 대상자를 한 화면에서 관리할 수 있습니다.
            시험 불합·과제 불합 등 사유별로 재시험 연결, 점수 갱신을 진행하세요.
          </p>
        </div>

        <div className={panelStyles.body}>
          <aside className={panelStyles.tree}>
            <div className={panelStyles.treeNavHeader}>
              <span className={panelStyles.treeNavTitle}>일정</span>
            </div>
            <div className={panelStyles.treeScroll}>
              <OperationsSessionTree
                sessions={treeQ.data ?? []}
                selectedDay={selectedDate}
                year={ym.year}
                month={ym.month}
                todayISO={todayISO()}
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
              />
            </div>
            <div className={panelStyles.treeNavHeader} style={{ borderTop: "1px solid var(--color-border-divider)" }}>
              <span className={panelStyles.treeNavTitle}>클리닉 수업</span>
            </div>
            <div className={panelStyles.treeScroll}>
              {treeQ.isLoading ? (
                <p className="clinic-empty-state__text" style={{ padding: "var(--space-4)", fontSize: 13 }}>
                  불러오는 중…
                </p>
              ) : sessionsForDay.length === 0 ? (
                <p className="clinic-empty-state__text" style={{ padding: "var(--space-4)", fontSize: 13 }}>
                  {selectedDate === todayISO() ? "오늘 일정이 없습니다." : "해당 날짜에 클리닉이 없습니다."}
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: "var(--space-2) 0" }}>
                  {sessionsForDay.map((s) => {
                    const time = (s.start_time || "").slice(0, 5) || "—";
                    const isActive = selectedSessionId === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedSessionId(s.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "var(--space-2) var(--space-4)",
                            border: "none",
                            borderRadius: 0,
                            background: isActive
                              ? "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-surface))"
                              : "transparent",
                            color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                            fontWeight: isActive ? 600 : 500,
                            fontSize: 13,
                            textAlign: "left",
                            cursor: "pointer",
                            borderLeft: `3px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
                          }}
                        >
                          <Clock size={14} aria-hidden />
                          <span>{time}</span>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.location || "—"}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                            {s.booked_count ?? 0}명
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <div className={panelStyles.content}>
            <div className={panelStyles.contentInner}>
              {!selectedSessionId ? (
                <div className={panelStyles.placeholder}>
                  좌측에서 날짜를 선택한 뒤, 해당 날짜의 클리닉 수업을 선택하세요.
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
