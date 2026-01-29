// PATH: src/features/sessions/components/SessionAssessmentWorkspace.tsx

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { useSessionParams } from "../hooks/useSessionParams";

import AdminExamDetail from "@/features/exams/components/AdminExamDetail";
import AdminHomeworkDetail from "@/features/homework/components/AdminHomeworkDetail";

type Mode = "exam" | "homework";

type Props = {
  mode: Mode;
};

export default function SessionAssessmentWorkspace({
  mode,
}: Props) {
  const { sessionId } = useSessionParams();
  const [searchParams] = useSearchParams();

  const queryKey = mode === "exam" ? "examId" : "homeworkId";

  const activeId = useMemo(() => {
    const v = Number(searchParams.get(queryKey));
    return Number.isFinite(v) ? v : null;
  }, [searchParams, queryKey]);

  const titleLabel = mode === "exam" ? "시험" : "과제";

  if (!sessionId) {
    return (
      <div className="text-sm text-red-600">
        잘못된 sessionId
      </div>
    );
  }

  return (
    <section className="card p-4 min-w-0">
      {!activeId ? (
        <EmptyCard title={titleLabel} />
      ) : (
        <>
          {mode === "exam" && (
            <AdminExamDetail examId={activeId} />
          )}
          {mode === "homework" && (
            <AdminHomeworkDetail homeworkId={activeId} />
          )}
        </>
      )}
    </section>
  );
}

/* ================= UI ================= */

function EmptyCard({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
      <div className="text-sm font-medium text-gray-700">
        선택된 {title}이 없습니다
      </div>

      <div className="mt-1 text-xs text-gray-500">
        좌측 패널에서 {title}을 선택하세요
      </div>
    </div>
  );
}
