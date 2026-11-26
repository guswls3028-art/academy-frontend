import type { components } from "@/shared/api/generated/schema";
import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

type Schemas = components["schemas"];
export type NoticeRegistration = Schemas["RegisterWithNoticesRequest"];
export type NoticeChoices = Pick<NoticeRegistration, "student_notice" | "parent_notice">;
export type NoticeMode = NoticeChoices["student_notice"];
export type RecipientNotice = Schemas["EnrollmentNoticeDelivery"];
export type RegistrationReceipt = Schemas["EnrollmentNoticeResult"];
export type RegistrationDelivery = Schemas["EnrollmentNoticeProvider"];

export function registrationSession() {
  const session = readAuthTokenEnvelopeSafely();
  const tenant = getTenantCodeForApiRequest();
  if (!session || !tenant) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 시도해 주세요.");
  return createAuthSessionBoundConfig(session.generation, undefined, tenant);
}

export async function registerWithNotices(body: NoticeRegistration, config: ReturnType<typeof registrationSession>) {
  const { data } = await api.post<RegistrationReceipt>("/enrollments/register-with-notices/", body, config);
  return data;
}

export async function fetchRegistrationReceipt(lecture: number, requestId?: string, config = registrationSession()) {
  const response = await api.get<RegistrationReceipt | null>("/enrollments/registration-notices/", {
    ...config, params: { lecture, request_id: requestId },
  });
  if (response.status === 204 || response.data == null) return null;
  if (response.data.lecture !== lecture || !response.data.request_id || !Array.isArray(response.data.students)) {
    throw new Error("수강 등록 안내 결과를 확인하지 못했습니다.");
  }
  return response.data;
}

export async function verifyRegistrationNotice(lecture: number, requestId: string, logId: number) {
  const body: Schemas["EnrollmentNoticeVerifyRequest"] = { lecture, request_id: requestId, log_id: logId };
  const { data } = await api.post<RegistrationDelivery>("/enrollments/verify-registration-notice/", body, registrationSession());
  return data;
}
