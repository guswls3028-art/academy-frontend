import { useState } from "react";
import { Coffee, LogIn, LogOut, Play, TimerReset } from "lucide-react";
import { AdminModal, ModalBody, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import type { AssignedWorkType } from "./api";
import { useStaffClock } from "./useStaffClock";
import styles from "./CompactStaffClockButton.module.css";

export default function CompactStaffClockButton() {
  const [open, setOpen] = useState(false);
  const clock = useStaffClock();

  const hasRecoverableIdentityState = clock.staffMeQ.isLoading || clock.staffMeQ.isError;
  if (!clock.canUseClock && !hasRecoverableIdentityState) return null;

  const statusLabel = clock.isOnBreak
    ? "휴식 중"
    : clock.isWorking
      ? "근무 중"
      : "출근하지 않음";
  const currentType = clock.current?.status !== "OFF"
    ? clock.current?.work_type_name
    : null;
  const triggerLabel = clock.staffMeQ.isError || clock.currentQ.isError
    ? "근무 상태를 불러오지 못함, 자세히 보기"
    : clock.currentQ.isLoading || clock.staffMeQ.isLoading
    ? "근무 상태 확인 중"
    : clock.isWorking
      ? `${currentType ?? "근무"} ${statusLabel}, ${clock.timeLabel}`
      : "출근하지 않음, 근무 상태 열기";

  const startSelectedWork = async (workType: AssignedWorkType) => {
    try {
      await clock.startWork(workType);
      feedback.success(`${workType.name} 근무를 시작했습니다.`);
      setOpen(false);
    } catch {
      // useStaffClock가 API 오류를 표시한다.
    }
  };

  const finishWork = async () => {
    try {
      await clock.endWork();
      feedback.success("퇴근 처리했습니다. 근무시간과 금액을 계산했습니다.");
      setOpen(false);
    } catch {
      // useStaffClock가 API 오류를 표시한다.
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-state={clock.isOnBreak ? "break" : clock.isWorking ? "working" : "off"}
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        title={triggerLabel}
      >
        <TimerReset aria-hidden />
        <span className={styles.dot} aria-hidden />
      </button>

      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        width={460}
        noMinimize
        closeDisabled={clock.isMutating}
      >
        <ModalHeader
          title="근무 상태"
          description="로그인 시간과 근무시간은 별개입니다. 출근을 선택한 시점부터 계산됩니다."
          noIcon
        />
        <ModalBody>
          {clock.staffMeQ.isLoading || (clock.staffId != null && clock.currentQ.isLoading) ? (
            <EmptyState scope="panel" tone="loading" title="근무 상태를 확인하고 있습니다" />
          ) : clock.staffMeQ.isError || clock.currentQ.isError ? (
            <EmptyState
              scope="panel"
              tone="error"
              title="근무 상태를 불러오지 못했습니다"
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
          ) : clock.isWorking ? (
            <div className={styles.statusPanel}>
              <div className={styles.statusTopline}>
                <span className={styles.statusPill} data-state={clock.isOnBreak ? "break" : "working"}>
                  {statusLabel}
                </span>
                <span className={styles.workType}>{currentType}</span>
              </div>
              <div className={styles.elapsed}>{clock.timeLabel}</div>
              <div className={styles.meta}>
                {clock.current?.status !== "OFF" && clock.current?.hourly_wage != null
                  ? `${clock.current.hourly_wage.toLocaleString()}원/시간 · 퇴근 시 최종 금액 계산`
                  : "퇴근 시 최종 근무시간과 금액을 계산합니다."}
              </div>
              <div className={styles.actions}>
                {clock.isOnBreak ? (
                  <Button
                    intent="primary"
                    size="md"
                    disabled={clock.isMutating}
                    leftIcon={<Play size={16} aria-hidden />}
                    onClick={() => void clock.endBreak()}
                  >
                    {clock.isBreakEnding ? "처리 중" : "근무 다시 시작"}
                  </Button>
                ) : (
                  <Button
                    intent="secondary"
                    size="md"
                    disabled={clock.isMutating}
                    leftIcon={<Coffee size={16} aria-hidden />}
                    onClick={() => void clock.startBreak()}
                  >
                    {clock.isBreakStarting ? "처리 중" : "휴식"}
                  </Button>
                )}
                <Button
                  intent="danger"
                  size="md"
                  disabled={clock.isMutating}
                  leftIcon={<LogOut size={16} aria-hidden />}
                  onClick={() => void finishWork()}
                >
                  {clock.isEnding ? "계산 중" : "퇴근"}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.offState}>
                <span>0:00</span>
                <strong>출근하지 않은 상태</strong>
                <small>로그인 중이지만 근무시간과 조교비는 올라가지 않습니다.</small>
              </div>
              <div className={styles.typeList} aria-label="출근 유형 선택">
                {clock.assignedWorkTypes.map((workType) => (
                  <button
                    key={workType.id}
                    type="button"
                    className={styles.typeButton}
                    disabled={clock.isMutating}
                    onClick={() => void startSelectedWork(workType)}
                    aria-label={`${workType.name} 근무 시작`}
                  >
                    <span>
                      <strong>{workType.name}</strong>
                      <small>{workType.hourly_wage.toLocaleString()}원/시간</small>
                    </span>
                    <span><LogIn size={15} aria-hidden /> 출근</span>
                  </button>
                ))}
                {clock.assignedWorkTypes.length === 0 && (
                  <div className={styles.noTypes}>
                    배정된 근무 유형이 없습니다. 관리자에게 근무 유형 배정을 요청해 주세요.
                  </div>
                )}
              </div>
            </div>
          )}
        </ModalBody>
      </AdminModal>
    </>
  );
}
