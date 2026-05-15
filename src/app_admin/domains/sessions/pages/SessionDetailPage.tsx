// PATH: src/app_admin/domains/sessions/pages/SessionDetailPage.tsx
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams, Navigate, useNavigate } from "react-router-dom";

import api from "@/shared/api/axios";

import EnrollStudentModal from "@admin/domains/lectures/components/EnrollStudentModal";
import SessionBlock from "@admin/domains/sessions/components/SessionBlock";
import SessionEnrollModal from "@admin/domains/lectures/components/SessionEnrollModal";
import SessionVideosTab from "@admin/domains/lectures/components/SessionVideosTab";
import { useLectureParams } from "@admin/domains/lectures/hooks/useLectureParams";
import { EmptyState } from "@/shared/ui/ds";

import SessionAssessmentSidePanel
  from "../components/SessionAssessmentSidePanel";
import AssessmentDeleteBar from "../components/AssessmentDeleteBar";
import { readAssessmentItemId } from "../utils/assessmentQueryParams";

/* ================= 기존 페이지 재사용 ================= */
import SessionAttendancePage from "@admin/domains/lectures/pages/attendance/SessionAttendancePage";
import SessionScoresEntryPage from "@admin/domains/lectures/pages/scores/SessionScoresEntryPage";
import SessionAssessmentWorkspace from "@admin/domains/sessions/components/SessionAssessmentWorkspace";
import SessionClinicTab from "@admin/domains/sessions/components/SessionClinicTab";

type SessionTab =
  | "attendance"
  | "scores"
  | "exams"
  | "assignments"
  | "videos"
  | "clinic";

async function fetchSession(id: number) {
  const res = await api.get(`/lectures/sessions/${id}/`);
  return res.data;
}

export default function SessionDetailPage() {
  const { lectureId, sessionId } = useLectureParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const lecId = Number(lectureId);
  const sId = Number(sessionId);

  const examId = useMemo(() => {
    return readAssessmentItemId(searchParams, "exam");
  }, [searchParams]);

  const homeworkId = useMemo(() => {
    return readAssessmentItemId(searchParams, "homework");
  }, [searchParams]);

  /* 탭 상태: pathname 기준 (훅 개수 일정 유지 위해 모든 훅을 early return 위에 배치) */
  const basePath = `/admin/lectures/${lecId}/sessions/${sId}`;
  const activeTab = useMemo((): SessionTab => {
    const p = location.pathname;
    const isIndex = p === basePath || p === basePath + "/";
    if (isIndex) return "attendance";
    if (p.includes("/scores")) return "scores";
    if (p.includes("/exams")) return "exams";
    if (p.includes("/assignments")) return "assignments";
    if (p.includes("/videos")) return "videos";
    if (p.includes("/clinic")) return "clinic";
    if (p.includes("/attendance")) return "attendance";
    return "attendance";
  }, [location.pathname, basePath]);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [openCreateExam, setOpenCreateExam] = useState(false);
  const [openCreateHomework, setOpenCreateHomework] = useState(false);

  const { data: session, isError: sessionError } = useQuery({
    queryKey: ["session", sId],
    queryFn: () => fetchSession(sId),
    enabled: Number.isFinite(sId),
  });

  const invalidateSession = () => {
    qc.invalidateQueries({ queryKey: ["session-enrollments", sId] });
    qc.invalidateQueries({ queryKey: ["attendance", sId] });
    qc.invalidateQueries({ queryKey: ["attendance-matrix", lecId] });
    qc.invalidateQueries({ queryKey: ["session-scores", sId] });
  };

  // ---------- Early returns (모든 훅 호출 이후에만) ----------
  if (!Number.isFinite(lecId) || !Number.isFinite(sId)) {
    return <div className="p-4 text-sm text-[var(--color-error)]">잘못된 접근입니다.</div>;
  }

  const isIndexPath = location.pathname === basePath || location.pathname === basePath + "/";
  if (isIndexPath) {
    return <Navigate to={`${basePath}/attendance`} replace />;
  }

  if (sessionError) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-[var(--color-error)]">세션 정보를 불러올 수 없습니다. 새로고침해 주세요.</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-[var(--color-text-muted)]">불러오는 중…</p>
      </div>
    );
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

      <div className="flex items-start gap-4">
        {showAssessmentPanel && (
          <SessionAssessmentSidePanel
            lectureId={lecId}
            sessionId={sId}
            openCreateExam={openCreateExam}
            onCloseCreateExam={() => setOpenCreateExam(false)}
            onOpenCreateExam={() => setOpenCreateExam(true)}
            openCreateHomework={openCreateHomework}
            onCloseCreateHomework={() => setOpenCreateHomework(false)}
            onOpenCreateHomework={() => setOpenCreateHomework(true)}
          />
        )}
        <div className="flex-1 min-w-0">
          {activeTab === "attendance" && (
            <SessionAttendancePage
              sessionId={sId}
              lectureId={lecId}
              onOpenEnrollModal={() => setShowEnrollModal(true)}
            />
          )}

          {activeTab === "exams" &&
            (examId ? (
              <div className="flex flex-col">
                <SessionAssessmentWorkspace mode="exam" />
                <AssessmentDeleteBar
                  type="exam"
                  id={examId}
                  sessionId={sId}
                  onDeleted={() => navigate(`${basePath}/exams`)}
                />
              </div>
            ) : (
              <EmptyState
                scope="panel"
                tone="empty"
                title="좌측 패널에서 시험을 선택하세요"
                description="시험은 좌측 '+ 추가'로 생성할 수 있습니다."
              />
            ))}

          {activeTab === "scores" && (
            <SessionScoresEntryPage
              onOpenEnrollModal={() => setShowEnrollModal(true)}
              onOpenStudentModal={() => setShowStudentModal(true)}
            />
          )}

          {activeTab === "assignments" &&
            (homeworkId ? (
              <div className="flex flex-col">
                <SessionAssessmentWorkspace mode="homework" />
                <AssessmentDeleteBar
                  type="homework"
                  id={homeworkId}
                  sessionId={sId}
                  onDeleted={() => navigate(`${basePath}/assignments`)}
                />
              </div>
            ) : (
              <EmptyState
                scope="panel"
                tone="empty"
                title="좌측 패널에서 과제를 선택하세요"
                description="과제는 좌측 '+ 추가'로 생성할 수 있습니다."
              />
            ))}

          {activeTab === "videos" && (
            <SessionVideosTab sessionId={sId} />
          )}

          {activeTab === "clinic" && (
            <SessionClinicTab sessionId={sId} lectureId={lecId} />
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
