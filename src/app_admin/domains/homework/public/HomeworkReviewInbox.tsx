import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router";
import { Button, EmptyState } from "@/shared/ui/ds";
import HomeworkReviewQueue, { NextHomeworkReview } from "@/shared/ui/submissions/HomeworkReviewQueue";
import HomeworkReviewPicker from "@/shared/ui/submissions/HomeworkReviewPicker";
import { useAdminHomework } from "../hooks/useAdminHomework";

const HomeworkSubmissionsPanel = lazy(() => import("../panels/HomeworkSubmissionsPanel"));

export default function HomeworkReviewInbox({ selection: homework }: { selection: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const homeworkId = Number(homework);
  const showingList = homework === "all" || homework === "pending";
  const pendingOnly = homework === "pending";
  const returnList = searchParams.get("homeworkList") === "pending" ? "pending" : "all";

  const focused = !showingList && searchParams.has("reviewEnrollment");
  const enrollmentId = focused ? Number(searchParams.get("reviewEnrollment")) : undefined;

  function homeworkSearch(value?: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("homework", value);
    else next.delete("homework");
    next.delete("reviewEnrollment");
    next.delete("homeworkList");
    if (pendingOnly && value && /^\d+$/.test(value)) next.set("homeworkList", "pending");
    return next;
  }

  return (
    <section className="space-y-4" aria-label="과제 제출 확인">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">과제 제출 확인</h2>
        <div className="flex flex-wrap gap-2">
          {focused && enrollmentId !== undefined && <NextHomeworkReview mobile={false} homeworkId={homeworkId} enrollmentId={enrollmentId} />}
          {focused && <Button intent="ghost" size="sm" onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.delete("reviewEnrollment");
            setSearchParams(next);
          }}>전체 과제 보기</Button>}
          {showingList && <Button intent="ghost" size="sm" onClick={() => setSearchParams(homeworkSearch(pendingOnly ? "all" : "pending"))}>
            {pendingOnly ? "전체 과제 보기" : "확인 대기만 보기"}
          </Button>}
          <Button intent="secondary" size="sm" onClick={() => setSearchParams(homeworkSearch(showingList ? undefined : returnList))}>
            {showingList ? "제출함으로 돌아가기" : "과제 목록으로 돌아가기"}
          </Button>
        </div>
      </div>
      {showingList ? (
        pendingOnly ? <HomeworkReviewQueue mobile={false} /> : <HomeworkReviewPicker homeworkPath={(id) => ({ search: homeworkSearch(String(id)).toString() })} />
      ) : Number.isSafeInteger(homeworkId) && homeworkId > 0 ? (
        <HomeworkReview key={`${homeworkId}:${enrollmentId}`} homeworkId={homeworkId} enrollmentId={enrollmentId} />
      ) : (
        <EmptyState scope="panel" tone="error" title="과제를 찾을 수 없습니다" />
      )}
    </section>
  );
}

function HomeworkReview({ homeworkId, enrollmentId }: { homeworkId: number; enrollmentId?: number }) {
  const details = useAdminHomework(homeworkId);

  if (details.isPending) return <EmptyState scope="panel" tone="loading" title="과제 불러오는 중…" />;
  if (details.isError) {
    return <EmptyState scope="panel" tone="error" title="과제를 불러오지 못했습니다" actions={
      <Button onClick={() => void details.refetch()}>다시 시도</Button>
    } />;
  }
  if (details.data.homework_type !== "regular" || !details.data.session_id) {
    return <EmptyState scope="panel" tone="error" title="제출을 확인할 수 있는 과제가 아닙니다" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="break-words text-lg font-semibold">{details.data.title}</h3>
      <Suspense fallback={<EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중…" />}>
        <HomeworkSubmissionsPanel homeworkId={homeworkId} enrollmentId={enrollmentId} />
      </Suspense>
    </div>
  );
}
