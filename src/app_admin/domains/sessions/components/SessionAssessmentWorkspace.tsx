// PATH: src/app_admin/domains/sessions/components/SessionAssessmentWorkspace.tsx
import { lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { useLectureSessionParams } from "@/shared/hooks/useLectureSessionParams";
import { readAssessmentItemId } from "@/shared/lib/assessmentQueryParams";

import { Panel } from "@/shared/ui/ds";
import RouteFallback from "@/core/router/RouteFallback";

const AdminExamDetail = lazy(() => import("@admin/domains/exams/components/AdminExamDetail"));
const AdminHomeworkDetail = lazy(() => import("@admin/domains/homework/components/AdminHomeworkDetail"));

type Mode = "exam" | "homework";

type Props = {
  mode: Mode;
};

export default function SessionAssessmentWorkspace({ mode }: Props) {
  const { sessionId } = useLectureSessionParams();
  const [searchParams] = useSearchParams();

  const activeId = useMemo(() => {
    return readAssessmentItemId(searchParams, mode);
  }, [searchParams, mode]);

  const titleLabel = mode === "exam" ? "시험" : "과제";

  if (!sessionId) {
    return (
      <div
        className="text-sm text-[var(--color-error)]"
      >
        잘못된 sessionId
      </div>
    );
  }

  return (
    <Panel className="min-w-0">
      {!activeId ? (
        <div className="flex h-[240px] flex-col items-center justify-center text-center">
          <div
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            선택된 {titleLabel}이 없습니다
          </div>
          <div
            className="mt-1 text-xs text-[var(--color-text-muted)]"
          >
            좌측 패널에서 {titleLabel}을 선택하세요
          </div>
        </div>
      ) : (
        <Suspense fallback={<RouteFallback />}>
          {mode === "exam" && (
            <AdminExamDetail
              examId={activeId}
              sessionId={sessionId}
              mode={sessionId ? "operate" : "design"}
            />
          )}
          {mode === "homework" && (
            <AdminHomeworkDetail
              homeworkId={activeId}
              sessionId={sessionId}
              mode="operate"
            />
          )}
        </Suspense>
      )}
    </Panel>
  );
}
