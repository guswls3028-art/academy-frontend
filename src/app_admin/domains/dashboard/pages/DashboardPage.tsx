/**
 * PATH: src/app_admin/domains/dashboard/pages/DashboardPage.tsx
 * Dashboard — 학원 운영 현황
 *   1. 요약 지표(KPI)  · 학원 상태 한눈에
 *   2. 오늘 처리할 일  · 동사형 CTA — 한 번에 액션 화면으로 진입
 *   3. 메시지 미연동 경고 (조건부) · 발송 차단 상태 즉시 인지
 *
 * 사이드바와 100% 중복되던 「바로가기」 8칸은 제거. 대시보드 본 가치는
 * "어디로 갈지" 가 아니라 "지금 무엇을 처리해야 하는지".
 */
import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCommunityQuestions } from "@admin/domains/community/api/community.api";
import { fetchExams } from "@admin/domains/exams/api/exams.api";
import { fetchLectures } from "@admin/domains/lectures/api/sessions";
import { useMessagingInfo } from "@admin/domains/messages/hooks/useMessagingInfo";
import { fetchAdminSubmissions } from "@admin/domains/submissions/api/adminSubmissions";
import { Button } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
import ClinicRemoconIcon from "../components/ClinicRemoconIcon";
import DashboardWidget from "../components/DashboardWidget";

const ClinicPasscardModal = lazy(() => import("@admin/domains/clinic/components/ClinicPasscardModal"));

export default function DashboardPage() {
  const navigate = useNavigate();
  const [clinicPasscardModalOpen, setClinicPasscardModalOpen] = useState(false);

  const { data: messagingInfo } = useMessagingInfo();
  const { data: questions = [], isLoading: qLoading, isError: qError } = useQuery({
    queryKey: ["dashboard-pending-questions"],
    queryFn: () => fetchCommunityQuestions(null),
    staleTime: 60 * 1000,
  });
  const { data: lectures = [], isLoading: lLoading, isError: lError } = useQuery({
    queryKey: ["dashboard-lectures"],
    queryFn: () => fetchLectures({ is_active: true }),
    staleTime: 60 * 1000,
  });
  const { data: exams = [], isLoading: eLoading, isError: eError } = useQuery({
    queryKey: ["dashboard-exams"],
    queryFn: () => fetchExams(),
    staleTime: 60 * 1000,
  });
  const { data: recentSubs = [], isLoading: sLoading, isError: sError } = useQuery({
    queryKey: ["dashboard-recent-submissions"],
    queryFn: () => fetchAdminSubmissions({ limit: 50 }),
    staleTime: 60 * 1000,
  });

  const pendingQnaCount = questions.filter((q) => !q.is_answered).length;
  const activeExams = exams.filter((e) => e.is_active);
  const pendingSubs = recentSubs.filter(
    (s) => s.status !== "done" && s.status !== "failed",
  );
  const todaySubs = recentSubs.filter((s) => {
    const d = new Date(s.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const messagingDisconnected = messagingInfo && !messagingInfo.sms_allowed;

  return (
    <DomainLayout
      title="대시보드"
      description="학원 운영 현황을 한눈에 확인하세요."
    >
      <div className="flex flex-col gap-6" style={{ padding: 0 }}>
        {/* 1) 요약 지표 — 학원 상태 한눈에 */}
        <DashboardWidget title="요약 지표" description="운영 현황">
          <div className="ds-section__kpi-list">
            <KpiRow label="운영 강의" value={lError ? "불러오기 실패" : lLoading ? "로딩 중…" : `${lectures.length}개`} />
            <KpiRow label="운영 중 시험" value={eError ? "불러오기 실패" : eLoading ? "로딩 중…" : `${activeExams.length}건`} />
            <KpiRow label="오늘 학생 제출" value={sError ? "불러오기 실패" : sLoading ? "로딩 중…" : `${todaySubs.length}건`} />
            <KpiRow label="미답변 질의" value={qError ? "불러오기 실패" : qLoading ? "로딩 중…" : `${pendingQnaCount}건`} />
          </div>
        </DashboardWidget>

        {/* 2) 오늘 처리할 일 — 동사형 CTA, 한 클릭으로 액션 진입 */}
        <DashboardWidget
          title="오늘 처리할 일"
          description="아래 항목은 학생/학부모가 기다리고 있습니다."
        >
          <div className="ds-section__kpi-list">
            <TodoRow
              label="미답변 질의"
              value={qError ? "불러오기 실패" : qLoading ? "로딩 중…" : `답변하기 ${pendingQnaCount}건`}
              onClick={() => navigate("/admin/community/qna")}
            />
            <TodoRow
              label="제출 채점 대기"
              value={sError ? "불러오기 실패" : sLoading ? "로딩 중…" : `채점하기 ${pendingSubs.length}건`}
              onClick={() => navigate("/admin/results/submissions")}
            />
            <TodoRow
              label="운영 중 시험"
              value={eError ? "불러오기 실패" : eLoading ? "로딩 중…" : `관리하기 ${activeExams.length}건`}
              onClick={() => navigate("/admin/exams")}
            />
            <TodoRow
              label="클리닉 패스카드"
              value="설정 열기"
              icon={<ClinicRemoconIcon />}
              onClick={() => setClinicPasscardModalOpen(true)}
              data-testid="dashboard-shortcut-clinic-passcard"
            />
          </div>
        </DashboardWidget>

        {/* 3) 메시지 미연동 경고 — 발송 차단 상태일 때만 노출 */}
        {messagingDisconnected && (
          <DashboardWidget
            title="메시지 발송 미연동"
            description="현재 알림톡/SMS 발송이 차단되어 있습니다. 자동·수동 발송이 모두 실패합니다."
          >
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm" intent="primary" onClick={() => navigate("/admin/message/settings")}>
                연동 설정 열기
              </Button>
            </div>
          </DashboardWidget>
        )}
      </div>

      <Suspense fallback={null}>
        <ClinicPasscardModal
          open={clinicPasscardModalOpen}
          onClose={() => setClinicPasscardModalOpen(false)}
        />
      </Suspense>
    </DomainLayout>
  );
}

function TodoRow({
  label,
  value,
  icon,
  onClick,
  ...rest
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  onClick: () => void;
  [key: string]: any;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ds-section__item ds-section__kpi-row"
      style={{
        width: "100%",
        cursor: "pointer",
        background: "transparent",
        border: "none",
        font: "inherit",
        color: "inherit",
        textAlign: "left",
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        {icon ? <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span> : null}
        <span className="ds-section__kpi-label">{label}</span>
      </span>
      <span className="ds-section__kpi-value" style={{ flexShrink: 0 }}>{value}</span>
    </button>
  );
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ds-section__kpi-row">
      <span className="ds-section__kpi-label">{label}</span>
      <span className="ds-section__kpi-value">{value}</span>
    </div>
  );
}
