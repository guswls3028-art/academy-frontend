import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
} from "lucide-react";

import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { adminExamsQueryKeys } from "@admin/domains/exams/queryKeys";
import {
  applyExamResultImport,
  downloadExamResultTemplate,
  previewExamResultImport,
  type ExamResultImportPreview,
} from "../api/examResultExcel";
import { adminResultsQueryKeys } from "../queryKeys";
import styles from "./ExamResultExcelImport.module.css";

type Props = {
  examId: number;
  examTitle: string;
};

export default function ExamResultExcelImport({ examId, examTitle }: Props) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExamResultImportPreview | null>(null);

  const downloadMutation = useMutation({
    mutationFn: () => downloadExamResultTemplate(examId, examTitle),
    onSuccess: () => feedback.success("시험 결과 엑셀 양식을 내려받았습니다."),
    onError: (error) => feedback.error(extractApiError(error, "엑셀 양식을 내려받지 못했습니다.")),
  });

  const previewMutation = useMutation({
    mutationFn: (file: File) => previewExamResultImport(examId, file),
    onSuccess: (result) => setPreview(result),
    onError: (error) => {
      setPreview(null);
      feedback.error(extractApiError(error, "엑셀 내용을 확인하지 못했습니다."));
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error("엑셀 파일을 다시 선택해 주세요.");
      return applyExamResultImport(examId, selectedFile);
    },
    onSuccess: async (result) => {
      setPreview(result);
      feedback.success(`${result.matched_count}명의 문항별 채점 결과를 반영했습니다.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResults(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamSummary(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestionStats(examId) }),
        queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamResults(examId) }),
      ]);
    },
    onError: (error) => feedback.error(extractApiError(error, "채점 결과를 반영하지 못했습니다.")),
  });

  const clear = () => {
    setSelectedFile(null);
    setPreview(null);
    previewMutation.reset();
    applyMutation.reset();
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setPreview(null);
    applyMutation.reset();
    previewMutation.mutate(file);
  };

  const hasErrors = Boolean(preview && preview.errors.length > 0);
  const isApplied = Boolean(preview?.applied);

  return (
    <section className={styles.card} aria-labelledby="exam-result-excel-title">
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.iconWrap} aria-hidden>
            <FileSpreadsheet size={ICON.lg} />
          </span>
          <div>
            <h3 id="exam-result-excel-title" className={styles.title}>엑셀로 채점 결과 넣기</h3>
            <p className={styles.description}>
              직접 채점한 표에서 틀린 문항만 X로 표시하면 객관식·단답형 결과를 함께 반영합니다.
            </p>
          </div>
        </div>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          leftIcon={<Download size={ICON_FOR_BUTTON.sm} />}
          loading={downloadMutation.isPending}
          onClick={() => downloadMutation.mutate()}
        >
          전용 양식 받기
        </Button>
      </div>

      <div className={styles.guide}>
        <span><strong>정답</strong> 빈칸 또는 O</span>
        <span><strong>오답</strong> X</span>
        <span>기존 엑셀도 이름·연락처·문항 번호 열이 있으면 확인할 수 있어요.</span>
      </div>

      <ExcelUploadZone
        onFileSelect={handleFile}
        selectedFile={selectedFile}
        onClearFile={clear}
        disabled={previewMutation.isPending || applyMutation.isPending}
        hintText=".xlsx · 이름(또는 수강등록ID) + 1, 2, 3… 문항 열"
      />

      {previewMutation.isPending && (
        <div className={styles.stateLine} role="status">
          <Upload size={ICON.sm} aria-hidden />
          학생과 문항을 맞춰보는 중…
        </div>
      )}

      {preview && (
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <div className={styles.previewStatus}>
              {hasErrors ? (
                <AlertTriangle size={ICON.md} aria-hidden />
              ) : (
                <CheckCircle2 size={ICON.md} aria-hidden />
              )}
              <div>
                <strong>
                  {hasErrors
                    ? "수정이 필요한 항목이 있습니다"
                    : isApplied
                      ? "채점 결과를 반영했습니다"
                      : `${preview.matched_count}명 · ${preview.question_count}문항을 확인했습니다`}
                </strong>
                {!hasErrors && preview.overwrite_count > 0 && !isApplied && (
                  <span>기존 결과가 있는 {preview.overwrite_count}명은 새 내용으로 갱신됩니다.</span>
                )}
              </div>
            </div>
            {!hasErrors && !isApplied && (
              <Button
                type="button"
                intent="primary"
                size="sm"
                leftIcon={<Upload size={ICON_FOR_BUTTON.sm} />}
                loading={applyMutation.isPending}
                onClick={() => applyMutation.mutate()}
              >
                {preview.matched_count}명 결과 반영
              </Button>
            )}
            {isApplied && (
              <Button
                type="button"
                intent="secondary"
                size="sm"
                leftIcon={<RotateCcw size={ICON_FOR_BUTTON.sm} />}
                onClick={clear}
              >
                다른 파일 선택
              </Button>
            )}
          </div>

          {preview.errors.length > 0 && (
            <ul className={styles.errorList}>
              {preview.errors.slice(0, 8).map((issue, index) => (
                <li key={`${issue.row ?? "file"}-${issue.field}-${index}`}>
                  {issue.row ? `${issue.row}행 · ` : ""}{issue.message}
                </li>
              ))}
              {preview.errors.length > 8 && (
                <li>그 밖에 {preview.errors.length - 8}개 항목이 더 있습니다.</li>
              )}
            </ul>
          )}

          {!hasErrors && preview.rows.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>학생</th>
                    <th>정답</th>
                    <th>오답 문항</th>
                    <th>점수</th>
                    <th>반영 방식</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((row) => (
                    <tr key={row.enrollment_id}>
                      <td>
                        <StudentNameWithLectureChip
                          name={row.student_name}
                          enrollmentId={row.enrollment_id}
                          lectures={row.lectures.map((lecture) => ({
                            lectureName: lecture.lecture_name,
                            color: lecture.color,
                            chipLabel: lecture.chip_label,
                          }))}
                          density="compact"
                          maxLectureChips={1}
                        />
                      </td>
                      <td>{row.correct_count}개</td>
                      <td>{formatWrongQuestions(row.wrong_questions)}</td>
                      <td><strong>{formatScore(row.total_score)} / {formatScore(row.max_score)}</strong></td>
                      <td>
                        <Badge
                          tone={row.will_overwrite ? "warning" : "success"}
                          size="sm"
                        >
                          {row.will_overwrite ? "기존 결과 갱신" : "새 결과"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 8 && (
                <div className={styles.moreRows}>그 밖에 {preview.rows.length - 8}명도 함께 반영됩니다.</div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function formatWrongQuestions(numbers: number[]): string {
  if (!numbers.length) return "없음";
  const visible = numbers.slice(0, 8).join(", ");
  return numbers.length > 8 ? `${visible} 외 ${numbers.length - 8}개` : visible;
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
