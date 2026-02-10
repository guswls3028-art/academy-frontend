// PATH: src/features/sessions/layout/SessionLayout.tsx
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";

import { useSessionParams } from "../hooks/useSessionParams";
import SessionAssessmentSidePanel from "../components/SessionAssessmentSidePanel";
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

  if (!lectureId || !sessionId) {
    return (
      <div className="p-6 text-sm text-[var(--color-error)]">
        잘못된 세션 접근입니다.
      </div>
    );
  }

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () =>
      (await api.get(`/lectures/sessions/${sessionId}/`)).data,
  });

  if (isLoading || !session) return null;

  const base = `/admin/lectures/${lectureId}/sessions/${sessionId}`;

  const showAssessmentPanel =
    location.pathname.startsWith(`${base}/exams`) ||
    location.pathname.startsWith(`${base}/assignments`);

  return (
    <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
      {/* ===============================
          DOMAIN HEADER (Students SSOT)
      =============================== */}
      <div className="border-b border-[var(--border-divider)] bg-[var(--bg-surface)]">
        <div className="px-6 pt-6 pb-4">
          <div className="relative">
            {/* accent bar */}
            <div className="absolute left-0 top-1 h-6 w-1 rounded-full bg-[var(--color-primary)]" />

            <div className="pl-4">
              <div className="text-2xl font-bold tracking-tight">
                {session.title}
              </div>
              {session.date && (
                <div className="text-base text-[var(--text-muted)] mt-1">
                  {session.date}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===============================
            DOMAIN TABS (Students SSOT)
        =============================== */}
        <div className="px-6">
          <div className="ds-tabs">
            {TABS.map((tab) => (
              <NavLink
                key={tab.id}
                to={`${base}/${tab.path}`}
                end={tab.id === "attendance"}
                className={({ isActive }) =>
                  [
                    "ds-tab text-[15px] font-semibold",
                    isActive ? "is-active" : "",
                  ].join(" ")
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* ===============================
          DOMAIN CONTENT (Students SSOT)
      =============================== */}
      <div className="px-6 py-6">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-divider)]">
          <div className="flex gap-4 p-4">
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
        </div>
      </div>

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
    </div>
  );
}
