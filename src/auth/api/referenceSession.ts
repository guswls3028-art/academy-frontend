import api, { resetSessionEnding, type ApiRequestConfig } from "@/shared/api/axios";
import { publishLoginTokenEnvelope } from "@/shared/auth/tokenSession";
import type { LoginResponse } from "./auth.api";

export async function openReferenceSession() {
  if (location.origin !== "https://original-demo.hakwonplus.com") {
    throw new Error("학원플러스 원본 비교 화면에서 다시 열어 주세요.");
  }
  const config: ApiRequestConfig = { skipAuth: true, withCredentials: false };
  const response = await api.post<LoginResponse>("/reference/session/", undefined, config)
    .catch(() => { throw new Error("예시 학원을 열지 못했습니다. 잠시 후 다시 시도해 주세요."); });
  const { access, refresh } = response.data;
  if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) {
    throw new Error("체험 세션을 확인할 수 없습니다. 다시 시도해 주세요.");
  }
  await publishLoginTokenEnvelope(access, refresh);
  resetSessionEnding();
}
