import type { ConfirmOptions } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { openStudentSupportPreview } from "@/shared/studentSupport/studentSupport.api";

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

export function plannedStudentLoginId(psNumber: unknown, studentPhone: unknown): string | null {
  return String(psNumber || "").trim() || String(studentPhone || "").trim() || null;
}

function inspectStudent(studentId: number): void {
  void openStudentSupportPreview(studentId).catch((error) => {
    feedback.error(error instanceof Error ? error.message : "학생 화면을 열지 못했습니다.");
  });
}

export async function presentStudentLoginReadback({
  confirm,
  studentId,
  expectedLoginId,
  loginId,
  parentPhone,
}: {
  confirm: Confirm;
  studentId: number;
  expectedLoginId: string | null;
  loginId: string;
  parentPhone: string;
}): Promise<string | null> {
  if (expectedLoginId && loginId !== expectedLoginId) {
    const message = "학생은 등록됐지만 예상 로그인 ID와 서버 저장 ID가 다릅니다. 그대로 안내하지 말고 학생 화면을 확인해 주세요.";
    const inspectNow = await confirm({
      title: "로그인 ID 불일치 — 확인 필요",
      message,
      review: {
        eyebrow: "계정 생성 결과 검수",
        items: [
          { label: "예상 로그인 ID", value: expectedLoginId, tone: "warning" },
          { label: "실제 저장 ID", value: loginId || "확인되지 않음", tone: "warning" },
        ],
        note: "이 경고는 등록 자체가 실패했다는 뜻이 아닙니다. 실제 학생 화면과 계정 연결을 확인한 뒤 아이디를 안내하세요.",
      },
      confirmText: "학생 화면 바로 검수",
      cancelText: "학생 목록에서 확인",
    });
    if (inspectNow) inspectStudent(studentId);
    return message;
  }

  feedback.successWithAction({
    message: "학생 계정 등록·ID 확인 완료",
    description:
      `로그인 ID: ${loginId || "자동 부여됨"}`
      + (parentPhone ? ` · 학부모 ID: ${parentPhone}` : "")
      + " · 학생 화면을 열어 계정 연결까지 바로 검수할 수 있습니다.",
    action: {
      label: "학생 화면 바로 검수",
      onClick: () => inspectStudent(studentId),
    },
    duration: 12,
  });
  return null;
}
