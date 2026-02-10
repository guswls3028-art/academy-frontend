// PATH: src/features/settings/constants/themes.ts

export type ThemeKey =
  | "modern-white"
  | "navy-pro"
  | "ivory-office"
  | "minimal-mono"
  | "modern-dark"
  | "dark-navy"
  | "youtube-studio"
  | "terminal-neon"
  | "kakao-business"
  | "naver-works"
  | "samsung-admin"
  | "purple-insight";

export type ThemeGroup = "WHITE" | "DARK" | "BRAND";

export type ThemeMeta = {
  key: ThemeKey;
  name: string;
  desc: string;
  group: ThemeGroup;
  order: number; // 1..12 (grid order SSOT)
};

export const THEMES: ThemeMeta[] = [
  // ================= WHITE 4 =================
  {
    key: "modern-white",
    name: "Modern White",
    desc: "기본 · 깨끗한 관리자 콘솔",
    group: "WHITE",
    order: 1,
  },
  {
    key: "navy-pro",
    name: "Navy Pro",
    desc: "프로덕션형 · 블루/네이비 기반",
    group: "WHITE",
    order: 2,
  },
  {
    key: "ivory-office",
    name: "Ivory Office",
    desc: "따뜻한 아이보리 · 오피스 톤",
    group: "WHITE",
    order: 3,
  },
  {
    key: "minimal-mono",
    name: "Minimal Mono",
    desc: "최소 표현 · 모노톤",
    group: "WHITE",
    order: 4,
  },

  // ================= DARK 4 =================
  {
    key: "modern-dark",
    name: "Modern Dark",
    desc: "저눈부심 · 프리미엄 다크",
    group: "DARK",
    order: 5,
  },
  {
    key: "dark-navy",
    name: "Dark Navy",
    desc: "야간/장시간 · 네이비 다크",
    group: "DARK",
    order: 6,
  },
  {
    key: "youtube-studio",
    name: "YouTube Studio",
    desc: "다크 + 강한 레드 포인트",
    group: "DARK",
    order: 7,
  },
  {
    key: "terminal-neon",
    name: "Terminal Neon",
    desc: "개발자 톤 · 네온 다크",
    group: "DARK",
    order: 8,
  },

  // ================= BRAND 4 =================
  {
    key: "kakao-business",
    name: "Kakao Business",
    desc: "브랜드 강조 · 카카오 톤",
    group: "BRAND",
    order: 9,
  },
  {
    key: "naver-works",
    name: "Naver Works",
    desc: "업무형 · 네이버웍스 톤",
    group: "BRAND",
    order: 10,
  },
  {
    key: "samsung-admin",
    name: "Samsung Admin",
    desc: "기업형 · 삼성 블루",
    group: "BRAND",
    order: 11,
  },
  {
    key: "purple-insight",
    name: "Purple Insight",
    desc: "분석/통계 · 퍼플 프리미엄",
    group: "BRAND",
    order: 12,
  },
].sort((a, b) => a.order - b.order);

export function getThemeMeta(key: ThemeKey): ThemeMeta {
  const found = THEMES.find((t) => t.key === key);
  return found ?? THEMES[0];
}

export function isThemeKey(v: unknown): v is ThemeKey {
  if (typeof v !== "string") return false;
  return THEMES.some((t) => t.key === v);
}
