// PATH: src/app_teacher/domains/fees/feesError.ts
// 수납 화면 전용 API 에러 표준화. 권한 실패와 일반 장애를 UI에서 명확히 분리한다.

export const FEES_PERMISSION_ERROR_TITLE = "수납 관리 권한이 필요합니다";
export const FEES_PERMISSION_ERROR_DESCRIPTION =
  "원장 또는 관리자 권한이 있는 계정으로 다시 확인해 주세요.";

type ApiErrorLike = {
  status?: number;
  response?: {
    status?: number;
    data?: {
      detail?: unknown;
    };
  };
  message?: unknown;
};

export function getFeesErrorStatus(error: unknown): number | null {
  const err = error as ApiErrorLike | undefined;
  const status = err?.response?.status ?? err?.status;
  return typeof status === "number" ? status : null;
}

export function isFeesPermissionError(error: unknown): boolean {
  return getFeesErrorStatus(error) === 403;
}

export function getFeesApiErrorMessage(error: unknown, fallback: string): string {
  if (isFeesPermissionError(error)) return FEES_PERMISSION_ERROR_TITLE;

  const err = error as ApiErrorLike | undefined;
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}
