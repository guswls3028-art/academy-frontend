import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, FileUser, Search } from "lucide-react";

import type {
  SessionScoreMeta,
  SessionScoreRow,
} from "@/shared/api/contracts/sessionScores";
import { fetchAdminStudentGrades } from "@/shared/api/contracts/studentGrades";
import { adminStudentsQueryKeys } from "@admin/domains/students/queryKeys";
import { useProgram } from "@/shared/program";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import {
  buildStudentScoreReportHtml,
  downloadStudentScoreReportPdf,
  type StudentScoreReportMode,
} from "../utils/studentScoreReportGenerator";
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
}: Props) {
  const { program } = useProgram();
  const reportRows = useMemo(() => REPORTABLE_ROWS(rows), [rows]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<StudentScoreReportMode>("detailed");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialRow = reportRows.find((row) => row.enrollment_id === initialEnrollmentId) ?? reportRows[0];
    setSelectedEnrollmentId(initialRow?.enrollment_id ?? null);
    setSearch("");
    setMode("detailed");
  }, [open, reportRows, initialEnrollmentId]);

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
    staleTime: 30_000,
  });

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return reportRows;
    return reportRows.filter((row) => normalizeSearch(row.student_name).includes(query));
  }, [reportRows, search]);

  const selectedIndex = selectedRow
    ? reportRows.findIndex((row) => row.enrollment_id === selectedRow.enrollment_id)
    : -1;
  const tenantName = program?.display_name?.trim() || "Academy";
  const reportParams = useMemo(() => selectedRow ? ({
    row: selectedRow,
    meta,
    grades: gradesQuery.data ?? null,
    sessionTitle,
    lectureTitle,
    attendanceStatus: attendanceMap?.[selectedRow.enrollment_id] ?? null,
    tenantName,
    mode,
  }) : null, [
    selectedRow,
    meta,
    gradesQuery.data,
    sessionTitle,
    lectureTitle,
    attendanceMap,
    tenantName,
    mode,
  ]);
  const reportHtml = useMemo(
    () => reportParams ? buildStudentScoreReportHtml(reportParams) : "",
    [reportParams],
  );

  const handleMove = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const next = reportRows[selectedIndex + direction];
    if (next) setSelectedEnrollmentId(next.enrollment_id);
  };

  const handleDownload = async () => {
    if (!reportParams) return;
    setDownloading(true);
    try {
      await downloadStudentScoreReportPdf(reportParams);
      feedback.success(`${reportParams.row.student_name} 학생의 개인 성적표를 다운로드했습니다.`);
    } catch (error: unknown) {
      feedback.error(error instanceof Error ? error.message : "개인 성적표 PDF 생성에 실패했습니다.");
    } finally {
      setDownloading(false);
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
        description="학생을 바꾸면 현재 차시와 같은 강의의 누적 시험 기록을 즉시 다시 구성합니다."
        noIcon
      />
      <ModalBody>
        <div className="student-score-report-workspace">
          <main className="student-score-report-preview">
            <div className="student-score-report-preview__toolbar">
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
                  상세 2쪽
                </button>
              </div>
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

            {selectedRow ? (
              <div className="student-score-report-preview__scroll">
                <div
                  className={`student-score-report-preview__paper student-score-report-preview__paper--${mode}`}
                >
                  <iframe
                    title={`${selectedRow.student_name} 개인 성적표 미리보기`}
                    srcDoc={reportHtml}
                    className={`student-score-report-preview__iframe student-score-report-preview__iframe--${mode}`}
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
                <strong>학생 선택</strong>
                <span>{reportRows.length}명</span>
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
            <div className="student-score-report-students__list">
              {filteredRows.map((row) => {
                const selected = row.enrollment_id === selectedRow?.enrollment_id;
                return (
                  <button
                    type="button"
                    key={row.enrollment_id}
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    onClick={() => setSelectedEnrollmentId(row.enrollment_id)}
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
              ? `${selectedRow.student_name} · ${mode === "detailed" ? "상세 2쪽" : "요약 1쪽"} · A4 세로`
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
              disabled={!reportParams || downloading || gradesQuery.isFetching}
              onClick={() => { void handleDownload(); }}
            >
              {downloading ? "PDF 생성 중…" : "개인 성적표 PDF"}
            </Button>
          </>
        )}
      />
    </AdminModal>
  );
}
