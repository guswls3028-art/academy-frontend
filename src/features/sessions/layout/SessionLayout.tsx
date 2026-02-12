// PATH: src/features/sessions/layout/SessionLayout.tsx
import { Outlet, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";

import api from "@/shared/api/axios";
import { DomainLayout } from "@/shared/ui/layout";

import { useSessionParams } from "../hooks/useSessionParams";
import SessionAssessmentSidePanel from "../components/SessionAssessmentSidePanel";
import SessionBlock from "../components/SessionBlock";
import EnrollStudentModal from "@/features/lectures/components/EnrollStudentModal";

export default function SessionLayout() {
  const { lectureId, sessionId } = useSessionParams();
  const location = useLocation();
  const qc = useQueryClient();
  const [showEnrollModal, setShowEnrollModal] = useState(false);

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

  const showAssessmentPanel =
    !!base &&
    (location.pathname.startsWith(`${base}/exams`) ||
      location.pathname.startsWith(`${base}/assignments`));

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
    <>
      <DomainLayout
        title={session.title}
        description={session.date ?? undefined}
        breadcrumbs={breadcrumbs}
        tabs={tabs}
      >
        <SessionBlock lectureId={lectureId} currentSessionId={sessionId} />
        <div className="flex flex-col gap-4 sm:flex-row">
          {showAssessmentPanel && (
            <SessionAssessmentSidePanel
              lectureId={lectureId}
              sessionId={sessionId}
            />
          )}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </DomainLayout>

      {showEnrollModal && (
        <EnrollStudentModal
          sessionId={sessionId}
          isOpen
          onClose={() => setShowEnrollModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
          }}
        />
      )}
    </>
  );
}
