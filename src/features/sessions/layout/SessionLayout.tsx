// PATH: src/features/sessions/layout/SessionLayout.tsx
// 구조: students 도메인과 동일 — DomainLayout > Outlet (페이지가 콘텐츠 전담)
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import api from "@/shared/api/axios";
import { DomainLayout } from "@/shared/ui/layout";

import { useSessionParams } from "../hooks/useSessionParams";

export default function SessionLayout() {
  const { lectureId, sessionId } = useSessionParams();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () =>
      (await api.get(`/lectures/sessions/${sessionId}/`)).data,
    enabled: !!lectureId && !!sessionId,
  });

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: async () =>
      (await api.get(`/lectures/lectures/${lectureId}/`)).data,
    enabled: !!lectureId && !!session,
  });

  const base =
    lectureId && sessionId
      ? `/admin/lectures/${lectureId}/sessions/${sessionId}`
      : "";

  const tabs = useMemo(
    () =>
      base
        ? [
            { key: "attendance", label: "출결", path: base, exact: true },
            { key: "scores", label: "성적", path: `${base}/scores` },
            { key: "exams", label: "시험", path: `${base}/exams` },
            { key: "assignments", label: "과제", path: `${base}/assignments` },
            { key: "videos", label: "영상", path: `${base}/videos` },
            { key: "materials", label: "자료", path: `${base}/materials` },
          ]
        : [],
    [base]
  );

  if (!lectureId || !sessionId) {
    return (
      <div className="p-6 text-sm text-[var(--color-error)]">
        잘못된 세션 접근입니다.
      </div>
    );
  }

  if (isLoading || !session) return null;

  const lectureTitle = lecture?.title ?? lecture?.name ?? "강의";
  const breadcrumbs = [
    { label: "강의", to: "/admin/lectures" },
    { label: lectureTitle, to: `/admin/lectures/${lectureId}` },
    { label: session.title },
  ];

  return (
    <DomainLayout
      title={session.title}
      description={session.date ?? undefined}
      breadcrumbs={breadcrumbs}
      tabs={tabs}
    >
      <Outlet />
    </DomainLayout>
  );
}
