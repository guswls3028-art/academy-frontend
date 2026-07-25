// PATH: src/app_promo/domains/landing/api/promoLead.ts
import api, { type ApiRequestConfig } from "@/shared/api/axios";

type PromoLeadPayload = {
  name: string;
  phone: string;
  interest: string;
  message: string;
  source: "promo-demo" | "promo-contact";
  website?: string;
};

type PromoLeadResult = {
  id: number;
  ok: boolean;
};

const MESSAGE_MAX = 2000;
const INTEREST_MAX = 80;

function truncate(value: string, max: number) {
  return value.trim().slice(0, max);
}

function linesToMessage(lines: Array<[string, string | undefined]>) {
  return truncate(
    lines
      .map(([label, value]) => [label, (value || "").trim()] as const)
      .filter(([, value]) => value.length > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n"),
    MESSAGE_MAX,
  );
}

function postPromoLead(payload: PromoLeadPayload) {
  return api.post<PromoLeadResult>(
    "/core/landing/consult/",
    {
      ...payload,
      interest: truncate(payload.interest, INTEREST_MAX),
      message: truncate(payload.message, MESSAGE_MAX),
    },
    { skipAuth: true } as ApiRequestConfig,
  );
}

export function submitPromoDemoLead(input: {
  name: string;
  academyName: string;
  phone: string;
  email: string;
  studentCount: string;
  currentWorkflow: string;
  interests: string[];
  message: string;
  privacyAgreed: boolean;
  attribution?: string;
  website?: string;
}) {
  if (!input.privacyAgreed) {
    throw new Error("개인정보 수집·이용 동의가 필요합니다.");
  }
  const interest = input.interests.length > 0 ? input.interests.join(", ") : "데모 요청";
  const message = linesToMessage([
    ["개인정보 수집·이용", "동의"],
    ["유입 정보", input.attribution],
    ["소속/수업명", input.academyName],
    ["이메일", input.email],
    ["담당 수강생 수", input.studentCount],
    ["현재 수업 관리 방식", input.currentWorkflow],
    ["관심 기능", interest],
    ["요청 사항", input.message],
  ]);

  return postPromoLead({
    name: input.name,
    phone: input.phone,
    interest,
    message,
    source: "promo-demo",
    website: input.website,
  });
}

export function submitPromoContactLead(input: {
  name: string;
  phone: string;
  email: string;
  academyName: string;
  studentCount: string;
  inquiryType: string;
  message: string;
  privacyAgreed: boolean;
  attribution?: string;
  website?: string;
}) {
  if (!input.privacyAgreed) {
    throw new Error("개인정보 수집·이용 동의가 필요합니다.");
  }
  const message = linesToMessage([
    ["개인정보 수집·이용", "동의"],
    ["유입 정보", input.attribution],
    ["문의 유형", input.inquiryType],
    ["소속/수업명", input.academyName],
    ["이메일", input.email],
    ["담당 수강생 수", input.studentCount],
    ["문의 내용", input.message],
  ]);

  return postPromoLead({
    name: input.name,
    phone: input.phone,
    interest: input.inquiryType,
    message,
    source: "promo-contact",
    website: input.website,
  });
}

export function getPromoLeadErrorMessage(error: unknown) {
  const detail = (
    error as {
      response?: { data?: { detail?: string | string[] } };
    }
  )?.response?.data?.detail;

  if (Array.isArray(detail)) return detail[0] || "전송 실패. 잠시 후 다시 시도해주세요.";
  if (typeof detail === "string") return detail;
  if (error instanceof Error && error.message) return error.message;
  return "전송 실패. 잠시 후 다시 시도해주세요.";
}
