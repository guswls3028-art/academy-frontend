// PATH: src/app_admin/domains/lectures/layout/LectureLayout.tsx
import { Outlet, useMatch, useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { Settings, Trophy, Users } from "lucide-react";
import api from "@/shared/api/axios";
import { DomainLayout } from "@/shared/ui/layout";
import { Button, EmptyState } from "@/shared/ui/ds";
import SessionBlock from "@admin/domains/sessions/components/SessionBlock";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { adminLectureQueryKeys } from "./queryKeys";

const LectureCreateModal = lazy(() => import("./components/LectureCreateModal"));

function safeStr(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default function LectureLayout() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const isOverview = useMatch("/workspace/lectures/:lectureId");
  const isCommunity = useMatch("/workspace/lectures/:lectureId/community");
  const navigate = useNavigate();
  const { sectionMode } = useSectionMode();
  const lectureIdNum = Number(lectureId);
  const hasValidLectureId = /^[1-9]\d*$/.test(lectureId ?? "") && Number.isSafeInteger(lectureIdNum);
  const [settingsLectureId, setSettingsLectureId] = useState<number | null>(null);

  const lectureQ = useQuery({
    queryKey: adminLectureQueryKeys.lecture(hasValidLectureId ? lectureIdNum : null),
    queryFn: async () => (await api.get(`/lectures/lectures/${lectureIdNum}/`)).data,
    enabled: hasValidLectureId,
  });
  const lecture = lectureQ.data;
  const isLoading = lectureQ.isLoading;

  const title = isLoading ? "강의 불러오는 중…" : safeStr(lecture?.title) || "강의";
  const desc = isLoading
    ? "데이터를 불러오는 중입니다."
    : [
        safeStr(lecture?.subject),
        safeStr(lecture?.name),
        lecture?.start_date && lecture?.end_date
          ? `${lecture.start_date} ~ ${lecture.end_date}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ") || "수강생";

  const breadcrumbs = useMemo(
    () => [
      { label: "강의", to: "/workspace/lectures" },
      { label: title },
    ],
    [title]
  );

  const headerActions = (
    <>
      <Button
        intent="secondary"
        size="sm"
        onClick={() => navigate(`/workspace/lectures/${lectureIdNum}/rankings`)}
        leftIcon={<Trophy size={14} />}
      >
        순위·명예의 전당
      </Button>
      {sectionMode && (
        <Button
          intent="secondary"
          size="sm"
          onClick={() => navigate(`/workspace/lectures/${lectureIdNum}/sections`)}
          leftIcon={<Users size={14} />}
        >
          반 편성
        </Button>
      )}
      {lecture && lecture.is_active !== false && (
        <Button intent="secondary" size="sm" onClick={() => setSettingsLectureId(lectureIdNum)} leftIcon={<Settings size={14} aria-hidden />}>
          강의 설정
        </Button>
      )}
    </>
  );

  if (!hasValidLectureId) {
    return (
      <DomainLayout title="강의" description="잘못된 강의 ID">
        <div className="p-4 text-sm text-[var(--color-error)]">
          잘못된 강의 ID
        </div>
      </DomainLayout>
    );
  }

  if (lectureQ.isError) {
    return (
      <DomainLayout title="강의" description="강의 정보를 불러오지 못했습니다" breadcrumbs={breadcrumbs}>
        <EmptyState
          scope="panel"
          tone="error"
          title="강의 정보를 불러오지 못했습니다"
          actions={<Button intent="secondary" onClick={() => void lectureQ.refetch()}>다시 시도</Button>}
        />
      </DomainLayout>
    );
  }

  if (isLoading) {
    return (
      <DomainLayout title={title} description={desc} breadcrumbs={breadcrumbs}>
        <EmptyState scope="panel" tone="loading" title="강의를 불러오는 중…" />
      </DomainLayout>
    );
  }

  const base = `/workspace/lectures/${lectureIdNum}`;
  const tabs = isOverview || isCommunity ? [
    { key: "attendance", label: "출결", path: base, exact: true },
    { key: "community", label: "커뮤니티", path: `${base}/community` },
  ] : undefined;

  return (
    <DomainLayout title={title} description={desc} breadcrumbs={breadcrumbs} headerActions={headerActions} tabs={tabs}>
      {!isCommunity && <SessionBlock lectureId={lectureIdNum} />}
      <Outlet />
      {settingsLectureId === lectureIdNum && (
        <Suspense fallback={null}>
          <LectureCreateModal isOpen lectureId={lectureIdNum} onClose={() => setSettingsLectureId(null)} />
        </Suspense>
      )}
    </DomainLayout>
  );
}
