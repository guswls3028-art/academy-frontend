import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, ChevronRight, Download, FileUser, Search } from "lucide-react";

import type {
  SessionScoreMeta,
  SessionScoreRow,
} from "@/shared/api/contracts/sessionScores";
import { fetchAdminStudentGrades } from "@/shared/api/contracts/studentGrades";
import { adminStudentsQueryKeys } from "@admin/domains/students/queryKeys";
import { useProgram } from "@/shared/program";
import { getTenantBranding, getTenantIdFromCode } from "@/shared/tenant";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { listOmrReviewIssuesPage } from "@admin/domains/results/public/omrReview";
import { scoresQueryKeys } from "../api/queryKeys";
import {
  buildStudentScoreReportHtml,
  downloadStudentScoreReportPdf,
  downloadStudentScoreReportsPdf,
  getStudentScoreReportPageCount,
  type StudentScoreReportParams,
  type StudentScoreReportMode,
} from "../utils/studentScoreReportGenerator";
import { resolveStudentScoreReportTheme } from "../utils/studentScoreReportTheme";
import "./StudentScoreReportModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  rows: SessionScoreRow[];
  meta: SessionScoreMeta;
  sessionTitle: string;
  lectureTitle: string;
  attendanceMap?: Record<number, string>;
  initialEnrollmentId?: number | null;
  initialEnrollmentIds?: number[];
};

const REPORTABLE_ROWS = (rows: SessionScoreRow[]) =>
  rows.filter((row) => (row.exams?.length ?? 0) > 0 || (row.homeworks?.length ?? 0) > 0);

const PAPER_WIDTH = 794;

function normalizeSearch(value: string): string {
  return value.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export default function StudentScoreReportModal({
  open,
  onClose,
  rows,
  meta,
  sessionTitle,
  lectureTitle,
  attendanceMap,
  initialEnrollmentId,
  initialEnrollmentIds,
}: Props) {
  const { program } = useProgram();
  const navigate = useNavigate();
  const { lectureId, sessionId } = useParams<{ lectureId: string; sessionId: string }>();
  const queryClient = useQueryClient();
  const omrExamIds = useMemo(() => meta.exams
    .filter((exam) => exam.grading_mode !== "written")
    .map((exam) => exam.exam_id), [meta.exams]);
  const reportRows = useMemo(() => REPORTABLE_ROWS(rows), [rows]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [selectedReportEnrollmentIds, setSelectedReportEnrollmentIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<StudentScoreReportMode>("detailed");
  const [showStudentList, setShowStudentList] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [previewSize, setPreviewSize] = useState({ height: 1123, scale: 1 });
  const studentListId = useId();
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const downloadInProgressRef = useRef(false);
  const previewCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    const requestedIds = new Set(
      (initialEnrollmentIds?.length ?? 0) > 0
        ? initialEnrollmentIds
        : initialEnrollmentId != null
          ? [initialEnrollmentId]
          : [],
    );
    const initialRows = reportRows.filter((row) => requestedIds.has(row.enrollment_id));
    const initialRow = initialRows[0] ?? reportRows[0];
    setSelectedEnrollmentId(initialRow?.enrollment_id ?? null);
    setSelectedReportEnrollmentIds(
      initialRows.length > 0
        ? initialRows.map((row) => row.enrollment_id)
        : initialRow
          ? [initialRow.enrollment_id]
          : [],
    );
    setSearch("");
    setMode("detailed");
    setShowStudentList(initialRows.length > 1);
    setDownloadProgress(null);
  }, [open, reportRows, initialEnrollmentId, initialEnrollmentIds]);

  useEffect(() => {
    if (!open) return;
    return () => previewCleanupRef.current?.();
  }, [open]);

  const selectedRow = useMemo(
    () => reportRows.find((row) => row.enrollment_id === selectedEnrollmentId) ?? reportRows[0] ?? null,
    [reportRows, selectedEnrollmentId],
  );
  const studentId = Number(selectedRow?.student_id);
  const hasStudentId = Number.isFinite(studentId) && studentId > 0;
  const gradesQuery = useQuery({
    queryKey: adminStudentsQueryKeys.studentGrades(studentId),
    queryFn: () => fetchAdminStudentGrades(studentId),
    enabled: open && hasStudentId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const previewGrades = gradesQuery.isError ? null : gradesQuery.data ?? null;

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return reportRows;
    return reportRows.filter((row) => normalizeSearch(row.student_name).includes(query));
  }, [reportRows, search]);
  const selectedReportSet = useMemo(
    () => new Set(selectedReportEnrollmentIds),
    [selectedReportEnrollmentIds],
  );
  const selectedReportRows = useMemo(
    () => reportRows.filter((row) => selectedReportSet.has(row.enrollment_id)),
    [reportRows, selectedReportSet],
  );
  const selectedOmrIds = useMemo(() => selectedReportRows.map((row) => row.enrollment_id).sort((a, b) => a - b), [selectedReportRows]);
  const omrPreflight = useQuery({
    queryKey: scoresQueryKeys.studentScoreReportOmrPreflight(omrExamIds, selectedOmrIds),
    queryFn: async () => {
      const checks = [];
      for (const examId of omrExamIds) {
        for (let index = 0; index < selectedOmrIds.length; index += 500) {
          const enrollmentIds = selectedOmrIds.slice(index, index + 500);
          const page = await listOmrReviewIssuesPage(examId, {
            enrollmentIds,
            includeUnbound: index === 0,
          });
          checks.push({ examId, page });
        }
      }
      return checks;
    },
    enabled: open && omrExamIds.length > 0 && selectedOmrIds.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const omrCheckFailed = omrExamIds.length > 0 && selectedOmrIds.length > 0 && omrPreflight.isError;
  const omrCheckBusy = omrExamIds.length > 0 && selectedOmrIds.length > 0 && omrPreflight.isFetching;
  const omrIssuesTotal = (omrPreflight.data ?? []).reduce((count, { page }) => count + page.total, 0);
  const omrIssues = (omrPreflight.data ?? []).flatMap(({ examId, page }) => page.items.map((row) => ({ examId, row })));

  const selectedIndex = selectedRow
    ? reportRows.findIndex((row) => row.enrollment_id === selectedRow.enrollment_id)
    : -1;
  const tenantName = program?.display_name?.trim() || "Academy";
  const tenantCode = program?.tenantCode?.trim() || "";
  const tenantId = getTenantIdFromCode(tenantCode);
  const staticBranding = tenantId ? getTenantBranding(tenantId) : null;
  const tenantLogoUrl = program?.ui_config?.logo_url?.trim() || staticBranding?.logoUrl?.trim() || "";
  const primaryColor = program?.ui_config?.primary_color?.trim() || "";
  const reportTheme = useMemo(() => resolveStudentScoreReportTheme({
    tenantCode,
    primaryColor,
    logoUrl: tenantLogoUrl,
  }), [primaryColor, tenantCode, tenantLogoUrl]);
  const reportParams = useMemo(() => selectedRow ? ({
    row: selectedRow,
    meta,
    grades: previewGrades,
    sessionTitle,
    lectureTitle,
    attendanceStatus: attendanceMap?.[selectedRow.enrollment_id] ?? null,
    tenantName,
    tenantCode,
    tenantLogoUrl,
    primaryColor,
    mode,
  }) : null, [
    selectedRow,
    meta,
    previewGrades,
    sessionTitle,
    lectureTitle,
    attendanceMap,
    tenantName,
    tenantCode,
    tenantLogoUrl,
    primaryColor,
    mode,
  ]);
  const detailedPageCount = useMemo(
    () => reportParams
      ? getStudentScoreReportPageCount({ ...reportParams, mode: "detailed" })
      : 2,
    [reportParams],
  );
  const workspaceStyle = {
    "--score-report-brand": reportTheme.primary,
    "--score-report-on-brand": reportTheme.onPrimary,
    "--score-report-paper-width": `${PAPER_WIDTH}px`,
    "--score-report-preview-height": `${previewSize.height}px`,
    "--score-report-preview-scale": previewSize.scale,
  } as CSSProperties;
  const reportHtml = useMemo(
    () => reportParams ? buildStudentScoreReportHtml(reportParams) : "",
    [reportParams],
  );

  const previewStudent = (enrollmentId: number) => {
    if (enrollmentId !== selectedRow?.enrollment_id) previewScrollRef.current?.scrollTo(0, 0);
    setSelectedEnrollmentId(enrollmentId);
  };

  const changeMode = (nextMode: StudentScoreReportMode) => {
    if (nextMode !== mode) previewScrollRef.current?.scrollTo(0, 0);
    setMode(nextMode);
  };

  const handleMove = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const next = reportRows[selectedIndex + direction];
    if (next) previewStudent(next.enrollment_id);
  };

  const toggleReportSelection = (enrollmentId: number) => {
    setSelectedReportEnrollmentIds((current) =>
      current.includes(enrollmentId)
        ? current.filter((id) => id !== enrollmentId)
        : [...current, enrollmentId],
    );
  };

  const selectAllReports = () => {
    setSelectedReportEnrollmentIds(reportRows.map((row) => row.enrollment_id));
  };

  const clearReportSelection = () => {
    setSelectedReportEnrollmentIds([]);
  };

  const handlePreviewLoad = (iframe: HTMLIFrameElement) => {
    previewCleanupRef.current?.();
    const doc = iframe.contentDocument;
    const paper = iframe.parentElement;
    const scrollRegion = paper?.parentElement;
    if (!doc?.body || !paper || !scrollRegion || !doc.querySelector(".student-report-page")) return;
    doc.documentElement.style.overflow = "hidden";

    const updatePreviewSize = () => {
      const height = Math.ceil(doc.body.getBoundingClientRect().height);
      const scale = Math.min(1, paper.clientWidth / PAPER_WIDTH);
      if (height > 0 && scale > 0) {
        setPreviewSize((current) => current.height === height && current.scale === scale ? current : { height, scale });
      }
    };

    updatePreviewSize();
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(updatePreviewSize);
    });
    observer.observe(doc.body);
    observer.observe(scrollRegion);
    previewCleanupRef.current = () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
    };
  };

  const handleDownload = async () => {
    if (downloadInProgressRef.current) return;
    if (selectedReportRows.length === 0) {
      feedback.info("PDF로 만들 학생을 한 명 이상 선택해 주세요.");
      return;
    }
    downloadInProgressRef.current = true;
    setDownloading(true);
    try {
      const freshOmr = omrExamIds.length > 0 ? await omrPreflight.refetch() : null;
      if (freshOmr?.isError || freshOmr?.data?.some(({ page }) => page.total > 0)) {
        feedback.warning("성적표를 만들기 전에 OMR 인식·학생 연결 문제를 확인해 주세요.");
        return;
      }
      const paramsList: StudentScoreReportParams[] = [];
      for (let index = 0; index < selectedReportRows.length; index += 1) {
        const row = selectedReportRows[index];
        setDownloadProgress({ current: index + 1, total: selectedReportRows.length });
        const rowStudentId = Number(row.student_id);
        const grades = Number.isFinite(rowStudentId) && rowStudentId > 0
          ? await queryClient.fetchQuery({
              queryKey: adminStudentsQueryKeys.studentGrades(rowStudentId),
              queryFn: () => fetchAdminStudentGrades(rowStudentId),
              staleTime: 0,
            })
          : null;
        paramsList.push({
          row,
          meta,
          grades,
          sessionTitle,
          lectureTitle,
          attendanceStatus: attendanceMap?.[row.enrollment_id] ?? null,
          tenantName,
          tenantCode,
          tenantLogoUrl,
          primaryColor,
          mode,
        });
      }
      if (paramsList.length === 1) {
        await downloadStudentScoreReportPdf(paramsList[0]);
        feedback.success(`${paramsList[0].row.student_name} 학생의 개인 성적표를 다운로드했습니다.`);
      } else {
        await downloadStudentScoreReportsPdf(paramsList);
        feedback.success(`${paramsList.length}명의 개인 성적표를 한 PDF로 다운로드했습니다.`);
      }
    } catch (error: unknown) {
      feedback.error(error instanceof Error ? error.message : "개인 성적표 PDF 생성에 실패했습니다.");
    } finally {
      downloadInProgressRef.current = false;
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="inspect"
      width="min(1200px, calc(100vw - 16px))"
      className="student-score-report-modal"
      noMinimize
    >
      <ModalHeader
        type="inspect"
        title={(
          <span className="student-score-report-modal__title">
            <FileUser size={20} aria-hidden />
            개인 성적표
          </span>
        )}
        noIcon
      />
      <ModalBody>
        {(omrCheckBusy || omrCheckFailed || omrIssuesTotal > 0) && (
          <div role={omrCheckFailed || omrIssuesTotal > 0 ? "alert" : "status"} className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            {omrCheckBusy ? "출력 전 OMR 검토 상태를 확인하는 중…" : omrCheckFailed ? (
              <>
                <strong>OMR 검토 현황을 불러오지 못했습니다.</strong>
                <Button type="button" intent="secondary" size="sm" onClick={() => void omrPreflight.refetch()}>다시 확인</Button>
              </>
            ) : (
              <>
                <strong>OMR {omrIssuesTotal}건을 먼저 확인해 주세요.</strong>
                <p className="mt-1">{omrIssues.slice(0, 4).map(({ examId, row }) => `${meta.exams.find((exam) => exam.exam_id === examId)?.title ?? "시험"}: ${row.student_name || `미식별 스캔 #${row.id}`}`).join(", ")}{omrIssuesTotal > 4 ? ` 외 ${omrIssuesTotal - 4}건` : ""} · 학생 식별 또는 답안 판독이 완료되면 성적표를 만들 수 있습니다.</p>
                <Button type="button" intent="secondary" size="sm" onClick={() => {
                  const first = omrIssues[0];
                  if (first && lectureId && sessionId) {
                    onClose();
                    navigate(`/workspace/lectures/${lectureId}/sessions/${sessionId}/exams?examId=${first.examId}&examTab=results&reviewOmr=1&reviewSubmissionId=${first.row.id}`);
                  }
                }}>시험 OMR 검토로 이동</Button>
              </>
            )}
          </div>
        )}
        <div className={`student-score-report-workspace${showStudentList ? " is-student-list-open" : ""}`} style={workspaceStyle}>
          <div className="student-score-report-preview__toolbar">
            <div className="student-score-report-preview__controls">
              <div className="student-score-report-preview__student-actions">
                <label className="student-score-report-student">
                  <span>{showStudentList || selectedReportRows.length > 1 ? "미리볼 학생" : "학생"}</span>
                  <select
                    value={selectedRow?.enrollment_id ?? ""}
                    disabled={!selectedRow}
                    onChange={(event) => {
                      const enrollmentId = Number(event.target.value);
                      previewStudent(enrollmentId);
                      if (!showStudentList && selectedReportRows.length <= 1) {
                        setSelectedReportEnrollmentIds([enrollmentId]);
                      }
                    }}
                    aria-label="성적표 학생 선택"
                  >
                    {reportRows.map((row) => (
                      <option key={row.enrollment_id} value={row.enrollment_id}>{row.student_name}</option>
                    ))}
                  </select>
                </label>
                {reportRows.length > 1 && (
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    aria-expanded={showStudentList}
                    aria-controls={showStudentList ? studentListId : undefined}
                    onClick={() => setShowStudentList((current) => !current)}
                  >
                    {showStudentList ? "학생 목록 닫기" : `여러 명 출력${selectedReportRows.length > 1 ? ` · ${selectedReportRows.length}명` : ""}`}
                  </Button>
                )}
              </div>
              <div className="student-score-report-mode" role="group" aria-label="성적표 분량">
                <button
                  type="button"
                  className={mode === "summary" ? "is-active" : ""}
                  aria-pressed={mode === "summary"}
                  onClick={() => changeMode("summary")}
                >
                  요약 1쪽
                </button>
                <button
                  type="button"
                  className={mode === "detailed" ? "is-active" : ""}
                  aria-pressed={mode === "detailed"}
                  onClick={() => changeMode("detailed")}
                >
                  상세 {detailedPageCount}쪽
                </button>
              </div>
            </div>
            <div className="student-score-report-preview__status">
              <div className="student-score-report-data-state" role="status" aria-live="polite">
                {gradesQuery.isFetching
                  ? "누적 성적 불러오는 중…"
                  : gradesQuery.isError
                    ? "누적 성적 조회 실패 · 현재 차시만 미리보기"
                    : !hasStudentId
                      ? "누적 성적 연결 정보가 없어 현재 차시만 표시합니다."
                      : "현재 저장된 성적 기준"}
              </div>
              {gradesQuery.isError && !gradesQuery.isFetching && (
                <Button type="button" intent="secondary" size="sm" onClick={() => void gradesQuery.refetch()}>다시 불러오기</Button>
              )}
            </div>
          </div>

          {showStudentList && <aside id={studentListId} className="student-score-report-students" aria-label="출력할 학생">
            <div className="student-score-report-students__header">
              <div>
                <strong>출력할 학생</strong>
                <span>{selectedReportRows.length}/{reportRows.length}명</span>
              </div>
              <div className="student-score-report-students__nav">
                <button
                  type="button"
                  aria-label="이전 학생"
                  onClick={() => handleMove(-1)}
                  disabled={selectedIndex <= 0}
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="다음 학생"
                  onClick={() => handleMove(1)}
                  disabled={selectedIndex < 0 || selectedIndex >= reportRows.length - 1}
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            </div>
            <label className="student-score-report-students__search">
              <Search size={15} aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="학생 이름 검색"
                aria-label="성적표 학생 검색"
              />
            </label>
            <p className="student-score-report-students__hint">체크한 학생만 PDF에 포함됩니다. 이름을 누르면 미리봅니다.</p>
            <div className="student-score-report-students__selection-actions">
              <button type="button" onClick={selectAllReports}>전체 선택</button>
              <button type="button" onClick={clearReportSelection}>선택 해제</button>
            </div>
            <div className="student-score-report-students__list">
              {filteredRows.map((row) => {
                const previewSelected = row.enrollment_id === selectedRow?.enrollment_id;
                const reportSelected = selectedReportSet.has(row.enrollment_id);
                return (
                  <div
                    key={row.enrollment_id}
                    className={`student-score-report-students__row ${previewSelected ? "is-previewed" : ""}`}
                  >
                    <label className="student-score-report-students__check">
                      <input
                        type="checkbox"
                        checked={reportSelected}
                        aria-label={`${row.student_name} 성적표 출력 선택`}
                        onChange={() => toggleReportSelection(row.enrollment_id)}
                      />
                    </label>
                    <button
                      type="button"
                      className={previewSelected ? "is-selected" : ""}
                      aria-pressed={previewSelected}
                      onClick={() => previewStudent(row.enrollment_id)}
                    >
                      <StudentNameWithLectureChip
                        name={row.student_name}
                        profilePhotoUrl={row.profile_photo_url}
                        avatarSize={28}
                        lectures={[{
                          lectureName: row.lecture_title || lectureTitle,
                          color: row.lecture_color,
                          chipLabel: row.lecture_chip_label,
                        }]}
                        maxLectureChips={1}
                        density="compact"
                      />
                      {previewSelected && <span className="student-score-report-students__preview-label">미리보는 중</span>}
                    </button>
                  </div>
                );
              })}
              {filteredRows.length === 0 && (
                <p className="student-score-report-students__empty">검색 결과가 없습니다.</p>
              )}
            </div>
          </aside>}
          {selectedRow ? (
            <div
              ref={previewScrollRef}
              className="student-score-report-preview__scroll"
              role="region"
              aria-label="성적표 미리보기"
              tabIndex={0}
            >
              <div className="student-score-report-preview__paper">
                <iframe
                  title={`${selectedRow.student_name} 개인 성적표 미리보기`}
                  srcDoc={reportHtml}
                  className="student-score-report-preview__iframe"
                  onLoad={(event) => handlePreviewLoad(event.currentTarget)}
                />
              </div>
            </div>
          ) : (
            <div className="student-score-report-preview__empty">
              개인 성적표를 만들 학생이 없습니다.
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter
        left={(
          <span className="student-score-report-modal__footnote">
            {selectedReportRows.length > 0
              ? `${selectedReportRows.length === 1 ? selectedReportRows[0].student_name : `${selectedReportRows.length}명`} 출력 · ${mode === "detailed" ? "상세" : "요약"}`
              : "출력할 학생을 선택해 주세요"}
          </span>
        )}
        right={(
          <>
            <Button intent="secondary" size="sm" onClick={onClose}>
              닫기
            </Button>
            <Button
              intent="primary"
              size="sm"
              leftIcon={<Download size={ICON_FOR_BUTTON.sm} aria-hidden />}
              disabled={selectedReportRows.length === 0 || downloading || omrCheckBusy || omrCheckFailed || omrIssuesTotal > 0}
              onClick={() => { void handleDownload(); }}
            >
              {downloading
                ? downloadProgress
                  ? `${downloadProgress.current}/${downloadProgress.total}명 준비 중…`
                  : "PDF 생성 중…"
                : selectedReportRows.length > 1
                  ? `${selectedReportRows.length}명 성적표 PDF 다운로드`
                  : "개인 성적표 PDF 다운로드"}
            </Button>
          </>
        )}
      />
    </AdminModal>
  );
}
