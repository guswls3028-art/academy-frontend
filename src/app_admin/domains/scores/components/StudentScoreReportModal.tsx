import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, FileUser, ListChecks, Search } from "lucide-react";

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
  const queryClient = useQueryClient();
  const reportRows = useMemo(() => REPORTABLE_ROWS(rows), [rows]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [selectedReportEnrollmentIds, setSelectedReportEnrollmentIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<StudentScoreReportMode>("detailed");
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [mobilePreviewHeight, setMobilePreviewHeight] = useState(600);
  const previewResizeObserverRef = useRef<ResizeObserver | null>(null);

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
    setDownloadProgress(null);
  }, [open, reportRows, initialEnrollmentId, initialEnrollmentIds]);

  useEffect(() => () => {
    previewResizeObserverRef.current?.disconnect();
  }, []);

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
    grades: gradesQuery.data ?? null,
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
    gradesQuery.data,
    sessionTitle,
    lectureTitle,
    attendanceMap,
    tenantName,
    tenantCode,
    tenantLogoUrl,
    primaryColor,
    mode,
  ]);
  const reportPageCount = useMemo(
    () => reportParams ? getStudentScoreReportPageCount(reportParams) : 1,
    [reportParams],
  );
  const detailedPageCount = useMemo(
    () => reportParams
      ? getStudentScoreReportPageCount({ ...reportParams, mode: "detailed" })
      : 2,
    [reportParams],
  );
  const previewSourceHeight = (reportPageCount * 1123) + (Math.max(0, reportPageCount - 1) * 31);
  const workspaceStyle = {
    "--score-report-brand": reportTheme.primary,
    "--score-report-accent": reportTheme.accent,
    "--score-report-on-brand": reportTheme.onPrimary,
    "--score-report-preview-height": `${previewSourceHeight}px`,
    "--score-report-preview-height-70": `${Math.ceil(previewSourceHeight * 0.7)}px`,
    "--score-report-preview-height-60": `${Math.ceil(previewSourceHeight * 0.6)}px`,
    "--score-report-mobile-height": `${mobilePreviewHeight}px`,
  } as CSSProperties;
  const reportHtml = useMemo(
    () => reportParams ? buildStudentScoreReportHtml(reportParams) : "",
    [reportParams],
  );

  const previewStudent = (enrollmentId: number) => {
    setSelectedEnrollmentId(enrollmentId);
    setSelectedReportEnrollmentIds((current) =>
      current.length <= 1 ? [enrollmentId] : current,
    );
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
    previewResizeObserverRef.current?.disconnect();
    const doc = iframe.contentDocument;
    if (!doc) return;

    const updateHeight = () => {
      const pages = Array.from(doc.querySelectorAll<HTMLElement>(".student-report-page"));
      const height = pages.reduce((total, page) => {
        const marginBottom = Number.parseFloat(iframe.contentWindow?.getComputedStyle(page).marginBottom || "0");
        return total + page.getBoundingClientRect().height + marginBottom;
      }, 0);
      if (height > 0) setMobilePreviewHeight(Math.ceil(height));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(doc.body);
    previewResizeObserverRef.current = observer;
  };

  const handleDownload = async () => {
    if (selectedReportRows.length === 0) {
      feedback.info("PDF로 만들 학생을 한 명 이상 선택해 주세요.");
      return;
    }
    setDownloading(true);
    setDownloadProgress({ current: 0, total: selectedReportRows.length });
    try {
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
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="inspect"
      width="min(1480px, calc(100vw - 32px))"
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
        description="미리볼 학생을 바꾸고, 필요한 학생을 여러 명 선택해 한 PDF로 만들 수 있습니다."
        noIcon
      />
      <ModalBody>
        <div className="student-score-report-workspace" style={workspaceStyle}>
          <main className="student-score-report-preview">
            <div className="student-score-report-preview__toolbar">
              <div className="student-score-report-preview__controls">
                <label className="student-score-report-mobile-student">
                  <span>학생</span>
                  <select
                    value={selectedRow?.enrollment_id ?? ""}
                    onChange={(event) => previewStudent(Number(event.target.value))}
                    aria-label="성적표 학생 선택"
                  >
                    {reportRows.map((row) => (
                      <option key={row.enrollment_id} value={row.enrollment_id}>{row.student_name}</option>
                    ))}
                  </select>
                </label>
                <div className="student-score-report-mode" aria-label="성적표 분량">
                  <button
                    type="button"
                    className={mode === "summary" ? "is-active" : ""}
                    aria-pressed={mode === "summary"}
                    onClick={() => setMode("summary")}
                  >
                    요약 1쪽
                  </button>
                  <button
                    type="button"
                    className={mode === "detailed" ? "is-active" : ""}
                    aria-pressed={mode === "detailed"}
                    onClick={() => setMode("detailed")}
                  >
                    상세 {detailedPageCount}쪽
                  </button>
                </div>
              </div>
              <div className="student-score-report-preview__status">
                <span className="student-score-report-brand-state">
                  <i aria-hidden />
                  {tenantName} 디자인
                </span>
                <div className="student-score-report-data-state" role="status" aria-live="polite">
                  {gradesQuery.isFetching
                    ? "누적 성적 불러오는 중…"
                    : gradesQuery.isError
                      ? "누적 성적을 불러오지 못해 현재 차시만 표시합니다."
                      : !hasStudentId
                        ? "누적 성적 연결 정보가 없어 현재 차시만 표시합니다."
                        : "현재 저장된 성적 기준"}
                </div>
              </div>
            </div>

            <details className="student-score-report-mobile-selection">
              <summary>
                <span><ListChecks size={15} aria-hidden /> 출력 학생</span>
                <strong>{selectedReportRows.length}명 선택</strong>
              </summary>
              <div className="student-score-report-mobile-selection__actions">
                <button type="button" onClick={selectAllReports}>전체 선택</button>
                <button type="button" onClick={clearReportSelection}>선택 해제</button>
              </div>
              <div className="student-score-report-mobile-selection__list">
                {reportRows.map((row) => (
                  <label key={row.enrollment_id}>
                    <input
                      type="checkbox"
                      checked={selectedReportSet.has(row.enrollment_id)}
                      onChange={() => toggleReportSelection(row.enrollment_id)}
                    />
                    <span>{row.student_name}</span>
                  </label>
                ))}
              </div>
            </details>

            {selectedRow ? (
              <div className="student-score-report-preview__scroll">
                <div
                  className={`student-score-report-preview__paper student-score-report-preview__paper--${mode} student-score-report-preview__paper--pages-${reportPageCount}`}
                >
                  <iframe
                    title={`${selectedRow.student_name} 개인 성적표 미리보기`}
                    srcDoc={reportHtml}
                    className={`student-score-report-preview__iframe student-score-report-preview__iframe--${mode}`}
                    onLoad={(event) => handlePreviewLoad(event.currentTarget)}
                  />
                </div>
              </div>
            ) : (
              <div className="student-score-report-preview__empty">
                개인 성적표를 만들 학생이 없습니다.
              </div>
            )}
          </main>

          <aside className="student-score-report-students" aria-label="학생 선택">
            <div className="student-score-report-students__header">
              <div>
                <strong>출력 학생 선택</strong>
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
                    </button>
                  </div>
                );
              })}
              {filteredRows.length === 0 && (
                <p className="student-score-report-students__empty">검색 결과가 없습니다.</p>
              )}
            </div>
          </aside>
        </div>
      </ModalBody>
      <ModalFooter
        left={(
          <span className="student-score-report-modal__footnote">
            {selectedRow
              ? `${selectedReportRows.length}명 선택 · 미리보기 ${selectedRow.student_name} · ${mode === "detailed" ? `상세 ${reportPageCount}쪽` : "요약 1쪽"}`
              : "출력할 학생 없음"}
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
              disabled={selectedReportRows.length === 0 || downloading}
              onClick={() => { void handleDownload(); }}
            >
              {downloading
                ? downloadProgress
                  ? `${downloadProgress.current}/${downloadProgress.total}명 준비 중…`
                  : "PDF 생성 중…"
                : selectedReportRows.length > 1
                  ? `${selectedReportRows.length}명 성적표 PDF`
                  : "개인 성적표 PDF"}
            </Button>
          </>
        )}
      />
    </AdminModal>
  );
}
