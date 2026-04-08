// PATH: src/features/sessions/layout/SessionLayout.tsx
// 구조: students 도메인과 동일 — DomainLayout > Outlet (페이지가 콘텐츠 전담)
import { useMemo } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { DomainLayout } from "@/shared/ui/layout";
import { formatSessionOrderLabel } from "@/shared/ui/session-block";
import { useSessionParams } from "../hooks/useSessionParams";
import { useSectionMode } from "@/shared/hooks/useSectionMode";

export default function SessionLayout() {
  const { lectureId, sessionId } = useSessionParams();
  const { sectionMode } = useSectionMode();

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

  const tabs = useMemo(() => {
    if (!base) return [];
    const items = [
      { key: "attendance", label: "출결", path: `${base}/attendance` },
      { key: "scores", label: "성적", path: `${base}/scores` },
      { key: "exams", label: "시험", path: `${base}/exams` },
      { key: "assignments", label: "과제", path: `${base}/assignments` },
      { key: "videos", label: "영상", path: `${base}/videos` },
    ];
    // P7: CLINIC 세션에서는 정규 클리닉 탭 불필요 (순환 방지)
    if (sectionMode && session?.section_type !== "CLINIC") {
      items.push({ key: "clinic", label: "정규 클리닉", path: `${base}/clinic` });
    }
    return items;
  }, [base, sectionMode, session?.section_type]);

  if (!lectureId || !sessionId) {
    return (
      <div className="p-6 text-sm text-[var(--color-error)]">
        잘못된 세션 접근입니다.
      </div>
    );
  }

  if (isLoading || !session) return null;

  const lectureTitle = lecture?.title ?? lecture?.name ?? "강의";
  const sectionLabel = sectionMode && session.section_label
    ? `${session.section_label}반`
    : null;
  const sectionType = session.section_type === "CLINIC" ? "클리닉" : null;
  const sectionSuffix = sectionLabel
    ? ` (${sectionType ? sectionType + " " : ""}${sectionLabel})`
    : "";
  const sessionHeading = formatSessionOrderLabel(session.order, session.title) + sectionSuffix;
  const breadcrumbs = [
    { label: "강의", to: "/admin/lectures" },
    { label: lectureTitle, to: `/admin/lectures/${lectureId}` },
    { label: sessionHeading },
  ];

  return (
    <DomainLayout
      title={sessionHeading}
      description={[session.date, sectionLabel].filter(Boolean).join(" · ") || undefined}
      breadcrumbs={breadcrumbs}
      tabs={tabs}
    >
      <Outlet />
    </DomainLayout>
  );
}
