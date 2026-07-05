/**
 * 과제 제출 — 미완료 시험/과제 목록에서 선택 → 파일 업로드
 *
 * 흐름:
 * 1. 성적 API에서 미합격 과제·시험 목록 표시
 * 2. 학생이 제출 대상 선택
 * 3. 파일(동영상·사진) 선택 후 제출
 * 4. submissions API로 전송 (target_type + target_id)
 */
import { useState, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import { useMyGradesSummary } from "@student/domains/grades/hooks/useMyGradesSummary";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "@student/domains/grades/api/grades.api";
import studentApi from "@student/shared/api/student.api";
import type { Submission } from "@/shared/api/contracts/submissions";
import { IconChevronRight, IconExam, IconClipboard, IconImage, IconVideo } from "@student/shared/ui/icons/Icons";
import { studentToast } from "@student/shared/ui/feedback/studentToast";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { useAuthContext } from "@/auth/context/AuthContext";
import styles from "./SubmitAssignmentPage.module.css";

const ACCEPT = "image/*,video/*";
const MAX_SIZE_MB = 100;

type SelectedTarget =
  { type: "homework"; id: number; title: string; enrollmentId: number };

export default function SubmitAssignmentPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthContext();
  const isParent = user?.tenantRole === "parent";

  const [selected, setSelected] = useState<SelectedTarget | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: grades, isLoading: gradesLoading } = useMyGradesSummary({ enabled: !isParent });

  // 미합격 과제·시험 필터
  const unfinishedHomeworks = useMemo(
    () => (grades?.homeworks ?? []).filter((h) => (
      h.passed === false
      || h.achievement === "FAIL"
      || h.achievement === "NOT_SUBMITTED"
    )),
    [grades?.homeworks],
  );
  const unfinishedExams = useMemo(
    () => (grades?.exams ?? []).filter((e) => (
      e.is_pass === false
      || e.achievement === "FAIL"
      || e.achievement === "NOT_SUBMITTED"
      || e.meta_status === "NOT_SUBMITTED"
      || e.total_score == null
    )),
    [grades?.exams],
  );

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("제출 대상을 선택해 주세요.");
      if (!selectedFile) throw new Error("파일을 선택해 주세요.");
      if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      }
      const isVideo = selectedFile.type.startsWith("video/");
      const kind = isVideo ? "homework_video" : "homework_image";

      const fd = new FormData();
      fd.append("source", kind);
      fd.append("target_type", selected.type);
      fd.append("target_id", String(selected.id));
      fd.append("enrollment_id", String(selected.enrollmentId));
      fd.append("file", selectedFile);

      const res = await studentApi.post<Submission>(
        "/submissions/submissions/",
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data;
    },
    onSuccess: () => {
      setSelectedFile(null);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: studentQueryKeys.gradesSummary });
      studentToast.success(
        selected ? `${selected.title} 제출이 완료되었습니다.` : "제출이 완료되었습니다."
      );
    },
    onError: (e: unknown) => {
      const errResp = (e as { response?: { data?: Record<string, unknown> } } | null)?.response?.data;
      const detail = (errResp?.detail as string | undefined) || (errResp?.message as string | undefined);
      const fieldErrors = errResp;
      let msg = "제출에 실패했습니다.";
      if (typeof detail === "string") msg = detail;
      else if (fieldErrors && typeof fieldErrors === "object" && !detail) {
        const parts = Object.entries(fieldErrors)
          .filter(([k]) => k !== "detail")
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
        if (parts.length) msg = parts.join(" · ");
      }
      else if ((e as { message?: string } | null)?.message) msg = (e as { message: string }).message;
      setError(msg);
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const canSubmit = !!selected && !!selectedFile && !uploadMut.isPending;

  if (isParent) {
    return (
      <StudentPageShell
        title="과제 제출"
        onBack={() => window.history.back()}
      >
        <EmptyState
          title="학부모 계정은 직접 제출할 수 없습니다."
          description="자녀 본인 계정으로 로그인 후 제출해 주세요. 자녀 진척 확인은 성적 페이지에서 가능합니다."
        />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      title="과제 제출"
      description="미완료 과제는 파일로, 시험은 온라인 답안으로 제출하세요."
      onBack={() => window.history.back()}
    >
      <div className={`stu-section stu-section--nested ${styles.section}`}>
        {/* 에러 / 성공 메시지 */}
        {(uploadMut.isError || error) && (
          <div role="alert" className={styles.errorMessage}>
            {error || (uploadMut.error instanceof Error ? uploadMut.error.message : "제출에 실패했습니다.")}
          </div>
        )}
        {uploadMut.isSuccess && (
          <div className={styles.successMessage}>
            <span>제출이 완료되었습니다.</span>
            <Link to="/student/grades" className={styles.successLink}>
              성적 확인
              <IconChevronRight className={styles.successLinkIcon} aria-hidden="true" />
            </Link>
          </div>
        )}

        {/* STEP 1: 제출 대상 선택 */}
        <div data-guide="submit-target">
          <div className={styles.stepLabel}>
            1. 제출 대상 선택
          </div>

          {gradesLoading && (
            <div className={`stu-muted ${styles.loadingText}`}>불러오는 중…</div>
          )}

          {!gradesLoading && unfinishedHomeworks.length === 0 && unfinishedExams.length === 0 && (
            <div className={styles.emptyTarget}>
              제출할 미완료 과제·시험이 없습니다.
            </div>
          )}

          <div className={styles.targetList}>
            {/* 미완료 과제 */}
            {unfinishedHomeworks.map((h: MyHomeworkGradeSummary) => {
              const isSelected = selected?.type === "homework" && selected.id === h.homework_id;
              return (
                <button
                  key={`hw-${h.homework_id}`}
                  type="button"
                  onClick={() => setSelected({ type: "homework", id: h.homework_id, title: h.title, enrollmentId: h.enrollment_id })}
                  className={styles.targetItem}
                  data-selected={isSelected}
                >
                  <span className={styles.targetIcon}>
                    <IconClipboard className={styles.targetIconSvg} />
                  </span>
                  <span className={styles.targetBadge}>
                    과제
                  </span>
                  <span className={styles.targetTitle}>
                    {h.title}
                  </span>
                  {h.lecture_title && (
                    <span className={`stu-muted ${styles.targetLecture}`}>
                      {h.lecture_title}
                    </span>
                  )}
                </button>
              );
            })}

            {/* 미완료 시험 */}
            {unfinishedExams.map((e: MyExamGradeSummary) => {
              return (
                <Link
                  key={`ex-${e.exam_id}`}
                  to={`/student/exams/${e.exam_id}/submit`}
                  className={styles.targetItem}
                >
                  <span className={styles.targetIcon}>
                    <IconExam className={styles.targetIconSvg} />
                  </span>
                  <span className={styles.targetBadge}>
                    시험
                  </span>
                  <span className={styles.targetTitle}>
                    {e.title}
                  </span>
                  {e.lecture_title && (
                    <span className={`stu-muted ${styles.targetLecture}`}>
                      {e.lecture_title}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* STEP 2: 파일 선택 */}
        {selected && (
          <div data-guide="submit-file">
            <div className={styles.stepLabel}>
              2. 파일 선택
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={onFileChange}
              className={styles.hiddenInput}
            />

            <button
              type="button"
              className={`stu-btn stu-btn--secondary ${styles.fileButton}`}
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택 (동영상·사진, 최대 {MAX_SIZE_MB}MB)
            </button>

            {selectedFile && (
              <div className={styles.selectedFile}>
                <span className={styles.selectedFileInfo}>
                  {selectedFile.type.startsWith("video/")
                    ? <IconVideo className={styles.selectedFileIcon} />
                    : <IconImage className={styles.selectedFileIcon} />}
                  <span className={styles.fileName}>
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                  </span>
                </span>
                <button
                  type="button"
                  className="stu-btn stu-btn--ghost stu-btn--sm"
                  onClick={() => { setSelectedFile(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: 제출 */}
        {selected && (
          <div className={styles.submitRow}>
            <div className={styles.submitSummary}>
              제출 대상: <b>과제 · {selected.title}</b>
            </div>
            <button
              type="button"
              data-guide="submit-btn"
              className={`stu-btn stu-btn--primary ${styles.submitButton}`}
              disabled={!canSubmit}
              onClick={() => uploadMut.mutate()}
            >
              {uploadMut.isPending ? "제출 중…" : "제출하기"}
            </button>
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}
