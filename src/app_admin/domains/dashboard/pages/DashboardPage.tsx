/**
 * PATH: src/app_admin/domains/dashboard/pages/DashboardPage.tsx
 * Dashboard — today's academy operations board.
 *
 * Existing read contracts remain the SSOT. This page only reorganizes the
 * current lecture, exam, submission, QnA, clinic, and messaging signals.
 */
import {
  lazy,
  Suspense,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  MessageCircleQuestion,
} from "lucide-react";
import { fetchCommunityQuestions } from "@admin/domains/community/api/community.api";
import { fetchExams } from "@admin/domains/exams/api/exams.api";
import { fetchLectures } from "@/shared/api/contracts/sessions";
import { useMessagingInfo } from "@admin/domains/messages/hooks/useMessagingInfo";
import { fetchAdminSubmissions } from "@admin/domains/submissions/api/adminSubmissions";
import { Button } from "@/shared/ui/ds";
import { InlineHelp } from "@/shared/ui/guide";
import { DomainLayout } from "@/shared/ui/layout";
import { adminDashboardQueryKeys } from "../queryKeys";
import ClinicRemoconIcon from "../components/ClinicRemoconIcon";
import styles from "./DashboardPage.module.css";

const ClinicPasscardModal = lazy(() => import("@admin/domains/clinic/components/ClinicPasscardModal"));

const TODAY_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

export default function DashboardPage() {
  const navigate = useNavigate();
  const [clinicPasscardModalOpen, setClinicPasscardModalOpen] = useState(false);

  const {
    data: messagingInfo,
    isLoading: messagingLoading,
    isError: messagingError,
  } = useMessagingInfo();
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

  const pendingQnaCount = questions.filter((question) => !question.is_answered).length;
  const activeExams = exams.filter((exam) => exam.is_active);
  const pendingSubs = recentSubs.filter(
    (submission) => submission.status !== "done" && submission.status !== "failed",
  );
  const todaySubs = recentSubs.filter((submission) => {
    const submittedAt = new Date(submission.created_at);
    return submittedAt.toDateString() === new Date().toDateString();
  });

  const overview = [
    {
      label: "운영 강의",
      value: lectures.length,
      unit: "개",
      note: "현재 활성 강의",
      loading: lLoading,
      error: lError,
      icon: BookOpenCheck,
      tone: "lecture",
    },
    {
      label: "운영 중 시험",
      value: activeExams.length,
      unit: "건",
      note: "진행·채점 확인",
      loading: eLoading,
      error: eError,
      icon: ClipboardCheck,
      tone: "exam",
    },
    {
      label: "오늘 학생 제출",
      value: todaySubs.length,
      unit: "건",
      note: "오늘 들어온 자료",
      loading: sLoading,
      error: sError,
      icon: FileCheck2,
      tone: "submission",
    },
    {
      label: "미답변 질문",
      value: pendingQnaCount,
      unit: "건",
      note: "답변을 기다리는 질문",
      loading: qLoading,
      error: qError,
      icon: MessageCircleQuestion,
      tone: "question",
    },
  ] as const;

  const hasOverviewError = overview.some((item) => item.error);
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
    },
    error: {
      title: "알림톡 상태를 확인하지 못했습니다",
      description: "일시적으로 설정 상태를 불러오지 못했습니다. 메시지 설정에서 다시 확인해 주세요.",
    },
    disconnected: {
      title: "발송 준비를 확인해 주세요",
      description: "현재 발송 준비가 완료되지 않았습니다. 설정 상태를 확인해 주세요.",
    },
    ready: {
      title: "알림톡 안내 준비",
      description: "자동 발송 범위와 직접 확인할 안내를 메시지 설정에서 구분합니다.",
    },
  }[alimtalkState];

  return (
    <DomainLayout
      title="대시보드"
      description="학원 운영 현황을 한눈에 확인하세요."
    >
      <div className={styles.dashboard}>
        <section className={styles.overviewBoard} aria-labelledby="dashboard-today-title">
          <header className={styles.overviewHeader}>
            <div>
              <span className={styles.dateLabel}>
                <CalendarDays size={15} aria-hidden="true" />
                {TODAY_FORMATTER.format(new Date())}
              </span>
              <h2 id="dashboard-today-title">오늘 학원 운영</h2>
              <p>수업을 시작하기 전에 확인할 현황을 한곳에 모았습니다.</p>
            </div>
            <span className={styles.boardState} data-error={hasOverviewError ? "true" : "false"}>
              {hasOverviewError ? (
                <>
                  <AlertTriangle size={15} aria-hidden="true" />
                  일부 현황 확인 필요
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} aria-hidden="true" />
                  운영 현황 확인
                </>
              )}
            </span>
          </header>

          <div className={styles.metricGrid}>
            {overview.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className={styles.metricCard} data-tone={item.tone}>
                  <span className={styles.metricIcon}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div className={styles.metricBody}>
                    <span>{item.label}</span>
                    {item.loading ? (
                      <span className={styles.metricLoading} aria-label="로딩 중" />
                    ) : item.error ? (
                      <strong className={styles.metricError}>확인 필요</strong>
                    ) : (
                      <strong>
                        {item.value}
                        <small>{item.unit}</small>
                      </strong>
                    )}
                    <small>{item.note}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

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
                loading={qLoading}
                error={qError}
                value={pendingQnaCount}
                action="답변하기"
                tone="question"
                icon={<MessageCircleQuestion size={20} aria-hidden="true" />}
                onClick={() => navigate("/workspace/community/qna")}
              />
              <TaskCard
                label="제출 채점 대기"
                description="들어온 제출 자료를 확인합니다."
                loading={sLoading}
                error={sError}
                value={pendingSubs.length}
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
                label="클리닉 패스카드"
                description="학생용 패스카드 화면을 준비합니다."
                action="설정 열기"
                tone="clinic"
                icon={<ClinicRemoconIcon />}
                onClick={() => setClinicPasscardModalOpen(true)}
                data-testid="dashboard-shortcut-clinic-passcard"
              />
            </div>
          </section>

          <aside className={styles.sideColumn}>
            <section className={styles.flowCard} aria-labelledby="dashboard-flow-title">
              <header className={styles.compactHeader}>
                <span>운영 흐름</span>
                <h2 id="dashboard-flow-title">기록이 이어지는 순서</h2>
              </header>
              <ol className={styles.flowList}>
                <li>
                  <span>01</span>
                  <div>
                    <strong>강의 운영</strong>
                    <small>활성 강의 {lLoading ? "확인 중" : `${lectures.length}개`}</small>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>시험·제출</strong>
                    <small>오늘 제출 {sLoading ? "확인 중" : `${todaySubs.length}건`}</small>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>질문·피드백</strong>
                    <small>미답변 {qLoading ? "확인 중" : `${pendingQnaCount}건`}</small>
                  </div>
                </li>
                <li>
                  <span>04</span>
                  <div>
                    <strong>후속 안내</strong>
                    <small>대상과 내용을 확인해 알림톡 발송</small>
                  </div>
                </li>
              </ol>
            </section>

            <section
              className={styles.messageCard}
              data-status={alimtalkState}
              aria-labelledby="dashboard-message-title"
            >
              <span className={styles.messageIcon}>
                <BellRing size={20} aria-hidden="true" />
              </span>
              <div>
                <span>알림톡 상태</span>
                <h2 id="dashboard-message-title">{alimtalkCopy.title}</h2>
                <p>{alimtalkCopy.description}</p>
                <Button
                  size="sm"
                  intent={alimtalkState === "ready" || alimtalkState === "loading" ? "secondary" : "primary"}
                  onClick={() => navigate("/workspace/message/settings")}
                >
                  메시지 설정 보기
                </Button>
              </div>
            </section>
          </aside>
        </div>
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
