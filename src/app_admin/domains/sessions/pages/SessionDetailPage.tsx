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

import { lazy, Suspense, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { BarChart3, ClipboardList, FileText, Plus } from "lucide-react";

import api from "@/shared/api/axios";
import { useLectureParams } from "@admin/domains/lectures/hooks/useLectureParams";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import RouteFallback from "@/core/router/RouteFallback";

import AssessmentDeleteBar from "../components/AssessmentDeleteBar";
import { readAssessmentItemId } from "@/shared/lib/assessmentQueryParams";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import "./SessionDetailPage.css";

const SessionBlock = lazy(() => import("@admin/domains/sessions/components/SessionBlock"));
const SessionEnrollModal = lazy(() => import("@admin/domains/lectures/components/SessionEnrollModal"));
const SessionVideosTab = lazy(() => import("@admin/domains/lectures/components/SessionVideosTab"));
const SessionAssessmentSidePanel = lazy(() => import("../components/SessionAssessmentSidePanel"));
const SessionAttendancePage = lazy(() => import("@admin/domains/lectures/pages/attendance/SessionAttendancePage"));
const SessionScoresEntryPage = lazy(() => import("@admin/domains/lectures/pages/scores/SessionScoresEntryPage"));
const SessionAssessmentWorkspace = lazy(() => import("@admin/domains/sessions/components/SessionAssessmentWorkspace"));
const SessionClinicTab = lazy(() => import("@admin/domains/sessions/components/SessionClinicTab"));

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
    qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sId) });
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
    activeTab === "scores" ||
    activeTab === "exams" ||
    activeTab === "assignments";
  const moveAssessmentPanelAfterContentOnMobile =
    activeTab === "scores" ||
    (activeTab === "exams" && examId != null) ||
    (activeTab === "assignments" && homeworkId != null);
  const showSessionStrip =
    activeTab === "attendance" ||
    activeTab === "scores" ||
    activeTab === "exams" ||
    activeTab === "assignments";

  return (
    <Suspense fallback={<RouteFallback />}>
      {showSessionStrip && (
        <div className="session-detail-session-strip">
          <SessionBlock lectureId={lecId} currentSessionId={sId} />
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {showAssessmentPanel && (
          <div className={moveAssessmentPanelAfterContentOnMobile ? "order-2 w-full lg:order-none lg:w-auto" : "w-full lg:w-auto"}>
            <SessionAssessmentSidePanel
              lectureId={lecId}
              sessionId={sId}
              activeKind={activeTab === "assignments" ? "homework" : "exam"}
              openCreateExam={openCreateExam}
              onCloseCreateExam={() => setOpenCreateExam(false)}
              onOpenCreateExam={() => setOpenCreateExam(true)}
              openCreateHomework={openCreateHomework}
              onCloseCreateHomework={() => setOpenCreateHomework(false)}
              onOpenCreateHomework={() => setOpenCreateHomework(true)}
            />
          </div>
        )}
        <div className="order-1 min-w-0 w-full lg:order-none lg:flex-1">
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
              <AssessmentEmptyPanel
                kind="exam"
                onCreate={() => setOpenCreateExam(true)}
                onScores={() => navigate(`${basePath}/scores`)}
              />
            ))}

          {activeTab === "scores" && (
            <SessionScoresEntryPage
              onOpenCreateExam={() => setOpenCreateExam(true)}
              onOpenCreateHomework={() => setOpenCreateHomework(true)}
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
              <AssessmentEmptyPanel
                kind="homework"
                onCreate={() => setOpenCreateHomework(true)}
                onScores={() => navigate(`${basePath}/scores`)}
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
    </Suspense>
  );
}

function AssessmentEmptyPanel({
  kind,
  onCreate,
  onScores,
}: {
  kind: "exam" | "homework";
  onCreate: () => void;
  onScores: () => void;
}) {
  const isExam = kind === "exam";
  const Icon = isExam ? ClipboardList : FileText;
  const label = isExam ? "시험" : "과제";

  return (
    <section className="session-assessment-empty" aria-label={`${label} 작업 상태`}>
      <div className="session-assessment-empty__icon" aria-hidden>
        <Icon size={24} />
      </div>
      <div className="session-assessment-empty__body">
        <p className="session-assessment-empty__eyebrow">차시 평가</p>
        <h2 className="session-assessment-empty__title">{label} 없음</h2>
        <p className="session-assessment-empty__copy">
          이 차시에 연결된 {label}이 없습니다.
        </p>
      </div>
      <div className="session-assessment-empty__actions">
        <Button
          type="button"
          intent="primary"
          size="md"
          leftIcon={<Plus size={ICON_FOR_BUTTON.md} />}
          onClick={onCreate}
        >
          {label} 추가
        </Button>
        <Button
          type="button"
          intent="secondary"
          size="md"
          leftIcon={<BarChart3 size={ICON_FOR_BUTTON.md} />}
          onClick={onScores}
        >
          성적
        </Button>
      </div>
    </section>
  );
}
