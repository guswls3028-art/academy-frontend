// src/features/lectures/layout/LectureLayout.tsx

import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { Page, PageHeader } from "@/shared/ui/page";

import SessionBar from "../components/SessionBar";
import LectureTabs from "../components/LectureTabs";
import { useLectureParams } from "../hooks/useLectureParams";

export default function LectureLayout() {
  const { lectureId, sessionId } = useLectureParams();

  if (!Number.isFinite(lectureId)) {
    return <Page>잘못된 강의 ID</Page>;
  }

  const { data: lecture, isLoading } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: async () =>
      (await api.get(`/lectures/lectures/${lectureId}/`)).data,
    enabled: Number.isFinite(lectureId),
  });

  if (isLoading || !lecture) {
    return <Page>로딩중...</Page>;
  }

  const isSessionDetail = Number.isFinite(sessionId);

  return (
    <Page>
      {isSessionDetail ? (
        <>
          <button
            onClick={() => window.history.back()}
            className="
              mb-4 inline-flex items-center gap-1
              rounded-md border border-[var(--border-divider)]
              bg-[var(--bg-surface)]
              px-3 py-1.5 text-sm font-medium
              text-[var(--text-secondary)]
              hover:bg-[var(--bg-surface-soft)]
            "
          >
            ← 강의로 돌아가기
          </button>

          <Outlet />
        </>
      ) : (
        <>
          <PageHeader
            title={lecture.title}
            description={`${lecture.subject ?? "-"} · 강사 ${lecture.name ?? "-"}`}
          />

          <SessionBar />

          <LectureTabs />

          <div
            className="
              rounded-b-2xl
              border border-t-0 border-[var(--border-divider)]
              bg-[var(--bg-surface)]
              p-6
            "
          >
            <Outlet />
          </div>
        </>
      )}
    </Page>
  );
}
