// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * SessionScoresEntryPage — 성적 탭 (엑셀형 작업 플레이스)
 * - DomainListToolbar + 테이블, Tab/화살표 셀 이동, 편집 모드에서만 셀 편집
 * - 학생 체크박스 선택 시 메시지 발송·수업결과 발송·성적일괄변경·엑셀 다운로드 (students 도메인 참고)
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";

import SessionScoresPanel, { type SessionScoresPanelHandle } from "@/features/scores/panels/SessionScoresPanel";
import { useScoreEditDraft } from "@/features/scores/hooks/useScoreEditDraft";
import { postScoreDraftCommit } from "@/features/scores/api/scoreDraft";
import {
  fetchSessionScores,
  type SessionScoreRow,
} from "@/features/scores/api/sessionScores";
import { scoresQueryKeys } from "@/features/scores/api/queryKeys";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import { feedback } from "@/shared/ui/feedback/feedback";
import CreateRegularExamModal from "@/features/exams/components/create/CreateRegularExamModal";
import CreateHomeworkModal from "@/features/homework/components/CreateHomeworkModal";
import { fetchSessionEnrollments } from "@/features/exams/api/sessionEnrollments";
import { updateExamEnrollmentRows } from "@/features/exams/api/examEnrollments";
import { putHomeworkAssignments } from "@/features/homework/api/homeworkAssignments";
import api from "@/shared/api/axios";
import AdminOmrBatchUploadBox from "@/features/submissions/components/AdminOmrBatchUploadBox";
import { updateAdminExam } from "@/features/exams/api/adminExam";
import { updateAdminHomework } from "@/features/homework/api/adminHomework";
import { fetchAdminSessionExams } from "@/features/results/api/adminSessionExams";
import ScorePrintPreviewModal from "@/features/scores/components/ScorePrintPreviewModal";
import ClinicPrintPreviewModal from "@/features/scores/components/ClinicPrintPreviewModal";
import { fetchAttendance } from "@/features/lectures/api/attendance";
import "./SessionScoresEntryPage.css";

type Props = {
  onOpenEnrollModal?: () => void;
  onOpenStudentModal?: () => void;
};

export default function SessionScoresEntryPage(_props: Props) {
  const { sessionId: sessionIdParam, lectureId: lectureIdParam } = useParams<{ lectureId: string; sessionId: string }>();
  const numericSessionId = Number(sessionIdParam);
  const numericLectureId = Number(lectureIdParam);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [searchInput, setSearchInput] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /** 편집 시 어떤 셀을 쓰기 모드로 할지 */
  const [examEditTotal, setExamEditTotal] = useState(true);
  const [examEditSubjective, setExamEditSubjective] = useState(false);
  const [homeworkEdit, setHomeworkEdit] = useState(true);
  /** 읽기 모드에서 시험 점수 표시: 합산(한 칸) | 객관식+주관식(두 칸) */
  const [scoreDisplayMode, setScoreDisplayMode] = useState<"total" | "breakdown">("total");
  /** 뷰 필터: 시험만/과제만/전체 */
  const [viewFilter, setViewFilter] = useState<"all" | "exam" | "homework">("all");
  /** 점수 표시 형식: raw(원점수만) | fraction(50/100) */
  const [scoreFormat, setScoreFormat] = useState<"raw" | "fraction">("raw");
  const { openSendMessageModal } = useSendMessageModal();
  const panelRef = useRef<SessionScoresPanelHandle>(null);
  const [showBulkScoreModal, setShowBulkScoreModal] = useState(false);
  const [bulkScoreValue, setBulkScoreValue] = useState("");
  const [bulkScoreTarget, setBulkScoreTarget] = useState<"exam" | "homework">("exam");

  /* ── 시험/과제 추가 모달 + 대상자 등록 ── */
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [showCreateHomework, setShowCreateHomework] = useState(false);
  const [enrollingAll, setEnrollingAll] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showClinicPreview, setShowClinicPreview] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [omrExam, setOmrExam] = useState<{ examId: number; title: string } | null>(null);
  const [showOmrPicker, setShowOmrPicker] = useState(false);
  const omrPickerRef = useRef<HTMLDivElement>(null);

  /** 강의 정보 (PDF 제목용) */
  const { data: lectureData } = useQuery({
    queryKey: ["lecture", numericLectureId],
    queryFn: async () => (await api.get(`/lectures/lectures/${numericLectureId}/`)).data,
    enabled: Number.isFinite(numericLectureId),
  });
  /** 세션 정보 (PDF 제목용) */
  const { data: sessionData } = useQuery({
    queryKey: ["session-detail", numericSessionId],
    queryFn: async () => (await api.get(`/lectures/sessions/${numericSessionId}/`)).data,
    enabled: Number.isFinite(numericSessionId),
  });
  /** 출결 (PDF 출결 열 + 클리닉 현황용) */
  const { data: attendanceForPdf } = useQuery({
    queryKey: ["attendance-for-pdf", numericSessionId],
    queryFn: () => fetchAttendance(numericSessionId, { page_size: 500 }),
    enabled: Number.isFinite(numericSessionId),
  });

  const attendanceMapForPdf = useMemo(() => {
    const raw = attendanceForPdf;
    const list = raw?.data ?? [];
    const map: Record<number, string> = {};
    for (const a of list) {
      const eid = (a as any)?.enrollment_id ?? (a as any)?.enrollment;
      if (eid != null && (a as any)?.status) map[Number(eid)] = String((a as any).status);
    }
    return map;
  }, [attendanceForPdf]);

  const sessionTitle = sessionData?.title
    || (sessionData?.order != null ? `${sessionData.order}차시` : `차시 #${numericSessionId}`);
  const lectureTitle = lectureData?.title || "강의";

  // 더보기 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  // OMR picker 외부 클릭 닫기
  useEffect(() => {
    if (!showOmrPicker) return;
    const handler = (e: MouseEvent) => {
      if (omrPickerRef.current && !omrPickerRef.current.contains(e.target as Node)) setShowOmrPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showOmrPicker]);

  const invalidateScores = () => {
    void qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(numericSessionId) });
    void qc.invalidateQueries({ queryKey: ["admin-session-exams", numericSessionId] });
    void qc.invalidateQueries({ queryKey: ["session-homeworks", numericSessionId] });
  };

  const handleExamCreated = (_examId: number) => {
    invalidateScores();
    feedback.success("시험이 추가되었습니다.");
  };

  const handleHomeworkCreated = (_homeworkId: number) => {
    invalidateScores();
    feedback.success("과제가 추가되었습니다.");
  };

  /** 대상자 전체 등록 — 세션 수강생을 모든 시험/과제에 일괄 등록 */
  const handleEnrollAll = async () => {
    if (!Number.isFinite(numericSessionId)) return;
    const meta = data?.meta;
    if (!meta || ((meta.exams?.length ?? 0) === 0 && (meta.homeworks?.length ?? 0) === 0)) {
      feedback.error("등록된 시험 또는 과제가 없습니다. 먼저 시험/과제를 추가하세요.");
      return;
    }
    setEnrollingAll(true);
    try {
      const enrollments = await fetchSessionEnrollments(numericSessionId);
      const enrollmentIds = enrollments.map((e) => e.enrollment);
      if (enrollmentIds.length === 0) {
        feedback.error("세션에 등록된 수강생이 없습니다.");
        return;
      }
      const promises: Promise<any>[] = [];
      for (const exam of meta.exams ?? []) {
        promises.push(
          updateExamEnrollmentRows({
            examId: exam.exam_id,
            sessionId: numericSessionId,
            enrollment_ids: enrollmentIds,
          })
        );
      }
      for (const hw of meta.homeworks ?? []) {
        promises.push(
          putHomeworkAssignments({
            homeworkId: hw.homework_id,
            enrollment_ids: enrollmentIds,
          })
        );
      }
      await Promise.all(promises);
      invalidateScores();
      feedback.success(`수강생 ${enrollmentIds.length}명이 모든 시험/과제에 등록되었습니다.`);
    } catch (e: any) {
      feedback.error("대상자 등록에 실패했습니다. 수강생 등록 상태를 확인해 주세요.");
    } finally {
      setEnrollingAll(false);
    }
  };

  const [closingExams, setClosingExams] = useState(false);
  const [closingHomeworks, setClosingHomeworks] = useState(false);

  const handleCloseAllExams = async () => {
    setClosingExams(true);
    try {
      const exams = await fetchAdminSessionExams(numericSessionId);
      const openExams = exams.filter((e) => e.status === "OPEN");
      if (openExams.length === 0) {
        feedback.info("진행 중인 시험이 없습니다.");
        return;
      }
      if (!(await confirm({ title: "시험 일괄 종료", message: `진행 중인 시험 ${openExams.length}건을 모두 종료하시겠습니까?`, confirmText: "종료" }))) return;
      await Promise.all(openExams.map((e) => updateAdminExam(Number(e.exam_id), { status: "CLOSED" })));
      invalidateScores();
      feedback.success(`시험 ${openExams.length}건 종료 완료`);
    } catch (e: any) {
      feedback.error("시험 종료에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setClosingExams(false);
    }
  };

  const handleCloseAllHomeworks = async () => {
    setClosingHomeworks(true);
    try {
      const res = await api.get("/homeworks/", { params: { session_id: numericSessionId } });
      const hws = (res.data?.results ?? res.data?.items ?? res.data ?? []) as any[];
      const openHws = hws.filter((h) => h.status === "OPEN");
      if (openHws.length === 0) {
        feedback.info("진행 중인 과제가 없습니다.");
        return;
      }
      if (!(await confirm({ title: "과제 일괄 종료", message: `진행 중인 과제 ${openHws.length}건을 모두 종료하시겠습니까?`, confirmText: "종료" }))) return;
      await Promise.all(openHws.map((h) => updateAdminHomework(Number(h.id), { status: "CLOSED" })));
      invalidateScores();
      feedback.success(`과제 ${openHws.length}건 종료 완료`);
    } catch (e: any) {
      feedback.error("과제 종료에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setClosingHomeworks(false);
    }
  };

  const sessionIdForDraft = Number.isFinite(numericSessionId) ? numericSessionId : 0;
  const draft = useScoreEditDraft({
    sessionId: sessionIdForDraft,
    panelRef,
    isEditMode: !!isEditMode && sessionIdForDraft > 0,
  });
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isEditMode || draft.draftStatus !== "saved") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isEditMode, draft.draftStatus]);

  const setPresetTotalHw = () => {
    setExamEditTotal(true);
    setExamEditSubjective(false);
    setHomeworkEdit(true);
  };
  const setPresetSubjectiveHw = () => {
    setExamEditTotal(false);
    setExamEditSubjective(true);
    setHomeworkEdit(true);
  };

  const handleSelectTotal = async () => {
    if (examEditTotal) {
      setExamEditTotal(false);
      return;
    }
    if (examEditSubjective) {
      const ok = await confirm({ title: "입력 방식 변경", message: "주관식만 입력이 해제됩니다. 합산으로 입력하시겠습니까?", confirmText: "합산 입력" });
      if (!ok) return;
      setExamEditSubjective(false);
    }
    setExamEditTotal(true);
  };
  const handleSelectSubjective = async () => {
    if (examEditSubjective) {
      setExamEditSubjective(false);
      return;
    }
    if (examEditTotal) {
      const ok = await confirm({ title: "입력 방식 변경", message: "합산 입력이 해제됩니다. 주관식만으로 입력하시겠습니까?", confirmText: "주관식 입력" });
      if (!ok) return;
      setExamEditTotal(false);
    }
    setExamEditSubjective(true);
  };
  const handleSelectHomework = () => setHomeworkEdit((v) => !v);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: scoresQueryKeys.sessionScores(numericSessionId),
    queryFn: () => fetchSessionScores(numericSessionId),
    enabled: Number.isFinite(numericSessionId) && numericSessionId > 0,
  });

  /** 시험 또는 과제 둘 중 하나라도 등록된 수강생만 테이블에 표시 → 툴바 인원도 동일 기준 */
  const displayCount = useMemo(() => {
    const raw = data?.rows ?? [];
    return raw.filter((r) => (r.exams?.length ?? 0) > 0 || (r.homeworks?.length ?? 0) > 0).length;
  }, [data?.rows]);

  const selectedStudentIds = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows
      .filter((r) => selectedEnrollmentIds.includes(r.enrollment_id))
      .map((r) => r.student_id)
      .filter((id): id is number => id != null && Number.isFinite(id));
  }, [data?.rows, selectedEnrollmentIds]);

  const selectionBar = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 pl-1">
        <span
          className="text-[13px] font-semibold"
          style={{
            color: "var(--color-brand-primary)",
          }}
        >
          {selectedEnrollmentIds.length}명 선택됨
        </span>
        <span className="text-[var(--color-border-divider)]">|</span>
        <Button
          intent="secondary"
          size="sm"
          onClick={() => setSelectedEnrollmentIds([])}
          disabled={selectedEnrollmentIds.length === 0}
        >
          선택 해제
        </Button>
        <span className="text-[var(--color-border-divider)]">|</span>
        <Button
          intent="secondary"
          size="sm"
          onClick={() =>
            openSendMessageModal({
              studentIds: selectedStudentIds,
              recipientLabel: `선택한 수강생 ${selectedEnrollmentIds.length}명`,
              blockCategory: "exam",
            })
          }
          disabled={selectedEnrollmentIds.length === 0}
        >
          메시지 발송
        </Button>
        <Button
          intent="secondary"
          size="sm"
          onClick={() =>
            openSendMessageModal({
              studentIds: selectedStudentIds,
              recipientLabel: `수업결과 발송 — 선택한 수강생 ${selectedEnrollmentIds.length}명`,
              blockCategory: "grades",
            })
          }
          disabled={selectedEnrollmentIds.length === 0}
        >
          수업결과 발송
        </Button>
        <Button
          intent="secondary"
          size="sm"
          onClick={() => setShowBulkScoreModal(true)}
          disabled={selectedEnrollmentIds.length === 0}
        >
          성적 일괄 변경
        </Button>
        <Button
          intent="secondary"
          size="sm"
          onClick={async () => {
            const rows = data?.rows ?? [];
            const selected = rows.filter((r) => selectedEnrollmentIds.includes(r.enrollment_id));
            if (selected.length === 0) {
              feedback.info("선택한 학생이 없습니다.");
              return;
            }
            const metaExams = data?.meta?.exams ?? [];
            const metaHomeworks = data?.meta?.homeworks ?? [];
            const headers = ["이름"];
            metaExams.forEach((e) => headers.push(`${e.title ?? "시험"} (점수)`));
            metaHomeworks.forEach((h) => headers.push(`${h.title ?? "과제"} (점수)`));

            const csvRows = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",")];
            for (const row of selected) {
              const cells: string[] = [row.student_name ?? ""];
              // Match by exam_id/homework_id to ensure column alignment with headers
              for (const metaExam of metaExams) {
                const entry = (row.exams ?? []).find((e) => e.exam_id === metaExam.exam_id);
                cells.push(entry?.block.score != null ? String(entry.block.score) : "");
              }
              for (const metaHw of metaHomeworks) {
                const entry = (row.homeworks ?? []).find((h) => h.homework_id === metaHw.homework_id);
                cells.push(entry?.block.score != null ? String(entry.block.score) : "");
              }
              csvRows.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
            }

            const bom = "\uFEFF";
            const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
            const { downloadBlob } = await import("@/shared/utils/safeDownload");
            downloadBlob(blob, `성적_${selected.length}명.csv`);
            feedback.success(`엑셀 다운로드됨 (${selected.length}명)`);
          }}
          disabled={selectedEnrollmentIds.length === 0}
        >
          엑셀 다운로드
        </Button>
      </div>
    </div>
  );

  if (!Number.isFinite(numericSessionId)) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-error)" }}>
        차시 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const primaryAction = (
    <div className="flex items-center gap-2">
      {/* 핵심 액션: 편집 모드 */}
      <Button
        type="button"
        intent="primary"
        size="sm"
        disabled={isSaving}
        onClick={async () => {
          if (isEditMode) {
            setIsSaving(true);
            try {
              await panelRef.current?.flushPendingChanges?.();
              await postScoreDraftCommit(sessionIdForDraft);
              setIsEditMode(false);
            } catch (err) {
              feedback.error((err as Error).message || "저장에 실패했습니다. 다시 시도해주세요.");
            } finally {
              setIsSaving(false);
            }
            return;
          }
          setIsEditMode(true);
        }}
      >
        {isSaving ? "저장 중…" : isEditMode ? "저장하기" : "편집 모드"}
      </Button>

      <Button
        type="button"
        intent="secondary"
        size="sm"
        disabled={enrollingAll}
        onClick={() => void handleEnrollAll()}
        title="강의 수강생 전원을 이 차시에 등록"
      >
        {enrollingAll ? "등록 중…" : "대상자 전원등록"}
      </Button>

      <Button
        type="button"
        intent="secondary"
        size="sm"
        onClick={() => { setShowCreateExam(true); }}
      >
        시험 추가
      </Button>

      {/* OMR 업로드 — 시험이 1개면 바로 모달, 2개 이상이면 드롭다운 */}
      {(data?.meta?.exams?.length ?? 0) > 0 && (
        <div ref={omrPickerRef} className="relative">
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => {
              const exams = data?.meta?.exams ?? [];
              if (exams.length === 1) {
                setOmrExam({ examId: exams[0].exam_id, title: exams[0].title });
              } else {
                setShowOmrPicker((v) => !v);
              }
            }}
            title="OMR 스캔 업로드 — 객관식 자동 채점"
          >
            <span className="inline-flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              OMR 업로드
            </span>
          </Button>
          {showOmrPicker && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] rounded-lg shadow-lg py-1 min-w-[180px]">
              <div className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]">시험 선택</div>
              {(data?.meta?.exams ?? []).map((ex) => (
                <button
                  key={ex.exam_id}
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-bg-surface-hover)] flex items-center gap-2"
                  onClick={() => {
                    setOmrExam({ examId: ex.exam_id, title: ex.title });
                    setShowOmrPicker(false);
                  }}
                >
                  <span className="ds-status-badge ds-status-badge--1ch" data-tone="primary" aria-label="시험">시</span>
                  {ex.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        intent="secondary"
        size="sm"
        onClick={() => { setShowCreateHomework(true); }}
      >
        과제 추가
      </Button>

      {/* 더보기 메뉴 */}
      <div ref={moreMenuRef} className="relative">
        <Button
          type="button"
          intent="ghost"
          size="sm"
          onClick={() => setShowMoreMenu((v) => !v)}
          title="추가 기능"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
          </svg>
        </Button>
        {showMoreMenu && (
          <div
            className="absolute right-0 top-full mt-1 z-50 bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] rounded-lg shadow-lg py-1 min-w-[180px]"
          >
            <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-bg-surface-hover)] flex items-center gap-2" onClick={() => { setShowPrintPreview(true); setShowMoreMenu(false); }}>
              성적표 출력
            </button>
            <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-bg-surface-hover)] flex items-center gap-2" onClick={() => { setShowClinicPreview(true); setShowMoreMenu(false); }}>
              클리닉 대상 보기
            </button>
            <div className="border-t border-[var(--color-border-divider)] my-1" />
            <button type="button" className="w-full text-left px-4 py-2 text-sm text-[var(--color-error)] hover:bg-[var(--color-bg-surface-hover)]" disabled={closingExams} onClick={() => { void handleCloseAllExams(); setShowMoreMenu(false); }}>
              {closingExams ? "종료 중…" : "전체 시험 종료"}
            </button>
            <button type="button" className="w-full text-left px-4 py-2 text-sm text-[var(--color-error)] hover:bg-[var(--color-bg-surface-hover)]" disabled={closingHomeworks} onClick={() => { void handleCloseAllHomeworks(); setShowMoreMenu(false); }}>
              {closingHomeworks ? "종료 중…" : "전체 과제 종료"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <DomainListToolbar
        totalLabel={isLoading ? "…" : `총 ${displayCount}명`}
        searchSlot={
          <input
            type="search"
            className="ds-input"
            placeholder="이름 검색 (초성 검색 가능)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ maxWidth: 360 }}
            aria-label="학생 이름 검색"
          />
        }
        filterSlot={null}
        primaryAction={
          <div className="flex items-center gap-2">
            {primaryAction}
            {isEditMode && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {draft.draftStatus === "saving" && "임시저장 중..."}
                {draft.draftStatus === "saved" && draft.lastSavedAt != null &&
                  `임시저장됨 · ${Math.max(0, Math.floor((Date.now() - draft.lastSavedAt) / 1000))}초 전`}
                {draft.draftStatus === "error" && (
                  <>
                    <span className="text-[var(--color-error)]">임시저장 실패</span>
                    {" "}
                    <button type="button" className="underline text-[var(--color-brand-primary)]" onClick={() => void draft.performSave()}>
                      다시 시도
                    </button>
                  </>
                )}
                {draft.draftStatus === "idle" && <span className="text-[var(--color-text-muted)]">저장 안 됨</span>}
              </span>
            )}
          </div>
        }
        belowSlot={selectionBar}
      />

      {draft.hasDraftToRestore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-restore-title-entry"
        >
          <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-lg p-6 max-w-md mx-4 border border-[var(--color-border-divider)]">
            <h2 id="draft-restore-title-entry" className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
              이전에 임시저장된 편집 내용이 있습니다. 복원할까요?
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              복원하면 이전 편집 내용이 테이블에 다시 적용됩니다. 버리면 현재 서버 데이터만 표시됩니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => void draft.discardDraft()}
                className="h-9 px-4 rounded text-sm font-medium border border-[var(--color-border-divider)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-soft)]"
              >
                버리기
              </button>
              <button
                type="button"
                onClick={draft.restoreDraft}
                className="h-9 px-4 rounded text-sm font-medium bg-[var(--color-brand-primary)] text-white hover:opacity-90"
              >
                복원
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 설정 바 — 읽기 모드: 표시 설정 / 편집 모드: 편집 항목. 높이 고정으로 테이블 위치 불변 */}
      <div className="scores-view-filter-panel">
        {isEditMode ? (
          <div className="scores-view-filter-section">
            <span className="scores-view-filter-label">편집 항목</span>
            <div className="scores-display-segment" role="group" aria-label="편집 항목 선택">
              <button type="button" onClick={setPresetTotalHw} className="scores-display-segment__btn" aria-pressed={examEditTotal && homeworkEdit && !examEditSubjective}>합산+과제</button>
              <button type="button" onClick={setPresetSubjectiveHw} className="scores-display-segment__btn" aria-pressed={examEditSubjective && homeworkEdit && !examEditTotal}>주관식+과제</button>
              <button type="button" onClick={handleSelectTotal} className="scores-display-segment__btn" aria-pressed={examEditTotal && !homeworkEdit}>합산</button>
              <button type="button" onClick={handleSelectSubjective} className="scores-display-segment__btn" aria-pressed={examEditSubjective && !homeworkEdit}>주관식</button>
              <button type="button" onClick={handleSelectHomework} className="scores-display-segment__btn" aria-pressed={homeworkEdit && !examEditTotal && !examEditSubjective}>과제</button>
            </div>
          </div>
        ) : (
          <>
            <div className="scores-view-filter-section">
              <span className="scores-view-filter-label">보기</span>
              <div className="scores-display-segment" role="group" aria-label="컬럼 필터">
                <button type="button" onClick={() => setViewFilter("all")} className="scores-display-segment__btn" aria-pressed={viewFilter === "all"}>전체</button>
                <button type="button" onClick={() => setViewFilter("exam")} className="scores-display-segment__btn" aria-pressed={viewFilter === "exam"}>시험만</button>
                <button type="button" onClick={() => setViewFilter("homework")} className="scores-display-segment__btn" aria-pressed={viewFilter === "homework"}>과제만</button>
              </div>
            </div>
            {viewFilter !== "homework" && (
              <div className="scores-view-filter-section">
                <span className="scores-view-filter-label">시험 점수</span>
                <div className="scores-display-segment" role="group" aria-label="시험 점수 표시 방식">
                  <button type="button" onClick={() => setScoreDisplayMode("total")} className="scores-display-segment__btn" aria-pressed={scoreDisplayMode === "total"}>합산</button>
                  <button type="button" onClick={() => setScoreDisplayMode("breakdown")} className="scores-display-segment__btn" aria-pressed={scoreDisplayMode === "breakdown"}>객관식 + 주관식</button>
                </div>
              </div>
            )}
            <div className="scores-view-filter-section">
              <span className="scores-view-filter-label">점수 표시</span>
              <div className="scores-display-segment" role="group" aria-label="점수 표시 형식">
                <button type="button" onClick={() => setScoreFormat("raw")} className="scores-display-segment__btn" aria-pressed={scoreFormat === "raw"}>원점수</button>
                <button type="button" onClick={() => setScoreFormat("fraction")} className="scores-display-segment__btn" aria-pressed={scoreFormat === "fraction"}>만점 표기</button>
              </div>
            </div>
          </>
        )}
      </div>

      {isLoading && (
        <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />
      )}

      {!isLoading && isError && (
        <EmptyState
          scope="panel"
          tone="error"
          title="성적을 불러오지 못했습니다"
          description="네트워크 연결을 확인하고 다시 시도해 주세요."
          actions={
            <Button intent="secondary" size="sm" onClick={() => void refetch()}>
              다시 시도
            </Button>
          }
        />
      )}

      {!isLoading && !isError && (
        <SessionScoresPanel
          ref={panelRef}
          sessionId={numericSessionId}
          search={searchInput}
          isEditMode={isEditMode}
          examEditTotal={examEditTotal}
          examEditObjective={false}
          examEditSubjective={examEditSubjective}
          homeworkEdit={homeworkEdit}
          scoreDisplayMode={scoreDisplayMode}
          scoreFormat={scoreFormat}
          viewFilter={viewFilter}
          selectedEnrollmentIds={selectedEnrollmentIds}
          onSelectionChange={setSelectedEnrollmentIds}
        />
      )}

      {/* 성적 일괄 변경 모달 */}
      <AdminModal
        open={showBulkScoreModal}
        onClose={() => {
          setShowBulkScoreModal(false);
          setBulkScoreValue("");
        }}
        type="action"
        width={420}
        onEnterConfirm={() => {
          if (!isEditMode || !bulkScoreValue.trim()) return;
          const score = Number(bulkScoreValue);
          if (Number.isNaN(score) || score < 0) {
            feedback.error("유효한 점수를 입력해주세요.");
            return;
          }
          // Build PendingChange[] for all selected enrollments
          const meta = data?.meta;
          const changes: import("@/features/scores/api/scoreDraft").PendingChange[] = [];
          for (const enrollmentId of selectedEnrollmentIds) {
            if (bulkScoreTarget === "exam") {
              for (const exam of meta?.exams ?? []) {
                changes.push({ type: "examTotal", examId: exam.exam_id, enrollmentId, score });
              }
            } else {
              for (const hw of meta?.homeworks ?? []) {
                changes.push({ type: "homework", homeworkId: hw.homework_id, enrollmentId, score });
              }
            }
          }
          if (changes.length === 0) {
            feedback.error("변경할 대상이 없습니다. 시험 또는 과제가 등록되어 있는지 확인하세요.");
            return;
          }
          panelRef.current?.applyDraftPatch(changes);
          feedback.success(
            `${bulkScoreTarget === "exam" ? "시험" : "과제"} 성적 일괄 변경이 적용되었습니다. (${selectedEnrollmentIds.length}명, ${score}점) 저장하기를 눌러 반영하세요.`
          );
          setShowBulkScoreModal(false);
          setBulkScoreValue("");
        }}
      >
        <ModalHeader title="성적 일괄 변경" />
        <ModalBody>
          <div className="flex flex-col gap-4">
            {!isEditMode && (
              <p className="text-sm font-medium" style={{ color: "var(--color-error)" }}>
                편집 모드에서만 성적 일괄 변경이 가능합니다. 먼저 편집 모드를 켜주세요.
              </p>
            )}
            <p className="text-sm text-[var(--color-text-muted)]">
              선택한 {selectedEnrollmentIds.length}명의 성적을 일괄 변경합니다.
            </p>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">대상</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`h-9 px-4 rounded text-sm font-medium border ${
                    bulkScoreTarget === "exam"
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]"
                      : "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-divider)]"
                  }`}
                  onClick={() => setBulkScoreTarget("exam")}
                >
                  시험
                </button>
                <button
                  type="button"
                  className={`h-9 px-4 rounded text-sm font-medium border ${
                    bulkScoreTarget === "homework"
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]"
                      : "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-divider)]"
                  }`}
                  onClick={() => setBulkScoreTarget("homework")}
                >
                  과제
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block" htmlFor="bulk-score-input">
                점수
              </label>
              <input
                id="bulk-score-input"
                type="number"
                min={0}
                className="ds-input"
                placeholder="점수를 입력하세요"
                value={bulkScoreValue}
                onChange={(e) => setBulkScoreValue(e.target.value)}
                style={{ maxWidth: 200 }}
                autoFocus
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter
          right={
            <>
              <Button
                intent="secondary"
                size="sm"
                onClick={() => {
                  setShowBulkScoreModal(false);
                  setBulkScoreValue("");
                }}
              >
                취소
              </Button>
              <Button
                intent="primary"
                size="sm"
                disabled={!bulkScoreValue.trim() || !isEditMode}
                onClick={() => {
                  const score = Number(bulkScoreValue);
                  if (Number.isNaN(score) || score < 0) {
                    feedback.error("유효한 점수를 입력해주세요.");
                    return;
                  }
                  // Build PendingChange[] for all selected enrollments
                  const meta = data?.meta;
                  const changes: import("@/features/scores/api/scoreDraft").PendingChange[] = [];
                  for (const enrollmentId of selectedEnrollmentIds) {
                    if (bulkScoreTarget === "exam") {
                      for (const exam of meta?.exams ?? []) {
                        changes.push({ type: "examTotal", examId: exam.exam_id, enrollmentId, score });
                      }
                    } else {
                      for (const hw of meta?.homeworks ?? []) {
                        changes.push({ type: "homework", homeworkId: hw.homework_id, enrollmentId, score });
                      }
                    }
                  }
                  if (changes.length === 0) {
                    feedback.error("변경할 대상이 없습니다. 시험 또는 과제가 등록되어 있는지 확인하세요.");
                    return;
                  }
                  panelRef.current?.applyDraftPatch(changes);
                  feedback.success(
                    `${bulkScoreTarget === "exam" ? "시험" : "과제"} 성적 일괄 변경이 적용되었습니다. (${selectedEnrollmentIds.length}명, ${score}점) 저장하기를 눌러 반영하세요.`
                  );
                  setShowBulkScoreModal(false);
                  setBulkScoreValue("");
                }}
              >
                적용
              </Button>
            </>
          }
        />
      </AdminModal>

      {/* 시험 추가 모달 */}
      <CreateRegularExamModal
        open={showCreateExam}
        onClose={() => setShowCreateExam(false)}
        sessionId={numericSessionId}
        lectureId={numericLectureId}
        onCreated={handleExamCreated}
      />

      {/* 과제 추가 모달 */}
      <CreateHomeworkModal
        open={showCreateHomework}
        onClose={() => setShowCreateHomework(false)}
        sessionId={numericSessionId}
        onCreated={handleHomeworkCreated}
      />

      {/* 성적표 인쇄 미리보기 */}
      {showPrintPreview && data?.meta && (
        <ScorePrintPreviewModal
          open={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          rows={data.rows.filter((r) => (r.exams?.length ?? 0) > 0 || (r.homeworks?.length ?? 0) > 0)}
          meta={data.meta}
          sessionTitle={sessionTitle}
          lectureTitle={lectureTitle}
          attendanceMap={attendanceMapForPdf}
        />
      )}

      {/* 클리닉 대상자 미리보기 */}
      {showClinicPreview && data?.meta && (
        <ClinicPrintPreviewModal
          open={showClinicPreview}
          onClose={() => setShowClinicPreview(false)}
          rows={data.rows}
          meta={data.meta}
          sessionTitle={sessionTitle}
          lectureTitle={lectureTitle}
          attendanceMap={attendanceMapForPdf}
        />
      )}

      {/* OMR 업로드 모달 */}
      {omrExam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="omr-upload-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) { setOmrExam(null); invalidateScores(); } }}
        >
          <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-lg border border-[var(--color-border-divider)] max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border-divider)]">
              <h2 id="omr-upload-modal-title" className="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-brand-primary)]">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                OMR 업로드 — {omrExam.title}
              </h2>
              <button
                type="button"
                onClick={() => { setOmrExam(null); invalidateScores(); }}
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                aria-label="닫기"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                학생이 작성한 OMR 스캔본을 업로드하면 식별코드를 인식하여 객관식을 자동 채점합니다.
              </p>
              <AdminOmrBatchUploadBox examId={omrExam.examId} />
            </div>
            <div className="px-5 py-3 border-t border-[var(--color-border-divider)] flex justify-end">
              <Button
                intent="primary"
                size="sm"
                onClick={() => { setOmrExam(null); invalidateScores(); }}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
