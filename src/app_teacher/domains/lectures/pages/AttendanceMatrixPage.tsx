// PATH: src/app_teacher/domains/lectures/pages/AttendanceMatrixPage.tsx
// 출석 매트릭스 — 모바일 개량: 학생별 카드 + 가로 스크롤 세션 컬럼
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { ChevronLeft, Download } from "@teacher/shared/ui/Icons";
import { downloadAttendanceExcel, fetchAttendanceMatrix } from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import type {
  AttendanceMatrixSession,
  AttendanceMatrixStudent,
} from "@/shared/api/contracts/attendance";
import { formatSessionLabel } from "@/shared/product/sessions/sessionOrdering";
import { teacherLectureQueryKeys } from "../queryKeys";
import styles from "./AttendanceMatrixPage.module.css";

export default function AttendanceMatrixPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const lid = Number(lectureId);
  const isValidLectureId = Number.isFinite(lid);

  const { data: matrix, isLoading } = useQuery({
    queryKey: teacherLectureQueryKeys.attendanceMatrix(lid),
    queryFn: () => fetchAttendanceMatrix(lid),
    enabled: isValidLectureId,
  });

  const exportMut = useMutation({
    mutationFn: () => downloadAttendanceExcel(lid),
    onSuccess: () => teacherToast.success("출석 엑셀을 다운로드했습니다."),
    onError: (e) => teacherToast.error(extractApiError(e, "출석 엑셀을 내려받지 못했습니다.")),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중..." />;

  const sessions: AttendanceMatrixSession[] = matrix?.sessions ?? [];
  const students: AttendanceMatrixStudent[] = matrix?.students ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`${styles.backButton} flex p-1 cursor-pointer`}
        >
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className={`${styles.title} text-[17px] font-bold flex-1`}>출석 현황</h1>
        <button
          type="button"
          onClick={() => exportMut.mutate()}
          disabled={!isValidLectureId || exportMut.isPending}
          className={`${styles.exportButton} flex items-center gap-1 text-[11px] font-semibold cursor-pointer`}
        >
          <Download size={12} /> {exportMut.isPending ? "생성" : "엑셀"}
        </button>
      </div>

      {/* Legend */}
      <div className={`${styles.legend} flex gap-2 flex-wrap text-[10px]`}>
        <span className={styles.legendSuccess}>● 출석</span>
        <span className={styles.legendDanger}>● 결석</span>
        <span className={styles.legendWarn}>● 지각</span>
        <span>○ 미기록</span>
      </div>

      {/* Session headers — fixed reference */}
      {sessions.length > 0 && (
        <div className={styles.scrollArea}>
          <div className={`${styles.matrixLine} flex gap-1 pb-1`}>
            <div className={`${styles.mutedText} w-20 shrink-0 text-[10px] font-bold`}>학생</div>
            {sessions.map((s, i) => (
              <div key={s.id ?? i} className={`${styles.mutedText} w-10 shrink-0 text-center text-[9px] font-semibold`}>
                {formatSessionLabel(s).replace("차시", "차")}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student rows */}
      {students.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {students.map((student) => (
            <div key={student.student_id} className={styles.scrollArea}>
              <div className={`${styles.studentRow} ${styles.matrixLine} flex items-center gap-1`}>
                <div className={`${styles.title} w-20 shrink-0 text-[12px] font-medium truncate`}>
                  {student.name || "이름"}
                </div>
                {sessions.map((session, si) => {
                  const status = student.attendance?.[String(session.id)]?.status;
                  return (
                    <div
                      key={session.id ?? si}
                      className={`${styles.statusCell} ${statusClass(status)} w-10 h-7 shrink-0 flex items-center justify-center rounded text-[10px] font-bold`}
                    >
                      {statusLabel(status)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="출석 데이터가 없습니다" />
      )}

      {/* Summary */}
      {students.length > 0 && (
        <div className={styles.summaryCard}>
          <div className={`${styles.mutedText} text-[12px]`}>
            학생 {students.length}명 · 차시 {sessions.length}개
          </div>
        </div>
      )}
    </div>
  );
}

function statusClass(status: string | undefined): string {
  switch (status) {
    case "PRESENT":
    case "ONLINE":
      return styles.statusPresent;
    case "ABSENT":
      return styles.statusAbsent;
    case "LATE":
      return styles.statusLate;
    default:
      return styles.statusEmpty;
  }
}

function statusLabel(status: string | undefined): string {
  switch (status) {
    case "PRESENT": return "출";
    case "ONLINE": return "온";
    case "ABSENT": return "결";
    case "LATE": return "지";
    case "EARLY_LEAVE": return "조";
    case "SUPPLEMENT": return "보";
    default: return "·";
  }
}
