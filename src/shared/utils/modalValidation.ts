/**
 * 모달 필수 필드 검증 SSOT
 * 사용처: StudentCreateModal, EditStudentModal, LectureCreateModal 등
 * - validateRequiredFields: 필드 배열 검사 후 첫 번째 오류 메시지 반환 (없으면 null)
 * - 검증 실패 시 반드시 feedback.error(메시지)로 알림 (alert 대신). 사용자 인지에 친절한 단일 방식.
 */

export type RequiredField = {
  value: string;
  label: string;
  /** 비어 있으면 오류 메시지에 label만 사용 */
  message?: string;
};

/**
 * 필수 필드들이 비어 있지 않은지 검사.
 * @returns 첫 번째 비어 있는 필드의 메시지, 모두 채워지면 null
 */
export function validateRequiredFields(fields: RequiredField[]): string | null {
  for (const f of fields) {
    const v = String(f.value ?? "").trim();
    if (!v) {
      return f.message ?? `${f.label}을(를) 입력해 주세요.`;
    }
  }
  return null;
}
