// PATH: src/app_admin/domains/lectures/pages/scores/SessionScoresEntryPage.tsx
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-restricted-syntax */
/**
 * SessionScoresEntryPage — 성적 탭 (엑셀형 작업 플레이스)
 * - DomainListToolbar + 테이블, Tab/화살표 셀 이동, 편집 모드에서만 셀 편집
 * - 학생 체크박스 선택 시 수업결과 알림톡 발송·성적일괄변경·엑셀 다운로드 (students 도메인 참고)
 *
 * 2026-05-12: "메시지 발송"(SMS path) 버튼 제거 — 학원장 임근혁 보고. 단일 알림톡 경로로 통일.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";

import SessionScoresPanel, { type SessionScoresPanelHandle } from "@admin/domains/scores/panels/SessionScoresPanel";
import { useScoreEditDraft } from "@admin/domains/scores/hooks/useScoreEditDraft";
import { postScoreDraftCommit } from "@admin/domains/scores/api/scoreDraft";
import {
  fetchSessionScores,
  type SessionScoreRow,
} from "@admin/domains/scores/api/sessionScores";
import { scoresQueryKeys } from "@admin/domains/scores/api/queryKeys";
import { Button, EmptyState, Badge } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { useSendMessageModal } from "@admin/domains/messages/context/SendMessageModalContext";
import { fetchMessageTemplates } from "@admin/domains/messages/api/messages.api";
import { substituteScoreVars, generateScoreReport, buildScoreDetail, buildGenericScoreTemplate } from "@admin/domains/scores/utils/generateScoreReport";
import { feedback } from "@/shared/ui/feedback/feedback";
import CreateRegularExamModal from "@admin/domains/exams/components/create/CreateRegularExamModal";
import CreateHomeworkModal from "@admin/domains/homework/components/CreateHomeworkModal";
import { fetchSessionEnrollments } from "@admin/domains/exams/api/sessionEnrollments";
import { updateExamEnrollmentRows } from "@admin/domains/exams/api/examEnrollments";
import { putHomeworkAssignments } from "@admin/domains/homework/api/homeworkAssignments";
import api from "@/shared/api/axios";
import AdminOmrBatchUploadBox from "@admin/domains/submissions/components/AdminOmrBatchUploadBox";
import ScorePrintPreviewModal from "@admin/domains/scores/components/ScorePrintPreviewModal";
import ClinicPrintPreviewModal from "@admin/domains/scores/components/ClinicPrintPreviewModal";
import { fetchAttendance } from "@admin/domains/lectures/api/attendance";
import { formatSessionOrderLabel } from "@/shared/ui/session-block";
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
  const [scoreFormat, setScoreFormat] = useState<"raw" | "fraction">("fraction");
  /** 읽기 모드 표시 옵션 펼침 — 첫 사용자에게 압도감 없도록 default collapsed.
      비-default 값일 때는 자동 펼침 (학원장이 자기 설정을 즉시 인식). */
  const [viewOptionsExpanded, setViewOptionsExpanded] = useState(false);
  const hasNonDefaultViewOptions =
    viewFilter !== "all" || scoreDisplayMode !== "total" || scoreFormat !== "fraction";
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

  const sessionTitle = sessionData
    ? formatSessionOrderLabel(sessionData.order, sessionData.title)
    : `차시 #${numericSessionId}`;
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

  // 모달이 생성 결과(자동 등록 인원 포함) toast를 띄움 — 호출 측은 invalidate만.
  const handleExamCreated = (_examId: number) => {
    invalidateScores();
  };

  const handleHomeworkCreated = (_homeworkId: number) => {
    invalidateScores();
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

  // 2026-05-13 학원장 결정 시행: 시험·과제 일괄 종료 폐기.
  // status 단위 UI 가 폐기됐으므로 일괄 종료 핸들러도 제거.
  // project_exam_status_deprecated_2026_05_13 SSOT.

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

  // P1-5: setPresetTotalHw / setPresetSubjectiveHw preset 함수 제거 — 5버튼 segment 단순화로 불필요.

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

  /** 성적 일괄 변경 — Enter / 적용 버튼 단일 진입점.
      2026-05-13 3차: 동일 로직 40+줄이 onEnterConfirm + onClick 양쪽에 중복돼 있던 drift 위험을 한 곳으로. */
  const applyBulkScore = () => {
    const score = Number(bulkScoreValue);
    if (Number.isNaN(score) || score < 0) {
      feedback.error("유효한 점수를 입력해주세요.");
      return;
    }
    const meta = data?.meta;
    const changes: import("@admin/domains/scores/api/scoreDraft").PendingChange[] = [];
    for (const enrollmentId of selectedEnrollmentIds) {
      if (bulkScoreTarget === "exam") {
        for (const exam of meta?.exams ?? []) {
          const maxScore = exam.max_score ?? 100;
          if (score > maxScore) {
            feedback.error(`${exam.title}의 최대 점수(${maxScore})를 초과합니다.`);
            return;
          }
          changes.push({ type: "examTotal", examId: exam.exam_id, enrollmentId, score, maxScore });
        }
      } else {
        for (const hw of meta?.homeworks ?? []) {
          const maxScore = hw.max_score ?? 100;
          if (score > maxScore) {
            feedback.error(`${hw.title}의 최대 점수(${maxScore})를 초과합니다.`);
            return;
          }
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
  };

  const hasSelection = selectedEnrollmentIds.length > 0;
  /* 2026-05-13 회귀 fix: hasExamsOrHomeworks 가 selectionBar 안에서 참조되는데
     이전엔 line 581 (selectionBar 아래) 에서 선언 → TDZ ReferenceError 발생, 페이지 crash.
     selectionBar 보다 위로 이동. */
  const hasExamsOrHomeworks = (data?.meta?.exams?.length ?? 0) > 0 || (data?.meta?.homeworks?.length ?? 0) > 0;
  // 2026-05-13 학원장 호소: "1명 선택됨이 평소에도 0명 선택됨으로 있었으면", "선택 해제 동떨어짐".
  // selectionBar 를 항상 노출(평상시 0명 + 액션 disabled). "선택 해제"는 액션 그룹 직후 자연 위치.
  const selectionBar = (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-center gap-3 pl-1"
        style={{ opacity: hasSelection ? 1 : 0.62, transition: "opacity 0.15s" }}
      >
        <span
          className="text-[13px] font-semibold whitespace-nowrap"
          style={{ color: hasSelection ? "var(--color-brand-primary)" : "var(--color-text-muted)" }}
        >
          {`${selectedEnrollmentIds.length}명 선택됨`}
        </span>

        {/* ── 그룹 1: primary 액션 ── */}
        {/*
          "메시지 발송"(SMS path) 버튼 제거 (2026-05-12) — 학원장 임근혁 보고:
          "메세지 발송기능 프로그램에서 그냥 지워". 알림톡 발송은 "수업결과 알림톡 발송" 단일 경로.
        */}
        <Button
          intent="primary"
          size="sm"
          onClick={async () => {
            const rows = data?.rows ?? [];
            const selectedRows = rows.filter((r) => selectedEnrollmentIds.includes(r.enrollment_id));
            const meta = data?.meta ?? null;
            const lecture = qc.getQueryData<{ title?: string; name?: string }>(["lecture", numericLectureId]);
            const lectureName = lecture?.title ?? lecture?.name ?? "";
            const session = qc.getQueryData<{ title?: string }>(["session-detail", numericSessionId]);
            const sessionTitle = session?.title ?? "";
            const reportOptions = { lectureName, sessionTitle };

            let initialBody: string | undefined;
            let scoreDetail = "";
            let perStudentVars: Record<number, Record<string, string>> | undefined;

            try {
              const templates = await fetchMessageTemplates("grades");
              const hasScoreVars = (body: string) => /#{(시험\d|과제\d|시험성적|시험총점|학생이름)}/.test(body);
              const userDefault = templates.find((t: any) => t.is_user_default && !t.is_system);
              const userWithScoreVars = templates.find((t: any) => !t.is_system && hasScoreVars(t.body));
              const chosenTpl = userDefault ?? userWithScoreVars;

              // 학원장 임근혁 보고(2026-05-12 23:50):
              // 일괄 발송 양식이 첫 학생으로 치환되어 나와 "특정 대상 한 명으로 하드코딩됐다"는 오해.
              // → 양식 본문은 변수 그대로 (#{학생이름}/#{시험1명}/...) 노출.
              // 발송 시 alimtalk_extra_vars + per_student vars로 학생별 자동 치환.
              // 학원장 임근혁 보고(2026-05-12 → 2026-05-13 재발):
              // textarea 에는 양식 본문(변수 그대로)이 떠야 학원장이 "수정 즉시 다수
              // 학생에게 그대로 반영" 의도를 즉시 인식. 첫 학생 데이터로 치환된 텍스트
              // 가 박히면 "특정 한 명으로 하드코딩" 오해. fallback 도 generateScoreReport
              // (첫 학생 텍스트) 가 아니라 buildGenericScoreTemplate (변수 본문) 사용.
              initialBody = chosenTpl
                ? chosenTpl.body
                : buildGenericScoreTemplate(reportOptions);
              scoreDetail = buildScoreDetail(selectedRows[0], meta);

              // 학생별 개별 성적 변수 (모든 학생 대상)
              perStudentVars = {};
              for (const sRow of selectedRows) {
                if (sRow.student_id == null) continue;
                perStudentVars[sRow.student_id] = {
                  시험성적: buildScoreDetail(sRow, meta),
                  학생이름: sRow.student_name || "",
                };
              }
            } catch {
              // 템플릿 조회 실패 시 — 범용 양식 fallback (변수 그대로)
              initialBody = buildGenericScoreTemplate(reportOptions);
              scoreDetail = buildScoreDetail(selectedRows[0], meta);
              perStudentVars = {};
              for (const sRow of selectedRows) {
                if (sRow.student_id == null) continue;
                perStudentVars[sRow.student_id] = {
                  시험성적: buildScoreDetail(sRow, meta),
                  학생이름: sRow.student_name || "",
                };
              }
            }
            openSendMessageModal({
              studentIds: selectedStudentIds,
              recipientLabel: `수업결과 발송 — 선택한 수강생 ${selectedEnrollmentIds.length}명`,
              blockCategory: "grades",
              initialBody,
              alimtalkExtraVars: { 강의명: lectureName, 차시명: sessionTitle, 시험성적: scoreDetail },
              alimtalkExtraVarsPerStudent: perStudentVars,
            });
          }}
          disabled={selectedEnrollmentIds.length === 0}
        >
          수업결과 알림톡 발송
        </Button>

        {/* ── 디바이더 ── */}
        <span className="h-5 w-px bg-[var(--color-border-divider)]" aria-hidden="true" />

        {/* ── 그룹 2: secondary 액션 ──
            2026-05-13 학원장 호소 fix: 편집 모드 아닐 때 모달 진입 후 빨간 안내 = 짜증.
            진입 자체를 편집 모드 ON + 선택 ≥1 일 때만 가능하도록 disabled + tooltip. */}
        <Button
          intent="secondary"
          size="sm"
          onClick={() => setShowBulkScoreModal(true)}
          disabled={selectedEnrollmentIds.length === 0 || !isEditMode}
          title={!isEditMode ? "편집 모드를 켠 뒤 사용할 수 있습니다." : selectedEnrollmentIds.length === 0 ? "학생을 선택하세요." : "선택한 학생의 시험·과제 점수를 한번에 변경합니다."}
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

        {/* 2026-05-13: 선택 해제는 액션 그룹 바로 옆에. 우측 끝 flex spacer 폐기.
            평상시 0명일 때도 노출되며 disabled. */}
        <Button
          intent="ghost"
          size="sm"
          onClick={() => setSelectedEnrollmentIds([])}
          disabled={!hasSelection}
        >
          선택 해제
        </Button>

        {/* 우측 컨텍스트 옵션 — 모드별 분기:
            · 비-편집: 표시 옵션 toggle (펼침시 inline expand)
            · 편집: 시험 합산/주관식 + 과제 켜짐/꺼짐 (별도 row 폐기, 4-layer stack → 3-layer) */}
        {!isEditMode && hasExamsOrHomeworks && (
          <>
            <span className="h-5 w-px bg-[var(--color-border-divider)]" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setViewOptionsExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2 py-1 rounded hover:bg-[var(--color-bg-surface-hover)]"
              aria-expanded={viewOptionsExpanded || hasNonDefaultViewOptions}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: (viewOptionsExpanded || hasNonDefaultViewOptions) ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              표시 옵션
              {hasNonDefaultViewOptions && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[6px] h-[6px] rounded-full bg-[var(--color-brand-primary)]" aria-label="설정 변경됨" />
              )}
            </button>
          </>
        )}
        {isEditMode && (
          <>
            <span className="h-5 w-px bg-[var(--color-border-divider)]" aria-hidden="true" />
            <div className="scores-view-filter-section">
              <span className="scores-view-filter-label">시험</span>
              <div className="scores-display-segment" role="group" aria-label="시험 점수 입력 방식">
                <button type="button" onClick={handleSelectTotal} className="scores-display-segment__btn" aria-pressed={examEditTotal} title="시험 합산 점수만 한 칸으로 입력">합산</button>
                <button type="button" onClick={handleSelectSubjective} className="scores-display-segment__btn" aria-pressed={examEditSubjective} title="주관식 점수만 입력 (객관식은 OMR 자동 채점)">주관식</button>
              </div>
            </div>
            <div className="scores-view-filter-section">
              <span className="scores-view-filter-label">과제</span>
              <div className="scores-display-segment" role="group" aria-label="과제 점수 입력 켜짐/꺼짐">
                <button type="button" onClick={() => { if (!homeworkEdit) handleSelectHomework(); }} className="scores-display-segment__btn" aria-pressed={homeworkEdit} title="과제 점수 입력 가능 상태">켜짐</button>
                <button type="button" onClick={() => { if (homeworkEdit) handleSelectHomework(); }} className="scores-display-segment__btn" aria-pressed={!homeworkEdit} title="과제 점수 입력 차단 상태">꺼짐</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 표시 옵션 펼침 — selectionBar 다음 줄로 inline expand. */}
      {!isEditMode && hasExamsOrHomeworks && (viewOptionsExpanded || hasNonDefaultViewOptions) && (
        <div className="flex flex-wrap items-center gap-3 pl-1 pt-1">
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
        </div>
      )}
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
      {/* ── 그룹 1: 핵심 액션 ──
          P1-3 (2026-05-13): 편집 모드 ON 일 때만 primary 강조. 비편집 상태에선 secondary
          톤으로 두어 학원장이 "이걸 눌렀을 때 뭔가가 저장된다"는 오해를 줄임. */}
      <Button
        type="button"
        intent={isEditMode ? "primary" : "secondary"}
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

      {/* ── 구분선 ── */}
      <span className="h-5 w-px bg-[var(--color-border-divider)]" aria-hidden="true" />

      {/* ── 그룹 2: 추가 ── */}
      <Button
        type="button"
        intent="secondary"
        size="sm"
        onClick={() => { setShowCreateExam(true); }}
      >
        + 시험
      </Button>
      <Button
        type="button"
        intent="secondary"
        size="sm"
        onClick={() => { setShowCreateHomework(true); }}
      >
        + 과제
      </Button>

      {/* ── 구분선 ── */}
      <span className="h-5 w-px bg-[var(--color-border-divider)]" aria-hidden="true" />

      {/* ── 그룹 3: 관리 ── */}
      <Button
        type="button"
        intent="secondary"
        size="sm"
        disabled={enrollingAll || !hasExamsOrHomeworks}
        onClick={() => void handleEnrollAll()}
        title="이 차시의 수강생 전원을 모든 시험·과제의 응시/제출 대상으로 일괄 등록합니다"
      >
        {enrollingAll ? "등록 중…" : "수강생 일괄배정"}
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
              OMR
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
                  <Badge variant="solid" tone="primary" oneChar ariaLabel="시험">시</Badge>
                  {ex.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-text-muted)]"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              성적표 출력
            </button>
            <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-bg-surface-hover)] flex items-center gap-2" onClick={() => { setShowClinicPreview(true); setShowMoreMenu(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-text-muted)]"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              클리닉 대상 보기
            </button>
            {/* 2026-05-13 학원장 결정: 시험·과제 일괄 종료 메뉴 폐기. status UI SSOT 통합. */}
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
              {draft.restoreChangeCount > 0
                ? `임시저장된 변경 ${draft.restoreChangeCount}건이 있습니다. 복원할까요?`
                : "이전에 임시저장된 편집 내용이 있습니다. 복원할까요?"}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              복원하면 이전 편집 내용이 테이블에 다시 적용됩니다. 버리면 현재 서버 데이터만 표시됩니다.
              <br />
              <span className="text-[11px]">※ 1시간 이상 방치된 임시저장은 다음 진입 시 자동으로 폐기됩니다.</span>
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

      {/* 2026-05-13 학원장 호소 fix: 편집 모드 4-layer stack 압도감 해소.
          편집 옵션 토글은 selectionBar 우측에 통합됨. 별도 row 제거. */}

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

      {/* ── 워크플로우 안내: 시험/과제가 없을 때 ──
          P2 (2026-05-13): 자동 등록 사실을 1단계에 흡수, 가이드와 모달 동작 정합.
          기존 2단계 "수강생 일괄배정"은 자동 등록 실패 시 보조 경로로 강등. */}
      {!isLoading && !isError && !hasExamsOrHomeworks && (
        <div
          className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden"
          style={{ boxShadow: "var(--elevation-1)" }}
        >
          <div className="px-5 py-4">
            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">성적 관리 시작하기</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                {
                  step: "1",
                  title: "시험 또는 과제 추가",
                  desc: "'+ 시험' / '+ 과제' 버튼으로 만들면 차시 수강생이 자동으로 응시·제출 대상으로 등록됩니다.",
                  active: true,
                },
                {
                  step: "2",
                  title: "성적 입력",
                  desc: "편집 모드에서 점수를 직접 입력하거나, OMR 스캔본을 업로드해 객관식을 자동 채점하세요.",
                  active: false,
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
                  style={{
                    borderColor: item.active ? "var(--color-brand-primary)" : "var(--color-border-divider)",
                    background: item.active
                      ? "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface))"
                      : "var(--color-bg-surface-soft)",
                  }}
                >
                  <span
                    className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold mt-px"
                    style={{
                      background: item.active ? "var(--color-brand-primary)" : "var(--color-border-divider)",
                      color: item.active ? "#fff" : "var(--color-text-muted)",
                    }}
                  >
                    {item.step}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--color-text-primary)] leading-snug">{item.title}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)] leading-normal">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              자동 등록이 안 됐다면 상단 <strong>'수강생 일괄배정'</strong> 버튼으로 보강할 수 있어요.
            </div>
          </div>
        </div>
      )}

      {/* ── 안내 배너: 시험/과제는 있지만 대상자가 없을 때 ── */}
      {!isLoading && !isError && hasExamsOrHomeworks && displayCount === 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border px-4 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--color-warning) 50%, var(--color-border-divider))",
            background: "color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-surface))",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              응시·제출 대상으로 등록된 수강생이 없습니다
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)] leading-relaxed">
              차시에 수강생이 없거나 시험·과제 생성 시 자동 등록이 실패했을 때 보입니다.
              먼저 차시에 수강생을 등록한 뒤, 상단 <strong>'수강생 일괄배정'</strong> 버튼으로 전원을 응시 대상으로 추가하세요.
              (개별 관리는 시험·과제 상세에서 가능합니다.)
            </div>
          </div>
        </div>
      )}

      {!isLoading && !isError && (
        <SessionScoresPanel
          ref={panelRef}
          sessionId={numericSessionId}
          lectureId={numericLectureId}
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

      {/* 성적 일괄 변경 모달.
          2026-05-13 3차: onEnterConfirm + 적용 버튼 onClick 40+줄 중복 → applyBulkScore 단일화. */}
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
          applyBulkScore();
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
                onClick={applyBulkScore}
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
