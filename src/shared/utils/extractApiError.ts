/**
 * DRF 에러 응답에서 사용자 친화적 메시지를 추출한다.
 *
 * DRF는 여러 형태로 에러를 반환한다:
 * - { "detail": "..." }                      → ValidationError({"detail": ...})
 * - { "username": ["중복입니다"] }             → field-level error
 * - { "non_field_errors": ["..."] }           → non-field error
 * - { "message": "..." }                     → custom
 *
 * 이 함수는 위 모든 형태를 하나의 문자열로 변환한다.
 */

const FIELD_LABELS: Record<string, string> = {
  username: "로그인 아이디",
  password: "비밀번호",
  name: "이름",
  phone: "전화번호",
  role: "역할",
  pay_type: "급여유형",
  is_active: "활성상태",
  detail: "",
  non_field_errors: "",
};

export function extractApiError(
  e: unknown,
  fallback = "요청 처리 중 오류가 발생했습니다.",
): string {
  const data = (e as { response?: { data?: Record<string, unknown> } })
    ?.response?.data;

  if (!data || typeof data !== "object") {
    if (e instanceof Error) return e.message;
    return fallback;
  }

  // 1) detail 문자열
  if (typeof data.detail === "string" && data.detail) return data.detail;

  // 2) message 문자열
  if (typeof data.message === "string" && data.message) return data.message;

  // 3) field-level errors → "필드명: 메시지" 형태로 합침
  const parts: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    const label = FIELD_LABELS[key] ?? key;
    const msgs = Array.isArray(val) ? val : typeof val === "string" ? [val] : [];
    for (const msg of msgs) {
      if (typeof msg === "string" && msg) {
        parts.push(label ? `${label}: ${msg}` : msg);
      }
    }
  }

  if (parts.length > 0) return parts.join("\n");

  return fallback;
}
