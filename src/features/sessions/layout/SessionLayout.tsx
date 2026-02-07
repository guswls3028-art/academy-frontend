// PATH: src/features/sessions/layout/SessionLayout.tsx
// ------------------------------------------------------------
// SessionLayout (SESSIONS HUB SHELL) ✅ FIXED / LOCK
// ------------------------------------------------------------
// 책임:
// - sessions 허브 Shell
// - 상단: 세션 메타(title/date)
// - 탭: attendance/scores/exams/assignments/videos/materials 이동
// - 좌측: 시험/과제 전용 공용 평가 패널(SessionAssessmentSidePanel)
// - 우측: 실제 탭 콘텐츠(Outlet)
//
// 규칙:
// - Page는 여기서만 1회 사용
// - 하위 route/component에서는 Page 사용 금지
// ------------------------------------------------------------

import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import api from "@/shared/api/axios";
import { PageHeader, Section, Panel } from "@/shared/ui/ds";

import { useSessionParams } from "../hooks/useSessionParams";
import SessionAssessmentSidePanel from "../components/SessionAssessmentSidePanel";

// ✅ 학생 추가 모달 (lectures 쪽 재사용)
import EnrollStudentModal from "@/features/lectures/components/EnrollStudentModal";

type TabId =
  | "attendance"
  | "scores"
  | "exams"
  | "assignments"
  | "videos"
  | "materials";

const TABS: { id: TabId; label: string; path: string }[] = [
  { id: "attendance", label: "출결", path: "attendance" },
  { id: "scores", label: "성적", path: "scores" },
  { id: "exams", label: "시험", path: "exams" },
  { id: "assignments", label: "과제", path: "assignments" },
  { id: "videos", label: "영상", path: "videos" },
  { id: "materials", label: "자료", path: "materials" },
];

export default function SessionLayout() {
  const { lectureId, sessionId } = useSessionParams();
  const location = useLocation();
  const qc = useQueryClient();

  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // ---------------------------
  // Param guard
  // ---------------------------
  if (!lectureId || !sessionId) {
    return (
      <Page>
        <div className="text-sm text-red-600">
          잘못된 세션 접근입니다.
        </div>
      </Page>
    );
  }

  // ---------------------------
  // Session meta
  // ---------------------------
  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () =>
      (await api.get(`/lectures/sessions/${sessionId}/`)).data,
    enabled: Number.isFinite(sessionId),
  });

  if (isLoading || !session) {
    return <Page>로딩중...</Page>;
  }

  const base = `/admin/lectures/${lectureId}/sessions/${sessionId}`;

  // ---------------------------
  // 좌측 평가 패널 노출 조건
  // ---------------------------
  const pathname = location.pathname;
  const showAssessmentPanel =
    pathname.startsWith(`${base}/exams`) ||
    pathname.startsWith(`${base}/assignments`);

  return (
    <Page>
      {/* ================= Header ================= */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500">
            Lecture #{lectureId} · Session #{sessionId}
          </div>

          <h1 className="text-xl font-bold">
            {session.title}
          </h1>

          {session.date && (
            <div className="text-sm text-gray-500">
              {session.date}
            </div>
          )}
        </div>

        {/* 학생 추가 (세션 기준) */}
        <div className="shrink-0">
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() => setShowEnrollModal(true)}
          >
            학생 추가
          </button>
        </div>
      </div>

      {/* ================= Tabs ================= */}
      <div className="mb-6 border-b">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <NavLink
              key={tab.id}
              to={`${base}/${tab.path}`}
              end={tab.id === "attendance"}
              className={({ isActive }) =>
                "border-b-2 px-4 py-2 text-sm " +
                (isActive
                  ? "border-blue-600 font-semibold text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800")
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* ================= Body ================= */}
      <div className="flex gap-4">
        {/* LEFT: 시험/과제 전용 */}
        {showAssessmentPanel && (
          <aside className="w-[220px] shrink-0">
            <SessionAssessmentSidePanel
              lectureId={lectureId}
              sessionId={sessionId}
            />
          </aside>
        )}

        {/* RIGHT: 실제 탭 콘텐츠 */}
        <section className="flex-1 min-w-0">
          <Outlet />
        </section>
      </div>

      {/* ================= Modal ================= */}
      {showEnrollModal && (
        <EnrollStudentModal
          sessionId={sessionId}
          isOpen={showEnrollModal}
          onClose={() => setShowEnrollModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({
              queryKey: ["attendance", sessionId],
            });
            qc.invalidateQueries({
              queryKey: ["attendance-matrix", lectureId],
            });
          }}
        />
      )}
    </Page>
  );
}
