// PATH: src/features/lectures/layout/LectureLayout.tsx
import { Outlet, useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import api from "@/shared/api/axios";
import { DomainLayout } from "@/shared/ui/layout";
import SessionBlock from "@/features/sessions/components/SessionBlock";
import { useSectionMode } from "@/shared/hooks/useSectionMode";

function safeStr(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default function LectureLayout() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
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

  const isSectionsPage = location.pathname.endsWith("/sections");

  return (
    <DomainLayout title={title} description={desc} breadcrumbs={breadcrumbs}>
      <SessionBlock lectureId={lectureIdNum} />

      {/* section_mode일 때: 반 편성 접근 버튼 */}
      {sectionMode && !isSectionsPage && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <button
            type="button"
            onClick={() => navigate(`/admin/lectures/${lectureIdNum}/sections`)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-brand-primary)",
              background: "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface))",
              border: "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, var(--color-border-divider))",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              transition: "all 120ms",
            }}
          >
            반 편성 관리
          </button>
        </div>
      )}
      <Outlet />
    </DomainLayout>
  );
}
