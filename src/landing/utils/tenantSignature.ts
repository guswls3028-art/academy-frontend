// PATH: src/landing/utils/tenantSignature.ts
// 학원 청사진 SSOT (#D1+D2, 2026-05-12 cycle 12-13).
//
// 학원장 spec: "2번 테넌트(박철과학)를 먼저 완성시키고 청사진으로 쓸거야. 떠넘기기 금지."
//   → signature는 OVERRIDE 모드. 학원장이 직전에 입력한 값이 있어도 박철 시그니처로 강제 교체.
//   학원장이 본인 spec으로 청사진 박았으므로 override OK (학원장 == 박철 본인).
//
//   학원장이 향후 청사진을 바꾸고 싶으면 SIGNATURES dict에서 해당 hostname 항목 갱신.
//   학원장 자율성을 다시 우선하고 싶으면 mode를 "fallback"으로 바꿔 사용.
//
// 신규 학원이 들어오면 이 SSOT에 hostname → signature 한 줄 추가하는 패턴으로 청사진 확장.

export type SignatureMode = "override" | "fallback";

export interface TenantSignature {
  tagline: string;
  subtitle: string;
  primaryColor: string;
  templateKey: "minimal_tutor" | "premium_dark" | "academic_trust" | "program_promo";
  /** override: 학원장 입력 무시 + signature 강제. fallback: config 비어있을 때만. */
  mode: SignatureMode;
}

const SIGNATURES: Record<string, TenantSignature> = {
  "tchul.com": {
    tagline: "과학은 철두철미하게",
    subtitle: "결과는 철옹성처럼",
    primaryColor: "#D4A04C", // 골드
    templateKey: "premium_dark",
    mode: "override",
  },
  "www.tchul.com": {
    tagline: "과학은 철두철미하게",
    subtitle: "결과는 철옹성처럼",
    primaryColor: "#D4A04C",
    templateKey: "premium_dark",
    mode: "override",
  },
};

/** 현재 hostname에 매핑된 청사진 signature 반환. 없으면 null. */
export function getTenantSignature(): TenantSignature | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  return SIGNATURES[host] ?? null;
}
