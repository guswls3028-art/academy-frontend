/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicOperationsConsolePage.tsx
 * 클리닉 진행 — 좌: 달력 + 해당일 클리닉 수업 목록 | 우: 해당 수업 대상자 관리 워크스페이스
 * SSOT: PanelWithTreeLayout (메시지 자동발송과 동일)
 */

import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { fetchClinicSessionTree, deleteClinicSession } from "../../api/clinicSessions.api";
import type { ClinicSessionTreeNode, ClinicSessionDetail } from "../../api/clinicSessions.api";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import ClinicConsoleSidebar from "./ClinicConsoleSidebar";
import ClinicConsoleWorkspace from "./ClinicConsoleWorkspace";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import PreviousWeekImportModal from "../../components/PreviousWeekImportModal";
import AdminModal from "@/shared/ui/modal/AdminModal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";

dayjs.locale("ko");

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

export default function ClinicOperationsConsolePage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dateParam = sp.get("date");
  const initialDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();
  const [selectedDate, setSelectedDate] = useState(() => initialDate);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // 모달 상태
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<ClinicSessionDetail | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; label: string } | null>(null);

  // 삭제 뮤테이션
  const deleteSessionM = useMutation({
    mutationFn: (id: number) => deleteClinicSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-month"] });
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
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

  const headerDesc = "출석 확인, 실패 사유 확인, 통과 처리까지.";

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
                onCreateClick={() => setCreateModalOpen(true)}
                onImportClick={() => setImportModalOpen(true)}
                onEditSession={handleEditSession}
                onDeleteSession={handleDeleteSession}
              />
            </div>
          </aside>

          <div className={panelStyles.content}>
            <div className={panelStyles.contentInner} style={{ maxWidth: "none" }}>
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
                        onClick={() => setCreateModalOpen(true)}
                      >
                        <CalendarPlus size={16} aria-hidden />
                        클리닉 만들기
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
                  onEditSession={handleEditSession}
                  onDeleteSession={handleDeleteSession}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 생성 모달 */}
      <AdminModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        width={520}
      >
        <ClinicCreatePanel
          asModal
          date={selectedDate}
          onDateChange={(d) => {
            setSelectedDate(d);
            setSelectedSessionId(null);
          }}
          onCreated={(createdDate) => {
            setCreateModalOpen(false);
            if (createdDate) {
              setSelectedDate(createdDate);
              setSelectedSessionId(null);
            }
          }}
        />
      </AdminModal>

      {/* 수정 모달 */}
      <AdminModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditSession(null); }}
        width={520}
      >
        {editSession && (
          <ClinicCreatePanel
            asModal
            editSession={editSession}
            onUpdated={() => {
              setEditModalOpen(false);
              setEditSession(null);
              qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
              qc.invalidateQueries({ queryKey: ["clinic-participants"] });
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
