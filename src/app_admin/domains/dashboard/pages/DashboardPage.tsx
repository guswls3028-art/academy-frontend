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
import {
  useState,
  lazy,
  Suspense,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCommunityQuestions } from "@admin/domains/community/api/community.api";
import { fetchExams } from "@admin/domains/exams/api/exams.api";
import { fetchLectures } from "@/shared/api/contracts/sessions";
import { useMessagingInfo } from "@admin/domains/messages/hooks/useMessagingInfo";
import { fetchAdminSubmissions } from "@admin/domains/submissions/api/adminSubmissions";
import { fetchLegalConfig } from "@admin/domains/legal/api/legal.api";
import { Button } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
import useAuth from "@/auth/hooks/useAuth";
import { legalQueryKeys } from "@/shared/api/queryKeys/legal";
import { adminDashboardQueryKeys } from "../queryKeys";
import ClinicRemoconIcon from "../components/ClinicRemoconIcon";
import DashboardWidget from "../components/DashboardWidget";
import styles from "./DashboardPage.module.css";

const ClinicPasscardModal = lazy(() => import("@admin/domains/clinic/components/ClinicPasscardModal"));

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clinicPasscardModalOpen, setClinicPasscardModalOpen] = useState(false);
  const isTenantAdmin = user?.tenantRole === "owner" || user?.tenantRole === "admin" || !!user?.is_superuser;

  const { data: messagingInfo } = useMessagingInfo();
  const { data: questions = [], isLoading: qLoading, isError: qError } = useQuery({
    queryKey: adminDashboardQueryKeys.pendingQuestions,
    queryFn: () => fetchCommunityQuestions(null),
    staleTime: 60 * 1000,
  });
  const { data: lectures = [], isLoading: lLoading, isError: lError } = useQuery({
    queryKey: adminDashboardQueryKeys.lectures,
    queryFn: () => fetchLectures({ is_active: true }),
    staleTime: 60 * 1000,
  });
  const { data: exams = [], isLoading: eLoading, isError: eError } = useQuery({
    queryKey: adminDashboardQueryKeys.exams,
    queryFn: () => fetchExams(),
    staleTime: 60 * 1000,
  });
  const { data: recentSubs = [], isLoading: sLoading, isError: sError } = useQuery({
    queryKey: adminDashboardQueryKeys.recentSubmissions,
    queryFn: () => fetchAdminSubmissions({ limit: 50 }),
    staleTime: 60 * 1000,
  });
  const { data: legalConfig, isLoading: legalLoading } = useQuery({
    queryKey: legalQueryKeys.config,
    queryFn: fetchLegalConfig,
    staleTime: 5 * 60 * 1000,
    enabled: isTenantAdmin,
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

  const alimtalkDisconnected = messagingInfo && !messagingInfo.alimtalk_available;
  const missingLegalCount = !isTenantAdmin
    ? 0
    : [
        legalConfig?.company_name,
        legalConfig?.representative,
        legalConfig?.business_number,
        legalConfig?.support_phone,
        legalConfig?.privacy_officer_name,
        legalConfig?.privacy_officer_contact,
      ].filter((value) => !String(value ?? "").trim()).length;

  return (
    <DomainLayout
      title="대시보드"
      description="학원 운영 현황을 한눈에 확인하세요."
    >
      <div className={styles.stack}>
        <OnboardingPanel
          isTenantAdmin={isTenantAdmin}
          missingLegalCount={missingLegalCount}
          legalLoading={legalLoading}
          onNavigate={navigate}
        />

        {/* 1) 요약 지표 — 학원 상태 한눈에 */}
        <DashboardWidget title="요약 지표" description="운영 현황">
          <div className="ds-section__kpi-list">
            <KpiRow label="운영 강의" loading={lLoading} error={lError} value={`${lectures.length}개`} />
            <KpiRow label="운영 중 시험" loading={eLoading} error={eError} value={`${activeExams.length}건`} />
            <KpiRow label="오늘 학생 제출" loading={sLoading} error={sError} value={`${todaySubs.length}건`} />
            <KpiRow label="미답변 질의" loading={qLoading} error={qError} value={`${pendingQnaCount}건`} />
          </div>
        </DashboardWidget>

        {/* 2) 오늘 처리할 일 — 동사형 CTA, 한 클릭으로 액션 진입 */}
        <DashboardWidget
          title="오늘 처리할 일"
          description="아래 항목은 학생/학부모가 기다리고 있습니다."
        >
          <div className={styles.todoList}>
            <TodoRow
              label="미답변 질의"
              loading={qLoading}
              error={qError}
              value={`답변하기 ${pendingQnaCount}건`}
              onClick={() => navigate("/admin/community/qna")}
            />
            <TodoRow
              label="제출 채점 대기"
              loading={sLoading}
              error={sError}
              value={`채점하기 ${pendingSubs.length}건`}
              onClick={() => navigate("/admin/results/submissions")}
            />
            <TodoRow
              label="운영 중 시험"
              loading={eLoading}
              error={eError}
              value={`관리하기 ${activeExams.length}건`}
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

        {/* 3) 알림톡 미연동 경고 — 알림톡 발송 차단 상태일 때만 노출 */}
        {alimtalkDisconnected && (
          <DashboardWidget
            title="알림톡 발송 미연동"
            description="현재 알림톡 발송 준비가 완료되지 않았습니다. 승인 템플릿과 공용 채널 상태를 확인해 주세요."
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

function OnboardingPanel({
  isTenantAdmin,
  missingLegalCount,
  legalLoading,
  onNavigate,
}: {
  isTenantAdmin: boolean;
  missingLegalCount: number;
  legalLoading: boolean;
  onNavigate: (to: string) => void;
}) {
  const legalStatus = legalLoading
    ? "확인 중"
    : missingLegalCount > 0
      ? `${missingLegalCount}개 비어 있음`
      : "완료";

  return (
    <DashboardWidget
      title="처음 시작하기"
      description="대표와 선생님이 먼저 확인하면 좋은 흐름입니다."
      className={styles.onboardingWidget}
    >
      <div className={styles.onboardingList}>
        <OnboardingRow
          label="흐름 보기"
          title="사용 가이드에서 전체 업무 순서를 먼저 확인하세요."
          description="학생 등록, 강의 생성, 시험·영상·알림톡까지 단계별로 볼 수 있습니다."
          action="가이드 보기"
          onClick={() => onNavigate("/admin/guide")}
        />
        {isTenantAdmin && (
          <OnboardingRow
            label="대표 설정"
            title="법적 고지 정보와 학원 기본 정보를 채워 주세요."
            description={`학생·학부모가 보는 약관과 개인정보처리방침에 표시됩니다. 현재 ${legalStatus}.`}
            action="설정 열기"
            tone={missingLegalCount > 0 ? "warning" : "default"}
            onClick={() => onNavigate("/admin/settings/organization")}
          />
        )}
        <OnboardingRow
          label="학생 준비"
          title="학생을 등록하거나 가입 신청을 승인하세요."
          description="아이디와 초기 비밀번호가 준비되면 학생·학부모가 바로 로그인할 수 있습니다."
          action="학생 관리"
          onClick={() => onNavigate("/admin/students")}
        />
        <OnboardingRow
          label="수업 준비"
          title="강의를 만들고 오늘 수업 흐름을 잡으세요."
          description="강의와 차시를 만들면 출결, 시험, 영상, 과제가 이어집니다."
          action="강의 관리"
          onClick={() => onNavigate("/admin/lectures")}
        />
      </div>
    </DashboardWidget>
  );
}

function OnboardingRow({
  label,
  title,
  description,
  action,
  tone = "default",
  onClick,
}: {
  label: string;
  title: string;
  description: string;
  action: string;
  tone?: "default" | "warning";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.onboardingRow}
      data-tone={tone}
      onClick={onClick}
    >
      <span className={styles.onboardingLabel}>{label}</span>
      <span className={styles.onboardingCopy}>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className={styles.onboardingAction}>{action} →</span>
    </button>
  );
}

function TodoRow({
  label,
  value,
  loading,
  error,
  icon,
  onClick,
  ...rest
}: {
  label: string;
  value: string;
  loading?: boolean;
  error?: boolean;
  icon?: ReactNode;
  onClick: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.todoRow}
      {...rest}
    >
      <span className={styles.todoLabelGroup}>
        {icon ? <span className={styles.todoIcon}>{icon}</span> : null}
        <span className={styles.todoLabel}>{label}</span>
      </span>
      {loading ? (
        <span
          aria-label="로딩 중"
          className={`skeleton ${styles.todoSkeleton}`}
        />
      ) : error ? (
        <span className={styles.todoError}>
          불러오기 실패 →
        </span>
      ) : (
        <span className={styles.todoValue}>{value} →</span>
      )}
    </button>
  );
}

function KpiRow({ label, value, loading, error }: { label: string; value: string; loading?: boolean; error?: boolean }) {
  return (
    <div className="ds-section__kpi-row">
      <span className="ds-section__kpi-label">{label}</span>
      {loading ? (
        <span
          aria-label="로딩 중"
          className={`skeleton ds-section__kpi-value ${styles.kpiSkeleton}`}
        />
      ) : error ? (
        <span className={`ds-section__kpi-value ${styles.kpiError}`}>
          불러오기 실패
        </span>
      ) : (
        <span className="ds-section__kpi-value">{value}</span>
      )}
    </div>
  );
}
