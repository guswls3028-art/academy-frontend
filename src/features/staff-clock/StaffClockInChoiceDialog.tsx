import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import {
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  Clock3,
  Stethoscope,
} from "lucide-react";
import { AdminModal, ModalBody, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import type { AssignedWorkType } from "./api";
import {
  clearStaffClockInChoicePending,
  hasPendingStaffClockInChoice,
  subscribeStaffClockInChoice,
} from "./promptSession";
import { useStaffClock } from "./useStaffClock";
import styles from "./StaffClockInChoiceDialog.module.css";
import useAuth from "@/auth/hooks/useAuth";

function WorkTypeIcon({ name }: { name: string }) {
  if (name.includes("클리닉")) return <Stethoscope aria-hidden />;
  if (name.includes("현장")) return <Building2 aria-hidden />;
  if (name.includes("채점") || name.includes("수업")) return <BookOpenCheck aria-hidden />;
  return <BriefcaseBusiness aria-hidden />;
}

export default function StaffClockInChoiceDialog() {
  const location = useLocation();
  const { user } = useAuth();
  const pendingPrompt = useSyncExternalStore(
    subscribeStaffClockInChoice,
    hasPendingStaffClockInChoice,
    () => false,
  );
  const clock = useStaffClock();
  const isWorkspace = location.pathname.startsWith("/workspace");
  const accountSetupBlocking = Boolean(
    user?.must_change_password || user?.first_login_guide_required,
  );

  useEffect(() => {
    if (pendingPrompt && clock.isWorking) {
      clearStaffClockInChoicePending();
    }
  }, [clock.isWorking, pendingPrompt]);

  useEffect(() => {
    if (pendingPrompt && clock.isAuthenticated && !clock.shouldPromptForClockIn) {
      clearStaffClockInChoicePending();
    }
  }, [clock.isAuthenticated, clock.shouldPromptForClockIn, pendingPrompt]);

  if (
    !pendingPrompt
    || !isWorkspace
    || accountSetupBlocking
    || !clock.shouldPromptForClockIn
    || clock.isWorking
  ) {
    return null;
  }

  const chooseWorkType = async (workType: AssignedWorkType) => {
    try {
      await clock.startWork(workType);
      clearStaffClockInChoicePending();
      feedback.success(`${workType.name} 근무를 시작했습니다.`);
    } catch {
      // useStaffClock가 정확한 API 오류를 안내하고 선택창은 다시 시도할 수 있게 유지한다.
    }
  };

  const continueWithoutClockIn = () => {
    clearStaffClockInChoicePending();
    feedback.info("근무시간을 시작하지 않고 로그인했습니다.");
  };

  const hasLoadError = clock.staffMeQ.isError || clock.currentQ.isError;
  const loading = clock.staffMeQ.isLoading
    || (clock.staffId != null && clock.currentQ.isLoading);

  return (
    <AdminModal
      open
      onClose={() => undefined}
      type="confirm"
      width={560}
      noMinimize
      closeDisabled={clock.isStarting}
      className={styles.modal}
    >
      <ModalHeader
        title="오늘 어떤 방식으로 시작할까요?"
        description="로그인만으로는 근무시간이 시작되지 않습니다. 근무를 선택한 시점부터 조교비 시간이 계산됩니다."
        noIcon
      />
      <ModalBody>
        <div className={styles.clockStage} aria-live="polite">
          <span className={styles.clockIcon}><Clock3 aria-hidden /></span>
          <div>
            <div className={styles.clockValue}>00:00</div>
            <div className={styles.clockStatus}>아직 근무 시작 전</div>
          </div>
        </div>

        {loading ? (
          <EmptyState scope="panel" tone="loading" title="근무 유형을 확인하고 있습니다" />
        ) : hasLoadError ? (
          <EmptyState
            scope="panel"
            tone="error"
            title="근무 정보를 불러오지 못했습니다"
            description="출근하지 않은 상태입니다. 연결을 확인한 뒤 다시 시도해 주세요."
            actions={
              <Button
                intent="secondary"
                size="sm"
                onClick={() => {
                  void clock.staffMeQ.refetch();
                  if (clock.staffId != null) void clock.currentQ.refetch();
                }}
              >
                다시 시도
              </Button>
            }
          />
        ) : (
          <div className={styles.choiceList} aria-label="출근 유형 선택">
            {clock.assignedWorkTypes.map((workType) => (
              <button
                key={workType.id}
                type="button"
                className={styles.workChoice}
                disabled={clock.isStarting}
                onClick={() => void chooseWorkType(workType)}
                aria-label={`${workType.name} 근무 시작`}
              >
                <span className={styles.choiceIcon}>
                  <WorkTypeIcon name={workType.name} />
                </span>
                <span className={styles.choiceCopy}>
                  <strong>{workType.name}</strong>
                  <span>{workType.hourly_wage.toLocaleString()}원/시간 · 선택하면 바로 출근</span>
                </span>
                <span className={styles.choiceAction}>
                  {clock.isStarting ? "처리 중" : "출근"}
                </span>
              </button>
            ))}

            {clock.assignedWorkTypes.length === 0 && (
              <div className={styles.unassigned} role="status">
                배정된 근무 유형이 없어 출근할 수 없습니다. 관리자에게 클리닉·현장 조교 유형 배정을 요청해 주세요.
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className={styles.noClockChoice}
          disabled={clock.isStarting}
          onClick={continueWithoutClockIn}
        >
          <span>
            <strong>출근하지 않고 로그인</strong>
            <small>매뉴얼 확인 등 근무 외 이용 · 시간과 조교비가 올라가지 않음</small>
          </span>
          <span aria-hidden>계속</span>
        </button>
      </ModalBody>
    </AdminModal>
  );
}
