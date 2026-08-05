import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import ExamPdfUploadModal from "@admin/domains/exams/components/ExamPdfUploadModal";
import ExamSegmentationReview from "@admin/domains/exams/components/ExamSegmentationReview";

import { ensureHomeworkSourceExam } from "../api/adminHomework";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { QUERY_KEYS } from "../queryKeys";

export default function HomeworkAssetsPanel({ homeworkId }: { homeworkId: number }) {
  const queryClient = useQueryClient();
  const homeworkQuery = useAdminHomework(homeworkId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const sourceStatus = homeworkQuery.data?.source_status;
  const refetchHomework = homeworkQuery.refetch;

  useEffect(() => {
    if (sourceStatus !== "processing") return undefined;
    const timer = window.setInterval(() => {
      void refetchHomework();
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [sourceStatus, refetchHomework]);

  const ensureSource = useMutation({
    mutationFn: () => ensureHomeworkSourceExam(homeworkId),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.ADMIN_HOMEWORK(homeworkId), data);
      setUploadOpen(true);
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "워크북 자료 등록을 시작하지 못했습니다."));
    },
  });

  if (homeworkQuery.isLoading) {
    return <EmptyState mode="embedded" scope="panel" tone="loading" title="워크북 자료 불러오는 중…" />;
  }
  const homework = homeworkQuery.data;
  if (!homework) {
    return <EmptyState mode="embedded" scope="panel" tone="error" title="워크북 자료를 불러오지 못했습니다." />;
  }

  const status = homework.source_status;
  const sourceExamId = homework.source_exam_id;
  const canUpload = ["none", "failed", "conversion_required"].includes(status);
  const badge = status === "ready"
    ? { tone: "success" as const, label: "문항 준비됨" }
    : status === "review_required"
      ? { tone: "warning" as const, label: "검수 필요" }
      : status === "processing"
        ? { tone: "info" as const, label: "분리 중" }
        : { tone: "warning" as const, label: "원본 등록 필요" };
  const statusText = status === "ready"
    ? `${homework.source_filename || "워크북 원본"}에서 ${homework.source_question_count}개 문항을 확정했습니다.`
    : status === "review_required"
      ? "미주 번호로 연결한 문제와 선생님 원본 해설을 확인한 뒤 확정해 주세요."
      : status === "processing"
        ? "미주 번호와 문제·해설 원본을 맞추고 있습니다. 완료되면 검수 화면이 열립니다."
        : status === "conversion_required"
          ? "원본은 보관했습니다. 수식과 배치를 보존할 문제 PDF를 추가로 올려 주세요."
          : status === "failed"
            ? "분리를 완료하지 못했습니다. 원본 구성을 확인하고 다시 올려 주세요."
            : "문제+해설 한 파일, 문제만, 문제·해설 두 파일을 같은 진입점에서 처리합니다.";

  return (
    <section id="homework-materials" tabIndex={-1} className={formStyles.section}>
      <div className={formStyles.header}>
        <div>
          <h2 className={formStyles.title}>워크북 원본과 문항</h2>
          <p className={formStyles.description}>미주 번호를 기준으로 문제와 선생님 필기 해설을 보존해 연결합니다.</p>
        </div>
        <Badge tone={badge.tone} size="md" shape="square">{badge.label}</Badge>
      </div>

      <div className={formStyles.body}>
        <div className={formStyles.inlineStatus}>
          <div>
            <strong>{status === "ready" ? "워크북 문항 준비 완료" : "워크북 원본 등록"}</strong>
            <p>{statusText}</p>
          </div>
          {!sourceExamId ? (
            <Button
              type="button"
              intent="primary"
              size="sm"
              loading={ensureSource.isPending}
              onClick={() => ensureSource.mutate()}
            >
              워크북 자료 올리기
            </Button>
          ) : canUpload ? (
            <Button type="button" intent="secondary" size="sm" onClick={() => setUploadOpen(true)}>
              {status === "none" ? "워크북 자료 올리기" : "자료 다시 올리기"}
            </Button>
          ) : null}
        </div>

        {sourceExamId && status === "review_required" && (
          <ExamSegmentationReview
            examId={sourceExamId}
            onApproved={() => { void homeworkQuery.refetch(); }}
          />
        )}
      </div>

      {sourceExamId && (
        <ExamPdfUploadModal
          open={uploadOpen}
          onClose={() => {
            setUploadOpen(false);
            void homeworkQuery.refetch();
          }}
          examId={sourceExamId}
          sourceKind="workbook"
        />
      )}
    </section>
  );
}
