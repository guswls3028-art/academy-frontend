// PATH: src/app_admin/domains/lectures/layout/LectureLayout.tsx
import { Outlet, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Users } from "lucide-react";
import api from "@/shared/api/axios";
import { DomainLayout } from "@/shared/ui/layout";
import { Button } from "@/shared/ui/ds";
import SessionBlock from "@admin/domains/sessions/components/SessionBlock";
import { useSectionMode } from "@/shared/hooks/useSectionMode";

function safeStr(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default function LectureLayout() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const { sectionMode } = useSectionMode();
  const lectureIdNum = Number(lectureId);
  if (!Number.isFinite(lectureIdNum)) {
    return (
      <DomainLayout title="강의" description="잘못된 강의 ID">
        <div className="p-4 text-sm" style={{ color: "var(--color-error)" }}>
          잘못된 강의 ID
        </div>
      </DomainLayout>
    );
  }

  const { data: lecture, isLoading } = useQuery({
    queryKey: ["lecture", lectureIdNum],
    queryFn: async () => (await api.get(`/lectures/lectures/${lectureIdNum}/`)).data,
    enabled: Number.isFinite(lectureIdNum),
  });

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
      { label: "강의", to: "/admin/lectures" },
      { label: title },
    ],
    [title]
  );

  const headerActions = sectionMode ? (
    <Button
      intent="secondary"
      size="sm"
      onClick={() => navigate(`/admin/lectures/${lectureIdNum}/sections`)}
      leftIcon={<Users size={14} />}
    >
      반 편성
    </Button>
  ) : undefined;

  return (
    <DomainLayout title={title} description={desc} breadcrumbs={breadcrumbs} headerActions={headerActions}>
      <SessionBlock lectureId={lectureIdNum} />
      <Outlet />
    </DomainLayout>
  );
}
