import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { Button, EmptyState } from "@/shared/ui/ds";
import { fetchSession } from "@/shared/api/contracts/sessions";
import { adminSessionQueryKeys } from "@admin/domains/sessions/queryKeys";

type SessionRouteData = {
  id?: unknown;
  lecture?: unknown;
};

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function SessionIdToLectureRedirect() {
  const { sessionId, workflow } = useParams<{ sessionId: string; workflow: string }>();
  const navigate = useNavigate();
  const parsedSessionId = positiveInteger(sessionId);
  const validWorkflow = workflow === "attendance" || workflow === "scores" ? workflow : null;
  const sessionQ = useQuery({
    queryKey: adminSessionQueryKeys.sessionDetail(parsedSessionId),
    queryFn: () => fetchSession(parsedSessionId!),
    enabled: parsedSessionId != null && validWorkflow != null,
  });
  const session = sessionQ.data as SessionRouteData | undefined;
  const resolvedSessionId = positiveInteger(session?.id);
  const lectureId = positiveInteger(session?.lecture);
  const validTarget = parsedSessionId != null
    && resolvedSessionId === parsedSessionId
    && lectureId != null
    && validWorkflow != null;

  useEffect(() => {
    if (!validTarget) return;
    navigate(
      `/workspace/lectures/${lectureId}/sessions/${resolvedSessionId}/${validWorkflow}`,
      { replace: true },
    );
  }, [lectureId, navigate, resolvedSessionId, validTarget, validWorkflow]);

  if (parsedSessionId == null || validWorkflow == null) {
    return <EmptyState scope="page" tone="error" title="차시 정보를 확인할 수 없습니다" description="올바른 차시 업무 주소로 다시 이동해 주세요." />;
  }
  if (sessionQ.isLoading) {
    return <EmptyState scope="page" tone="loading" title="차시 정보를 확인하는 중…" />;
  }
  if (sessionQ.isError || !validTarget) {
    return (
      <EmptyState
        scope="page"
        tone="error"
        title="차시 정보를 확인할 수 없습니다"
        description="강의와 차시 연결을 확인한 뒤 다시 시도해 주세요."
        actions={sessionQ.isError ? <Button onClick={() => void sessionQ.refetch()}>다시 시도</Button> : undefined}
      />
    );
  }
  return <EmptyState scope="page" tone="loading" title="차시 업무로 이동하는 중…" />;
}
