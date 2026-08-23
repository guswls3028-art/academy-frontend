/**
 * PATH: src/app_admin/domains/dashboard/pages/DashboardPage.tsx
 * Dashboard — today's academy operations board.
 *
 * Existing read contracts remain the SSOT. This page only reorganizes the
 * current lecture, exam, submission, QnA, clinic, and messaging signals.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  MessageCircle,
  MessageCircleQuestion,
} from "lucide-react";
import { fetchExams } from "@admin/domains/exams/api/exams.api";
import { useMessagingInfo } from "@admin/domains/messages/hooks/useMessagingInfo";
import {
  arrivalOverviewQueryKey,
  fetchArrivalOverview,
  type ArrivalOverviewItem,
} from "@/shared/api/contracts/arrivalOverview";
import { Badge, Button } from "@/shared/ui/ds";
import { InlineHelp } from "@/shared/ui/guide";
import { DomainLayout } from "@/shared/ui/layout";
import { useOperationalNotificationCounts } from "@/shared/hooks/useOperationalNotificationCounts";
import { adminDashboardQueryKeys } from "../queryKeys";
import {
  ArrivalOperationsBoard,
  UpcomingArrivalCard,
} from "../components/ArrivalOperationsBoard";
import styles from "./DashboardPage.module.css";

export default function DashboardPage() {
  const navigate = useNavigate();
  const operationalNotifications = useOperationalNotificationCounts();

  const {
    data: messagingInfo,
    isLoading: messagingLoading,
    isError: messagingError,
  } = useMessagingInfo();
  const { data: exams = [], isLoading: eLoading, isError: eError } = useQuery({
    queryKey: adminDashboardQueryKeys.exams,
    queryFn: () => fetchExams(),
    staleTime: 60 * 1000,
  });
  const arrivalQuery = useQuery({
    queryKey: arrivalOverviewQueryKey,
    queryFn: fetchArrivalOverview,
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
  });

  const notificationSourceFailed = (source: typeof operationalNotifications.failures[number]) => (
    operationalNotifications.isError || operationalNotifications.failures.includes(source)
  );
  const pendingQnaCount = operationalNotifications.counts.qnaPending;
  const activeExams = exams.filter((exam) => exam.is_active);
  const pendingSubmissionCount = operationalNotifications.counts.recentSubmissions;
  const pendingClinicCount = operationalNotifications.counts.clinicPending;
  const openArrival = (item: ArrivalOverviewItem) => {
    if (item.source === "supplement" && item.lecture_id && item.session_id) {
      navigate(`/workspace/lectures/${item.lecture_id}/sessions/${item.session_id}/attendance`);
      return;
    }
    if (item.clinic_session_id) {
      navigate(`/workspace/clinic/operations?session=${item.clinic_session_id}`);
      return;
    }
    navigate("/workspace/clinic/bookings");
  };
  const alimtalkState = messagingLoading
    ? "loading"
    : messagingError || !messagingInfo
      ? "error"
      : messagingInfo.alimtalk_available
        ? "ready"
        : "disconnected";
  const alimtalkCopy = {
    loading: {
      title: "알림톡 상태를 확인하고 있습니다",
      description: "연동 및 발송 설정을 불러오는 중입니다.",
      badge: "확인 중",
      tone: "info" as const,
    },
    error: {
      title: "알림톡 상태를 확인하지 못했습니다",
      description: "일시적으로 설정 상태를 불러오지 못했습니다. 메시지 설정에서 다시 확인해 주세요.",
      badge: "불러오기 실패",
      tone: "danger" as const,
    },
    disconnected: {
      title: "발송 준비를 확인해 주세요",
      description: "현재 발송 준비가 완료되지 않았습니다. 설정 상태를 확인해 주세요.",
      badge: "설정 필요",
      tone: "warning" as const,
    },
    ready: {
      title: "알림톡 발송 가능",
      description: "자동 안내와 직접 발송을 사용할 수 있습니다. 결과는 발송 내역에서 확인하세요.",
      badge: "정상",
      tone: "success" as const,
    },
  }[alimtalkState];

  return (
    <DomainLayout
      title="대시보드"
      description="학원 운영 현황을 한눈에 확인하세요."
    >
      <div className={styles.dashboard}>
        <ArrivalOperationsBoard
          data={arrivalQuery.data}
          loading={arrivalQuery.isLoading}
          error={arrivalQuery.isError}
          onRetry={() => arrivalQuery.refetch()}
          onNavigate={openArrival}
          onOpenSupplement={() => navigate("/workspace/lectures")}
          onOpenClinic={() => navigate("/workspace/clinic/bookings")}
        />

        <div className={styles.workspaceGrid}>
          <section className={styles.taskBoard} aria-labelledby="dashboard-task-title">
            <header className={styles.sectionHeader}>
              <div>
                <span>먼저 확인할 업무</span>
                <div className={styles.sectionTitleRow}>
                  <h2 id="dashboard-task-title">오늘 처리할 일</h2>
                  <InlineHelp
                    title="오늘 처리할 일 안내"
                    ariaLabel="오늘 처리할 일 도움말"
                    tone="admin"
                    align="left"
                  >
                    <p>아래 항목은 학생/학부모가 기다리고 있습니다.</p>
                  </InlineHelp>
                </div>
                <p>대기 중인 업무를 누르면 바로 해당 화면으로 이동합니다.</p>
              </div>
            </header>

            <div className={styles.taskGrid}>
              <TaskCard
                label="미답변 질문"
                description="학생 질문에 답변합니다."
                loading={operationalNotifications.isLoading}
                error={notificationSourceFailed("qna")}
                value={pendingQnaCount}
                action="답변하기"
                tone="question"
                icon={<MessageCircleQuestion size={20} aria-hidden="true" />}
                onClick={() => navigate("/workspace/community/qna")}
              />
              <TaskCard
                label="제출 채점 대기"
                description="들어온 제출 자료를 확인합니다."
                loading={operationalNotifications.isLoading}
                error={notificationSourceFailed("submissions")}
                value={pendingSubmissionCount}
                action="채점하기"
                tone="submission"
                icon={<FileCheck2 size={20} aria-hidden="true" />}
                onClick={() => navigate("/workspace/results/submissions")}
              />
              <TaskCard
                label="운영 중 시험"
                description="진행 상태와 결과를 관리합니다."
                loading={eLoading}
                error={eError}
                value={activeExams.length}
                action="관리하기"
                tone="exam"
                icon={<ClipboardCheck size={20} aria-hidden="true" />}
                onClick={() => navigate("/workspace/exams")}
              />
              <TaskCard
                label="클리닉 승인 대기"
                description="학생이 신청한 일정을 확인합니다."
                loading={operationalNotifications.isLoading}
                error={notificationSourceFailed("clinic")}
                value={pendingClinicCount}
                action="예약 확인"
                tone="clinic"
                icon={<CalendarClock size={20} aria-hidden="true" />}
                onClick={() => navigate("/workspace/clinic/bookings?focus=pending")}
              />
            </div>
          </section>

          <aside className={styles.sideColumn}>
            <UpcomingArrivalCard
              data={arrivalQuery.data}
              loading={arrivalQuery.isLoading}
              error={arrivalQuery.isError}
              onNavigate={openArrival}
            />

            <section
              className={styles.messageCard}
              data-status={alimtalkState}
              aria-labelledby="dashboard-message-title"
            >
              <div className={styles.messageCardTop}>
                <span className={styles.messageIcon}>
                  <MessageCircle size={20} fill="currentColor" aria-hidden="true" />
                </span>
                <span className={styles.messageChannel}>
                  <strong>카카오 알림톡</strong>
                  <small>우리 학원 안내 채널</small>
                </span>
                <Badge tone={alimtalkCopy.tone} size="sm" variant="soft">
                  {alimtalkCopy.badge}
                </Badge>
              </div>
              <div className={styles.messageBubble}>
                <span>알림톡 상태</span>
                <h2 id="dashboard-message-title">{alimtalkCopy.title}</h2>
                <p>{alimtalkCopy.description}</p>
              </div>
              <div className={styles.messageActions}>
                <Button
                  size="sm"
                  intent="secondary"
                  onClick={() => navigate("/workspace/message/log")}
                >
                  발송 내역
                </Button>
                <Button
                  size="sm"
                  intent={alimtalkState === "ready" || alimtalkState === "loading" ? "secondary" : "primary"}
                  onClick={() => navigate("/workspace/message/settings")}
                >
                  메시지 설정
                </Button>
              </div>
            </section>
          </aside>
        </div>
      </div>

    </DomainLayout>
  );
}

function TaskCard({
  label,
  description,
  value,
  action,
  loading,
  error,
  tone,
  icon,
  onClick,
  ...rest
}: {
  label: string;
  description: string;
  value?: number;
  action: string;
  loading?: boolean;
  error?: boolean;
  tone: "question" | "submission" | "exam" | "clinic";
  icon: ReactNode;
  onClick: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.taskCard}
      data-tone={tone}
      {...rest}
    >
      <span className={styles.taskIcon}>{icon}</span>
      <span className={styles.taskCopy}>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className={styles.taskAction}>
        {loading ? (
          <span className={styles.taskLoading} aria-label="로딩 중" />
        ) : error ? (
          <strong className={styles.taskError}>확인 필요</strong>
        ) : typeof value === "number" ? (
          <strong>{value}건</strong>
        ) : null}
        <small>
          {action}
          <ArrowRight size={14} aria-hidden="true" />
        </small>
      </span>
    </button>
  );
}
