// 결시로 저장된 학생에게 OMR 답안지를 연결할 때의 명시적 재개 확인.
// 서버 정책: backend/docs/domain/omr.md (학생 식별만으로 결시를 해제하지 않는다)
import type { useConfirm } from "@/shared/ui/confirm";

type Confirm = ReturnType<typeof useConfirm>;

export function confirmAbsenceResume(
  confirm: Confirm,
  studentName?: string | null,
): Promise<boolean> {
  return confirm({
    title: "결시로 저장된 학생입니다",
    message:
      `${studentName ? `${studentName} 학생은` : "이 학생은"} 이 시험에서 결시로 저장돼 있습니다. ` +
      "답안지가 학생 본인 것이 맞으면 결시를 해제하고 객관식 점수를 반영합니다. " +
      "서술형 점수는 채점표에서 이어서 입력할 수 있습니다.",
    confirmText: "결시 해제 후 채점",
    cancelText: "결시 유지",
  });
}

/** 409 OMR_ATTEMPT_CONFLICT 중 교사 확인으로 재개 가능한 경우 */
export function isResumableAbsenceConflict(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { code?: string; can_resume_absence?: boolean } } })
    ?.response;
  return response?.status === 409
    && response.data?.code === "OMR_ATTEMPT_CONFLICT"
    && response.data.can_resume_absence === true;
}
