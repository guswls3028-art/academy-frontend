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

import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import { Button } from "@/shared/ui/ds";

import api from "@/shared/api/axios";

import EnrollStudentModal from "@/features/lectures/components/EnrollStudentModal";
import SessionBlock from "@/features/sessions/components/SessionBlock";
import SessionEnrollModal from "@/features/lectures/components/SessionEnrollModal";
import SessionVideosTab from "@/features/lectures/components/SessionVideosTab";
import {
  fetchSessionEnrollments,
  bulkCreateSessionEnrollments,
} from "@/features/lectures/api/enrollments";
import { fetchSessions } from "@/features/lectures/api/sessions";
import { useLectureParams } from "@/features/lectures/hooks/useLectureParams";
import { feedback } from "@/shared/ui/feedback/feedback";

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
  const location = useLocation();
  const qc = useQueryClient();

  const lecId = Number(lectureId);
  const sId = Number(sessionId);

  if (!Number.isFinite(lecId) || !Number.isFinite(sId)) {
    return <div className="p-4 text-sm text-[var(--color-error)]">잘못된 접근입니다.</div>;
  }

  /* --------------------------------------------------
   * 탭 상태: 레이아웃 탭이 path로 이동하므로 pathname 기준으로 결정
   * -------------------------------------------------- */
  const activeTab = useMemo((): SessionTab => {
    const p = location.pathname;
    if (p.includes("/scores")) return "scores";
    if (p.includes("/exams")) return "exams";
    if (p.includes("/assignments")) return "assignments";
    if (p.includes("/videos")) return "videos";
    if (p.includes("/materials")) return "materials";
    return "attendance";
  }, [location.pathname]);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session", sId],
    queryFn: () => fetchSession(sId),
    enabled: Number.isFinite(sId),
  });

  const { data: sessionEnrollments = [] } = useQuery({
    queryKey: ["session-enrollments", sId],
    queryFn: () => fetchSessionEnrollments(sId),
    enabled: Number.isFinite(sId),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["lecture-sessions", lecId],
    queryFn: () => fetchSessions(lecId),
    enabled: Number.isFinite(lecId),
  });

  const currentOrder = session?.order ?? 0;
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [sessions]
  );
  const prevSession = useMemo(() => {
    const idx = sortedSessions.findIndex((s) => s.id === sId);
    if (idx <= 0) return null;
    return sortedSessions[idx - 1];
  }, [sortedSessions, sId]);

  const copyFromPrevMutation = useMutation({
    mutationFn: async () => {
      if (!prevSession) throw new Error("직전 차시가 없습니다.");
      const prevList = await fetchSessionEnrollments(prevSession.id);
      const alreadyIds = new Set(sessionEnrollments.map((se) => se.enrollment));
      const toAdd = prevList
        .map((se) => se.enrollment)
        .filter((eid) => !alreadyIds.has(eid));
      if (toAdd.length === 0) return { added: 0 };
      await bulkCreateSessionEnrollments(sId, toAdd);
      return { added: toAdd.length };
    },
    onSuccess: (result) => {
      invalidateSession();
      qc.invalidateQueries({ queryKey: ["attendance-matrix", lecId] });
      if (result && "added" in result && result.added > 0) {
        feedback.success(`직전 차시에서 ${result.added}명을 가져왔습니다.`);
      } else if (result && "added" in result && result.added === 0) {
        feedback.info("가져올 새 수강생이 없습니다. (이미 모두 등록됨)");
      }
    },
    onError: (e) => {
      feedback.error(e instanceof Error ? e.message : "가져오기 실패");
    },
  });

  const invalidateSession = () => {
    qc.invalidateQueries({ queryKey: ["session-enrollments", sId] });
    qc.invalidateQueries({ queryKey: ["attendance", sId] });
    qc.invalidateQueries({ queryKey: ["attendance-matrix", lecId] });
    qc.invalidateQueries({ queryKey: ["session-scores", sId] });
  };

  if (!session) {
    return <div className="p-4 text-sm text-[var(--color-text-muted)]">로딩중...</div>;
  }

  const showAssessmentPanel =
    activeTab === "exams" ||
    activeTab === "assignments";

  return (
    <>
      {/* 차시블럭: 출결탭에서만 노출 */}
      {activeTab === "attendance" && (
        <SessionBlock lectureId={lecId} currentSessionId={sId} />
      )}

      <div className="flex gap-4">
        {showAssessmentPanel && (
          <SessionAssessmentSidePanel lectureId={lecId} sessionId={sId} />
        )}
        <div className="flex-1 min-w-0">
          {activeTab === "attendance" && (
            <SessionAttendancePage
              sessionId={sId}
              lectureId={lecId}
              onOpenEnrollModal={() => setShowEnrollModal(true)}
            />
          )}

          {activeTab === "exams" && (
            <SessionExamsPage sessionId={sId} />
          )}

          {activeTab === "scores" && (
            <SessionScoresEntryPage
              onOpenEnrollModal={() => setShowEnrollModal(true)}
              onOpenStudentModal={() => setShowStudentModal(true)}
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

      {showEnrollModal && (
        <SessionEnrollModal
          lectureId={lecId}
          sessionId={sId}
          isOpen={showEnrollModal}
          onClose={() => setShowEnrollModal(false)}
          onSuccess={invalidateSession}
        />
      )}
      {showStudentModal && (
        <EnrollStudentModal
          sessionId={sId}
          isOpen={showStudentModal}
          onClose={() => setShowStudentModal(false)}
          onSuccess={invalidateSession}
        />
      )}
    </>
  );
}
