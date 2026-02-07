// PATH: src/features/lectures/layout/LectureLayout.tsx

import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { PageHeader, Section, Panel } from "@/shared/ui/ds";

import SessionBar from "../components/SessionBar";
import LectureTabs from "../components/LectureTabs";
import { useLectureParams } from "../hooks/useLectureParams";

export default function LectureLayout() {
  const { lectureId, sessionId } = useLectureParams();

  if (!Number.isFinite(lectureId)) {
    return (
      <div className="p-6 text-sm text-red-500">
        잘못된 강의 ID
      </div>
    );
  }

  const { data: lecture, isLoading } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: async () =>
      (await api.get(`/lectures/lectures/${lectureId}/`)).data,
    enabled: Number.isFinite(lectureId),
  });

  if (isLoading || !lecture) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">
        로딩중...
      </div>
    );
  }

  const isSessionDetail = Number.isFinite(sessionId);

  return (
    <Section>
      {isSessionDetail ? (
        <>
          <button
            onClick={() => window.history.back()}
            className="
              inline-flex items-center gap-1
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
            actions={null}
          />

          <SessionBar />
          <LectureTabs />

          <Panel>
            <Outlet />
          </Panel>
        </>
      )}
    </Section>
  );
}
