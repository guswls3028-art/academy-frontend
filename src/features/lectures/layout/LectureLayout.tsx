// PATH: src/features/lectures/layout/LectureLayout.tsx
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import LectureTabs from "../components/LectureTabs";

function safeStr(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default function LectureLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  if (!Number.isFinite(lectureIdNum)) {
    return (
      <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
        <div className="px-6 py-6">
          <div
            className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-divider)] p-4 text-sm"
            style={{ color: "var(--color-error)" }}
          >
            잘못된 강의 ID
          </div>
        </div>
      </div>
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
        .join(" · ") || "수강생 · 자료 · 출결 · 리포트";

  const isSessionDetail = location.pathname.includes("/sessions/");

  return (
    <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
      {/* DOMAIN HEADER (StudentsLayout 동일 패턴) */}
      <div className="border-b border-[var(--border-divider)] bg-[var(--bg-surface)]">
        <div className="px-6 pt-6 pb-4">
          <div className="relative">
            <div className="absolute left-0 top-1 h-6 w-1 rounded-full bg-[var(--color-primary)]" />
            <div className="pl-4">
              <div className="text-2xl font-bold tracking-tight">{title}</div>
              <div className="text-base text-[var(--text-muted)] mt-1">{desc}</div>
            </div>
          </div>
        </div>

        {/* Tabs (ds-tabs) */}
        <div className="px-6">
          <LectureTabs />
        </div>
      </div>

      {/* DOMAIN CONTENT CARD (단일 프레임) */}
      <div className="px-6 py-6">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-divider)]">
          {/* Session detail도 같은 프레임 유지, 상단에만 back 제공 */}
          {isSessionDetail && (
            <div className="px-5 py-4 border-b border-[var(--border-divider)]">
              <button
                onClick={() => navigate(-1)}
                className="ds-tab text-[15px] font-semibold"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-divider)",
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-secondary)",
                }}
              >
                ← 강의로 돌아가기
              </button>
            </div>
          )}

          <div className="p-4">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
