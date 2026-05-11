// PATH: src/landing/utils/tenantSignature.ts
// 학원 청사진 SSOT (#D1+D2, 2026-05-12 cycle 12).
//
// 학원장 spec: "2번 테넌트(박철과학)를 먼저 완성시키고 청사진으로 쓸거야."
//   슬로건/브랜드 색/템플릿 — 학원장이 inline editor에서 입력 안 해도, 도메인만으로
//   자동 박철 시그니처 적용. config가 비어있을 때만 fallback (학원장 입력 우선).
//
// 신규 학원이 들어오면 이 SSOT에 hostname → signature 한 줄 추가하는 패턴으로 청사진 확장.

export interface TenantSignature {
  tagline: string;
  subtitle: string;
  primaryColor: string;
  templateKey: "minimal_tutor" | "premium_dark" | "academic_trust" | "program_promo";
}

const SIGNATURES: Record<string, TenantSignature> = {
  "tchul.com": {
    tagline: "과학은 철두철미하게",
    subtitle: "결과는 철옹성처럼",
    primaryColor: "#D4A04C", // 골드
    templateKey: "premium_dark",
  },
  "www.tchul.com": {
    tagline: "과학은 철두철미하게",
    subtitle: "결과는 철옹성처럼",
    primaryColor: "#D4A04C",
    templateKey: "premium_dark",
  },
};

/** 현재 hostname에 매핑된 청사진 signature 반환. 없으면 null. */
export function getTenantSignature(): TenantSignature | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  return SIGNATURES[host] ?? null;
}
