/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicOperationsConsolePage.tsx
 * 클리닉 진행 — 좌: 달력 + 해당일 클리닉 수업 목록 | 우: 해당 수업 대상자 관리 워크스페이스
 * SSOT: PanelWithTreeLayout (메시지 자동발송과 동일)
 */

import { useCallback, useMemo, useState, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { CalendarDays, Clock3, X } from "lucide-react";
import { fetchClinicSessionTree, deleteClinicSession } from "../../api/clinicSessions.api";
import type { ClinicSessionDetail } from "../../api/clinicSessions.api";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import ClinicConsoleSidebar from "./ClinicConsoleSidebar";
import ClinicConsoleWorkspace from "./ClinicConsoleWorkspace";
import ClinicCreatePanel, { type ClinicSessionUpdateNotice } from "../../components/ClinicCreatePanel";
import { readClinicChangeNoticeNavigationState } from "../../components/clinicChangeNoticeNavigation";
import PreviousWeekImportModal from "../../components/PreviousWeekImportModal";
import AdminModal from "@/shared/ui/modal/AdminModal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { clinicQueryKeys } from "../../queryKeys";

dayjs.locale("ko");

const WIDE_CONTENT_STYLE: CSSProperties = { maxWidth: "none" };

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

type ConsoleScope = "onsite" | "day";

function participantStudentKey(participant: ClinicParticipant): string {
  return Number.isInteger(participant.student) && participant.student > 0
    ? `student:${participant.student}`
    : `participant:${participant.id}`;
}

export default function ClinicOperationsConsolePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const dateParam = sp.get("date");
  const sessionParam = sp.get("session");
  const initialToday = todayISO();
  const initialDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : initialToday;
  const [selectedDate, setSelectedDate] = useState(() => initialDate);
  const [consoleScope, setConsoleScope] = useState<ConsoleScope>(() =>
    sp.get("scope") === "onsite" ? "onsite" : "day"
  );
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(() => {
    const value = sessionParam ? Number(sessionParam) : NaN;
    return Number.isInteger(value) && value > 0 ? value : null;
  });

  const { sectionMode, clinicMode } = useSectionMode();
  const showSectionFilter = sectionMode && clinicMode === "regular";
  const [sectionFilter, setSectionFilter] = useState<number | "unassigned" | null>(null);

  // 모달 상태
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<ClinicSessionDetail | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; label: string } | null>(null);
  const [changeNoticeDraft, setChangeNoticeDraft] = useState<ClinicSessionUpdateNotice | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    const notice = readClinicChangeNoticeNavigationState(location.state);
    if (!notice) return;
    setChangeNoticeDraft(notice);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);
  const selectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectorPanelRef = useRef<HTMLElement | null>(null);
  const selectorHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const closeSelector = useCallback((restoreFocus = true) => {
    setSelectorOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => selectorTriggerRef.current?.focus());
    }
  }, []);

  const selectConsoleDate = useCallback((date: string) => {
    setSelectedDate(date);
    setConsoleScope("day");
    setSelectedSessionId(null);
    const next = new URLSearchParams(sp);
    next.set("scope", "day");
    next.set("date", date);
    next.delete("session");
    setSp(next, { replace: true });
  }, [setSp, sp]);

  const selectConsoleSession = useCallback((sessionId: number) => {
    setConsoleScope("day");
    setSelectedSessionId(sessionId);
    const next = new URLSearchParams(sp);
    next.set("scope", "day");
    next.set("date", selectedDate);
    next.set("session", String(sessionId));
    setSp(next, { replace: true });
  }, [selectedDate, setSp, sp]);

  useEffect(() => {
    if (!selectorOpen) return;
    selectorHeadingRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSelector();
        return;
      }
      if (event.key !== "Tab" || !selectorPanelRef.current) return;
      const focusable = Array.from(selectorPanelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === selectorHeadingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeSelector, selectorOpen]);

  // 삭제 뮤테이션
  const deleteSessionM = useMutation({
    mutationFn: (id: number) => deleteClinicSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree });
      qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsMonth });
      qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
      // 삭제된 세션이 현재 선택된 세션이면 선택 해제
      if (deleteConfirm && selectedSessionId === deleteConfirm.id) {
        setSelectedSessionId(null);
      }
      setDeleteConfirm(null);
      feedback.success("클리닉이 삭제되었습니다.");
    },
    onError: (e: Error) => {
      feedback.error(e.message || "삭제에 실패했습니다.");
    },
  });

  const handleEditSession = async (sessionId: number) => {
    try {
      const res = await api.get(`/clinic/sessions/${sessionId}/`);
      setEditSession(res.data);
      setEditModalOpen(true);
    } catch {
      feedback.error("세션 정보를 불러올 수 없습니다.");
    }
  };

  const handleDeleteSession = (sessionId: number, label: string) => {
    setDeleteConfirm({ id: sessionId, label });
  };

  // URL date 쿼리와 동기화 (다른 화면에서 날짜와 함께 진입 시)
  useEffect(() => {
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    setSelectedDate(dateParam);
    setConsoleScope("day");
    const value = sessionParam ? Number(sessionParam) : NaN;
    setSelectedSessionId(Number.isInteger(value) && value > 0 ? value : null);
  }, [dateParam, sessionParam]);

  const ym = useMemo(() => {
    const d = dayjs(selectedDate);
    return { year: d.year(), month: d.month() + 1 };
  }, [selectedDate]);

  const treeQ = useQuery({
    queryKey: clinicQueryKeys.sessionsTreeByMonth(ym.year, ym.month),
    queryFn: () => fetchClinicSessionTree({ year: ym.year, month: ym.month }),
    retry: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  /** 반 필터 적용된 트리 (사이드바 표시용, 클라이언트 필터) */
  const filteredTree = useMemo(() => {
    const list = treeQ.data ?? [];
    if (!showSectionFilter || sectionFilter === null) return list;
    if (sectionFilter === "unassigned") {
      return list.filter((s) => s.section == null);
    }
    return list.filter((s) => s.section === sectionFilter);
  }, [treeQ.data, showSectionFilter, sectionFilter]);

  /** 필터 옵션용 — 전체 트리에서 파생 (필터가 걸려도 옵션 리스트는 유지) */
  const sectionOptionsAll = useMemo(() => {
    const list = treeQ.data ?? [];
    const seen = new Map<number, string>();
    let hasUnassigned = false;
    for (const s of list) {
      if (s.section != null && s.section_label) {
        if (!seen.has(s.section)) seen.set(s.section, s.section_label);
      } else {
        hasUnassigned = true;
      }
    }
    const options: Array<{ value: number | "unassigned"; label: string }> = Array.from(
      seen.entries(),
    )
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]) => ({ value: id, label: `${label}반` }));
    if (hasUnassigned) options.push({ value: "unassigned", label: "미지정" });
    return options;
  }, [treeQ.data]);

  const sessionsForDay = useMemo(() => {
    const list = filteredTree;
    return list.filter(
      (s) => dayjs(s.date).format("YYYY-MM-DD") === selectedDate
    );
  }, [filteredTree, selectedDate]);

  const activeSession = useMemo(
    () => selectedSessionId == null
      ? null
      : sessionsForDay.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessionsForDay],
  );

  const queryDate = consoleScope === "onsite" ? todayISO() : selectedDate;
  const participants = useClinicParticipants(
    consoleScope === "onsite"
      ? { onsite_date: queryDate }
      : { session_date_from: queryDate, session_date_to: queryDate },
  );

  const allRows = useMemo(
    () => (participants.listQ.data ?? []) as ClinicParticipant[],
    [participants.listQ.data],
  );
  const allStudentCount = useMemo(
    () => new Set(allRows.map(participantStudentKey)).size,
    [allRows],
  );
  const rows = useMemo(
    () => selectedSessionId == null
      ? allRows
      : allRows.filter((participant) => participant.session === selectedSessionId),
    [allRows, selectedSessionId],
  );

  const timeOptions = useMemo(() => {
    const grouped = new Map<number, { id: number; time: string; students: Set<string> }>();
    for (const participant of allRows) {
      const current = grouped.get(participant.session);
      if (current) {
        current.students.add(participantStudentKey(participant));
      } else {
        grouped.set(participant.session, {
          id: participant.session,
          time: participant.session_start_time?.slice(0, 5) || "시간 미정",
          students: new Set([participantStudentKey(participant)]),
        });
      }
    }
    return [...grouped.values()].map((option) => ({
      id: option.id,
      time: option.time,
      count: option.students.size,
    })).sort((a, b) =>
      a.time.localeCompare(b.time) || a.id - b.id
    );
  }, [allRows]);

  useEffect(() => {
    if (
      selectedSessionId != null &&
      !treeQ.isLoading &&
      activeSession == null
    ) {
      setSelectedSessionId(null);
    }
  }, [activeSession, selectedSessionId, treeQ.isLoading]);

  const headerDesc = "오늘 예약·배정 학생의 출석과 미통과 처리를 한 흐름에서 진행합니다.";

  return (
    <div className="clinic-page">
      <div className={`${panelStyles.root} clinic-operations-shell`}>
        <div className={`${panelStyles.header} clinic-operations-shell__header`}>
          <h2 className={panelStyles.headerTitle}>클리닉 진행</h2>
          <p className={panelStyles.headerDesc}>{headerDesc}</p>
        </div>

        <div className={`${panelStyles.body} clinic-operations-shell__body`}>
          <div className={`${panelStyles.content} clinic-operations-shell__content`}>
            <div className={panelStyles.contentInner} style={WIDE_CONTENT_STYLE}>
              <div className="clinic-console__live-controls">
                <div className="clinic-console__schedule-bar">
                  <button
                    ref={selectorTriggerRef}
                    type="button"
                    className="clinic-console__schedule-trigger"
                    aria-expanded={selectorOpen}
                    aria-controls="clinic-console-schedule-overlay"
                    onClick={() => setSelectorOpen(true)}
                  >
                    <CalendarDays size={16} aria-hidden />
                    <span>일정</span>
                    <strong>
                      {consoleScope === "onsite"
                        ? "오늘 현장"
                        : `${dayjs(selectedDate).format("M월 D일")} ${selectedSessionId == null ? "전체" : activeSession?.start_time?.slice(0, 5) || "시간대"}`}
                    </strong>
                  </button>
                  <span className="clinic-console__schedule-hint">달력과 수업은 필요할 때 열고, 학생 작업대는 그대로 유지됩니다.</span>
                </div>
                <div
                  className="clinic-console__scope-rail"
                  role="group"
                  aria-label="클리닉 운영 범위"
                >
                  <button
                    type="button"
                    className={`clinic-console__scope-button ${consoleScope === "onsite" ? "clinic-console__scope-button--active" : ""}`}
                    aria-pressed={consoleScope === "onsite"}
                    onClick={() => {
                      setConsoleScope("onsite");
                      setSelectedDate(todayISO());
                      setSelectedSessionId(null);
                    }}
                  >
                    <span className="clinic-console__scope-live-dot" aria-hidden />
                    현장
                    {consoleScope === "onsite" && !participants.listQ.isLoading && !participants.listQ.isError && (
                      <strong>{allStudentCount}명</strong>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`clinic-console__scope-button ${consoleScope === "day" ? "clinic-console__scope-button--active" : ""}`}
                    aria-pressed={consoleScope === "day"}
                    onClick={() => {
                      setConsoleScope("day");
                      setSelectedDate(todayISO());
                      setSelectedSessionId(null);
                    }}
                  >
                    {selectedDate === todayISO() ? "오늘 전체" : "선택일 전체"}
                    {consoleScope === "day" && !participants.listQ.isLoading && !participants.listQ.isError && (
                      <strong>{allStudentCount}명</strong>
                    )}
                  </button>
                </div>

                {!participants.listQ.isLoading && !participants.listQ.isError && allRows.length > 0 && (
                  <div
                    className="clinic-console__time-rail"
                    role="group"
                    aria-label="시간대 필터"
                  >
                    <button
                      type="button"
                      className={`clinic-console__time-button ${selectedSessionId == null ? "clinic-console__time-button--active" : ""}`}
                      aria-pressed={selectedSessionId == null}
                      onClick={() => setSelectedSessionId(null)}
                    >
                      <Clock3 size={14} aria-hidden />
                      전체 시간 <strong>{allStudentCount}명</strong>
                    </button>
                    {timeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`clinic-console__time-button ${selectedSessionId === option.id ? "clinic-console__time-button--active" : ""}`}
                        aria-pressed={selectedSessionId === option.id}
                        onClick={() => setSelectedSessionId(option.id)}
                      >
                        {option.time} <strong>{option.count}명</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ClinicConsoleWorkspace
                selectedDate={queryDate}
                session={consoleScope === "day" ? activeSession : null}
                participants={rows}
                isLoading={participants.listQ.isLoading}
                isError={participants.listQ.isError}
                onRetry={() => participants.listQ.refetch()}
                workspaceMode={consoleScope}
                isAggregate={consoleScope === "onsite" || activeSession == null}
                onEditSession={handleEditSession}
                onDeleteSession={handleDeleteSession}
                changeNoticeDraft={changeNoticeDraft}
                onChangeNoticeConsumed={() => setChangeNoticeDraft(null)}
              />
            </div>
          </div>
        </div>
      </div>

      {selectorOpen && createPortal(
        <>
          <div className="clinic-console__selector-backdrop" aria-hidden onMouseDown={() => closeSelector()} />
          <section
            id="clinic-console-schedule-overlay"
            ref={selectorPanelRef}
            className="clinic-console__selector-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clinic-console-schedule-title"
          >
            <header className="clinic-console__selector-header">
              <div>
                <span>운영 문맥</span>
                <h2 id="clinic-console-schedule-title" ref={selectorHeadingRef} tabIndex={-1}>날짜·수업 선택</h2>
              </div>
              <button type="button" onClick={() => closeSelector()} aria-label="일정 닫기">
                <X size={18} aria-hidden />
              </button>
            </header>
            <div className="clinic-console__selector-scroll">
              <ClinicConsoleSidebar
                sessions={filteredTree}
                selectedDay={selectedDate}
                todayISO={todayISO()}
                year={ym.year}
                month={ym.month}
                onSelectDay={selectConsoleDate}
                onPrevMonth={() => {
                  const d = dayjs(selectedDate).subtract(1, "month");
                  selectConsoleDate(d.startOf("month").format("YYYY-MM-DD"));
                }}
                onNextMonth={() => {
                  const d = dayjs(selectedDate).add(1, "month");
                  selectConsoleDate(d.startOf("month").format("YYYY-MM-DD"));
                }}
                selectedSessionId={selectedSessionId}
                onSelectSession={(sessionId) => {
                  selectConsoleSession(sessionId);
                  closeSelector();
                }}
                onCreateClick={() => {
                  closeSelector(false);
                  setCreateModalOpen(true);
                }}
                onImportClick={() => {
                  closeSelector(false);
                  setImportModalOpen(true);
                }}
                onEditSession={(sessionId) => {
                  closeSelector(false);
                  void handleEditSession(sessionId);
                }}
                onDeleteSession={(sessionId, label) => {
                  closeSelector(false);
                  handleDeleteSession(sessionId, label);
                }}
                showSectionFilter={showSectionFilter}
                sectionFilter={sectionFilter}
                sectionFilterOptions={sectionOptionsAll}
                onSectionFilterChange={(value) => {
                  setSectionFilter(value);
                  setSelectedSessionId(null);
                }}
              />
            </div>
          </section>
        </>,
        document.body,
      )}

      {/* 생성 모달 */}
      <AdminModal
        open={createModalOpen}
        onClose={() => {
          if (createSaving) return;
          setCreateModalOpen(false);
        }}
        closeDisabled={createSaving}
        width={520}
      >
        <ClinicCreatePanel
          asModal
          date={selectedDate}
          onPendingChange={setCreateSaving}
          onDateChange={(d) => {
            setSelectedDate(d);
            setConsoleScope("day");
            setSelectedSessionId(null);
          }}
          onCreated={(createdDate) => {
            setCreateModalOpen(false);
            if (createdDate) {
              setSelectedDate(createdDate);
              setConsoleScope("day");
              setSelectedSessionId(null);
            }
          }}
        />
      </AdminModal>

      {/* 수정 모달 */}
      <AdminModal
        open={editModalOpen}
        onClose={() => {
          if (editSaving) return;
          setEditModalOpen(false);
          setEditSession(null);
        }}
        closeDisabled={editSaving}
        width={520}
      >
        {editSession && (
          <ClinicCreatePanel
            asModal
            editSession={editSession}
            onPendingChange={setEditSaving}
            onUpdated={(notice) => {
              setEditModalOpen(false);
              setChangeNoticeDraft(notice.changed ? notice : null);
              setSelectedDate(notice.date);
              setConsoleScope("day");
              setSelectedSessionId(notice.sessionId);
              setEditSession(null);
              qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree });
              qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
            }}
          />
        )}
      </AdminModal>

      {/* 이전 주 불러오기 모달 */}
      <PreviousWeekImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        currentDate={selectedDate}
      />

      {/* 삭제 확인 모달 */}
      <AdminModal
        open={!!deleteConfirm}
        onClose={() => !deleteSessionM.isPending && setDeleteConfirm(null)}
        type="confirm"
        width={420}
      >
        {deleteConfirm && (
          <div className="clinic-delete-modal__body">
            <h2 className="clinic-delete-modal__title">
              클리닉 삭제
            </h2>
            <p className="clinic-delete-modal__desc">
              <strong>{`「${deleteConfirm.label}」`}</strong> 클리닉을 정말로
              삭제하시겠습니까?
            </p>
            <p className="clinic-delete-modal__warning">
              이 클리닉에 예약된 학생들의 출석/예약 기록도 함께 삭제됩니다.
            </p>
            <p className="clinic-delete-modal__warning clinic-delete-modal__warning--last">
              삭제된 클리닉과 예약/출석 정보는 복구할 수 없습니다.
            </p>
            <div className="clinic-delete-modal__actions">
              <Button
                intent="secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteSessionM.isPending}
              >
                취소
              </Button>
              <Button
                intent="danger"
                onClick={() => deleteConfirm && deleteSessionM.mutate(deleteConfirm.id)}
                disabled={deleteSessionM.isPending}
              >
                {deleteSessionM.isPending ? "삭제 중…" : "삭제"}
              </Button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
