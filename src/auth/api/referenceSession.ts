import { resetSessionEnding } from "@/shared/api/axios";
import { publishLoginTokenEnvelope } from "@/shared/auth/tokenSession";

export async function openReferenceSession() {
  if (location.origin !== "https://original-demo.hakwonplus.com") {
    throw new Error("학원플러스 원본 비교 화면에서 다시 열어 주세요.");
  }
  const response = await fetch("/api/v1/reference/session/", {
    method: "POST",
    mode: "same-origin",
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("예시 학원을 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
  const session = await response.json();
  if (typeof session.access !== "string" || !session.access || typeof session.refresh !== "string" || !session.refresh) {
    throw new Error("체험 세션을 확인할 수 없습니다. 다시 시도해 주세요.");
  }
  await publishLoginTokenEnvelope(session.access, session.refresh);
  resetSessionEnding();
}
