import { useEffect, useMemo, useRef } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router";
import { Button, EmptyState } from "@/shared/ui/ds";
import api from "@/shared/api/axios";
import { isApiRecord } from "@/shared/api/response";
import { fetchSession } from "@/shared/api/contracts/sessions";
import { adminExamsQueryKeys } from "@admin/domains/exams/queryKeys";

type RouteSession = {
  id?: unknown;
  lecture?: unknown;
  display_label?: unknown;
  title?: unknown;
};

type ExamRouteContext = {
  sessionIds: number[];
};

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

const examRouteSessionQueryKey = (examId: number, sessionId: number) =>
  [...adminExamsQueryKeys.examDetail(examId), "route-session", sessionId] as const;

function sessionLabel(session: RouteSession, fallbackId: number): string {
  const displayLabel = typeof session.display_label === "string" && session.display_label.trim()
    ? session.display_label.trim()
    : `차시 ${fallbackId}`;
  const title = typeof session.title === "string" && session.title.trim()
    ? session.title.trim()
    : "제목 없음";
  return `${displayLabel} · ${title}`;
}

async function fetchExamRouteContext(examId: number): Promise<ExamRouteContext> {
  const response = await api.get(`/exams/${examId}/`);
  const data = isApiRecord(response.data) ? response.data : {};
  const rawSessionIds = Array.isArray(data.session_ids) ? data.session_ids : [];
  return {
    sessionIds: Array.from(new Set(
      rawSessionIds
        .map(positiveInteger)
        .filter((id): id is number => id != null),
    )),
  };
}

export default function ExamIdToSessionRedirect() {
  const { examId } = useParams<{ examId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const choicesRef = useRef<HTMLDivElement>(null);
  const parsedExamId = positiveInteger(examId);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const rawSessionContext = searchParams.get("sessionId");
  const sessionContext = rawSessionContext == null ? null : positiveInteger(rawSessionContext);
  const invalidSearch = Array.from(searchParams.keys()).some((key) => key !== "sessionId")
    || searchParams.getAll("sessionId").length > 1
    || (rawSessionContext != null && sessionContext == null);

  const examQ = useQuery({
    queryKey: adminExamsQueryKeys.examDetail(parsedExamId),
    queryFn: () => fetchExamRouteContext(parsedExamId!),
    enabled: parsedExamId != null && !invalidSearch,
  });
  const sessionIds = examQ.data?.sessionIds ?? [];
  const contextMismatch = sessionContext != null && !sessionIds.includes(sessionContext);
  const candidateIds = sessionContext != null ? [sessionContext] : sessionIds;
  const sessionQueries = useQueries({
    queries: candidateIds.map((id) => ({
      queryKey: examRouteSessionQueryKey(parsedExamId!, id),
      queryFn: () => fetchSession(id),
      enabled: !contextMismatch,
    })),
  });
  const validSessions = candidateIds.map((id, index) => {
    const data = sessionQueries[index]?.data as RouteSession | undefined;
    const resolvedId = positiveInteger(data?.id);
    const lectureId = positiveInteger(data?.lecture);
    return resolvedId === id && lectureId != null ? { id, lectureId, data: data! } : null;
  });
  const sessionsLoading = sessionQueries.some((query) => query.isLoading);
  const sessionsInvalid = sessionQueries.some((query) => query.isError)
    || (!sessionsLoading && validSessions.some((session) => session == null));
  const exactTarget = !sessionsLoading && !sessionsInvalid && validSessions.length === 1
    ? validSessions[0]
    : null;
  const showSelector = !sessionsLoading
    && !sessionsInvalid
    && sessionContext == null
    && validSessions.length > 1;

  useEffect(() => {
    if (!exactTarget) return;
    navigate(
      `/workspace/lectures/${exactTarget.lectureId}/sessions/${exactTarget.id}/exams?examId=${parsedExamId}`,
      { replace: true },
    );
  }, [exactTarget, navigate, parsedExamId]);

  useEffect(() => {
    if (!showSelector) return;
    const frame = window.requestAnimationFrame(() => {
      choicesRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      navigate(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate, showSelector]);

  if (parsedExamId == null || invalidSearch) {
    return <EmptyState scope="page" tone="error" title="시험 정보를 확인할 수 없습니다" description="올바른 시험 주소로 다시 이동해 주세요." />;
  }
  if (examQ.isLoading || sessionsLoading) {
    return <EmptyState scope="page" tone="loading" title="시험 차시를 확인하는 중…" />;
  }
  if (examQ.isError || sessionIds.length === 0 || contextMismatch || sessionsInvalid) {
    const hasGetError = examQ.isError || sessionQueries.some((query) => query.isError);
    return (
      <EmptyState
        scope="page"
        tone="error"
        title="시험 차시를 확인할 수 없습니다"
        description="시험에 연결된 차시를 확인한 뒤 다시 시도해 주세요."
        actions={hasGetError ? (
          <Button onClick={() => {
            void examQ.refetch();
            for (const query of sessionQueries) void query.refetch();
          }}>
            다시 시도
          </Button>
        ) : undefined}
      />
    );
  }
  if (showSelector) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4" aria-labelledby="exam-session-choice-title">
        <div className="flex flex-col gap-1">
          <h1 id="exam-session-choice-title" className="m-0 text-lg font-bold">시험을 진행한 차시를 선택해 주세요</h1>
          <p className="m-0 text-sm text-slate-500">같은 시험이 여러 차시에 연결되어 있어 자동으로 선택하지 않습니다.</p>
        </div>
        <div ref={choicesRef} className="grid min-w-0 grid-cols-1 gap-2" role="group" aria-label="시험 차시 선택">
          {validSessions.map((session) => session && (
            <Button
              key={session.id}
              className="w-full justify-start"
              intent="secondary"
              size="lg"
              onClick={() => navigate(`/workspace/lectures/${session.lectureId}/sessions/${session.id}/exams?examId=${parsedExamId}`)}
            >
              {sessionLabel(session.data, session.id)}
            </Button>
          ))}
        </div>
        <Button intent="ghost" onClick={() => navigate(-1)}>모바일 시험으로 돌아가기</Button>
      </section>
    );
  }
  return <EmptyState scope="page" tone="loading" title="시험 업무로 이동하는 중…" />;
}
