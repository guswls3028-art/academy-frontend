// PATH: src/features/sessions/pages/SessionDetailPage.tsx
// ------------------------------------------------------------
// SessionDetailPage (SESSIONS HUB)
// ------------------------------------------------------------
// 책임:
// - sessions 기준 단일 허브
// - 탭 상태 관리
// - 좌측 공용 평가 패널 노출 제어
//
// ❌ 금지
// - 점수/합불/정책 해석
// ------------------------------------------------------------

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

  
import { Button, EmptyState, Page, PageHeader, Section } from "@/shared/ui/ds";

import api from "@/shared/api/axios";

import EnrollStudentModal from "@/features/lectures/components/EnrollStudentModal";
import SessionVideosTab from "@/features/lectures/components/SessionVideosTab";
import { useLectureParams } from "@/features/lectures/hooks/useLectureParams";

/* ================= sessions UI ================= */
import SessionTabs from "../components/SessionTabs";
import SessionAssessmentSidePanel
  from "../components/SessionAssessmentSidePanel";

/* ================= 기존 페이지 재사용 ================= */
import SessionAttendancePage from "@/features/lectures/pages/attendance/SessionAttendancePage";
import SessionExamsPage from "@/features/lectures/pages/exams/SessionExamsPage";
import SessionScoresEntryPage from "@/features/lectures/pages/scores/SessionScoresEntryPage";
import SessionAssignmentsEntryPage from "@/features/lectures/pages/assignments/SessionAssignmentsEntryPage";

type SessionTab =
  | "attendance"
  | "scores"
  | "exams"
  | "assignments"
  | "videos"
  | "materials";

async function fetchSession(id: number) {
  const res = await api.get(`/lectures/sessions/${id}/`);
  return res.data;
}

export default function SessionDetailPage() {
  const { lectureId, sessionId } = useLectureParams();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const lecId = Number(lectureId);
  const sId = Number(sessionId);

  if (!Number.isFinite(lecId) || !Number.isFinite(sId)) {
    return <Page title="">잘못된 접근입니다.</Page>;
  }

  /* --------------------------------------------------
   * 탭 상태
   * - 기본은 attendance
   * - searchParams(tab) 있으면 우선
   * -------------------------------------------------- */
  const paramTab = searchParams.get("tab") as SessionTab | null;

  const [activeTab, setActiveTab] =
    useState<SessionTab>(paramTab ?? "attendance");

  useEffect(() => {
    if (paramTab && paramTab !== activeTab) {
      setActiveTab(paramTab);
    }
  }, [paramTab]);

  const handleChangeTab = (tab: SessionTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  const [showModal, setShowModal] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session", sId],
    queryFn: () => fetchSession(sId),
    enabled: Number.isFinite(sId),
  });

  if (!session) {
    return <Page title="">로딩중...</Page>;
  }

  const showAssessmentPanel =
    activeTab === "exams" ||
    activeTab === "scores" ||
    activeTab === "assignments";

  return (
    <Page title="">
      <PageHeader
        title={session.title}
        actions={
          <Button type="button" intent="primary" size="sm" onClick={() => setShowModal(true)}>
            학생 추가
          </Button>
        }
      />

      <div className="mb-6 text-sm text-gray-500">
        {session.date}
      </div>

      {/* ================= Tabs ================= */}
      <SessionTabs
        activeTab={activeTab}
        onChange={handleChangeTab}
      />

      {/* ================= CONTENT ================= */}
      <div className="flex gap-4">
        {/* LEFT: 공용 평가 패널 */}
        {showAssessmentPanel && (
          <SessionAssessmentSidePanel
            lectureId={lecId}
            sessionId={sId}
          />
        )}

        {/* RIGHT */}
        <div className="flex-1 min-w-0">
          {activeTab === "attendance" && (
            <SessionAttendancePage sessionId={sId} />
          )}

          {activeTab === "exams" && (
            <SessionExamsPage sessionId={sId} />
          )}

          {activeTab === "scores" && (
            <SessionScoresEntryPage
              lectureId={lecId}
              sessionId={sId}
            />
          )}

          {activeTab === "assignments" && (
            <SessionAssignmentsEntryPage
              lectureId={lecId}
              sessionId={sId}
            />
          )}

          {activeTab === "videos" && (
            <SessionVideosTab sessionId={sId} />
          )}

          {activeTab === "materials" && (
            <div>자료 UI 예정</div>
          )}
        </div>
      </div>

      {/* ================= MODAL ================= */}
      {showModal && (
        <EnrollStudentModal
          sessionId={sId}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() =>
            qc.invalidateQueries({
              queryKey: ["attendance", sId],
            })
          }
        />
      )}
    </Page>
  );
}
