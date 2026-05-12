// PATH: src/app_admin/domains/landing/types/index.ts

export type SectionType = "hero" | "hero_carousel" | "features" | "testimonials" | "about" | "programs" | "faq" | "contact" | "notice" | "hit_reports" | "instructor_profile" | "management_system" | "process_timeline";

/**
 * 섹션 메타 SSOT — type / 어드민 라벨 / 외부 한 줄 설명 / 아이콘 / default values.
 * 새 섹션 추가 시 여기 한 줄만 등록하면:
 *  - 어드민 사이드바 / 카드 그리드 / 모바일 tabs 자동 노출
 *  - 백엔드 default_draft_config + backfill 자동 적용 (별도 동기화 X — backend는 type list만 import 또는 동일 값 유지)
 *  - validator SECTION_TYPES set 동기화 필요 (backend 제약)
 */
export const SECTION_META: Record<SectionType, { label: string; icon: string; tagline: string; defaultEnabled?: boolean }> = {
  hero: { label: "히어로 (메인 배너)", icon: "star", tagline: "메인 배너 + 슬로건", defaultEnabled: true },
  hero_carousel: { label: "히어로 캐러셀 (매치업 + 강조 카드)", icon: "target", tagline: "자동 회전 카드 — 매치업 + custom" },
  features: { label: "특징 소개", icon: "check", tagline: "차별화 포인트 카드", defaultEnabled: true },
  instructor_profile: { label: "강사 프로필", icon: "users", tagline: "강사 사진 + 경력" },
  about: { label: "소개", icon: "book", tagline: "한 단락 소개글" },
  management_system: { label: "학생 관리 시스템", icon: "shield", tagline: "학생 관리 카드" },
  process_timeline: { label: "수업 진행 흐름", icon: "clock", tagline: "주차별 수업 흐름" },
  testimonials: { label: "수강생 후기", icon: "heart", tagline: "수강생 후기" },
  hit_reports: { label: "최근 적중 사례 (매치업)", icon: "target", tagline: "매치업 적중 카드" },
  programs: { label: "프로그램 안내", icon: "award", tagline: "강좌 안내" },
  faq: { label: "자주 묻는 질문", icon: "check", tagline: "자주 묻는 질문" },
  contact: { label: "문의 정보", icon: "users", tagline: "전화 / 주소", defaultEnabled: true },
  notice: { label: "공지/안내", icon: "shield", tagline: "공지 띠" },
};

/** 섹션 타입 전체 list — 어드민 sidebar / mobile tabs / backfill 등에서 사용 */
export const ALL_SECTION_TYPES: SectionType[] = Object.keys(SECTION_META) as SectionType[];

export interface InstructorProfileItem {
  name: string;
  title: string;          // "통합과학 강사" 같은 직함
  photo_url?: string;
  experience: string[];   // ["현 대치명인학원", "현 대치두각학원", ...]
  bio?: string;
}

export interface ManagementCardItem {
  icon: string;           // SVG icon name (shared.tsx ICON_MAP)
  title: string;
  description: string;
}

export interface ProcessStepItem {
  step_label: string;     // "1주차" / "Week 1"
  title: string;
  description: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface TestimonialItem {
  name: string;
  text: string;
  role: string;
}

export interface ProgramItem {
  title: string;
  description: string;
  badge?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface HitReportShowcaseItem {
  report_id: number;
  display_label?: string;
}

/** /api/v1/matchup/landing/public/?ids=... 응답 카드 메타 */
export interface HitReportPublicCard {
  id: number;
  doc_title: string;
  doc_category: string;
  hit_count: number;
  total_problems: number;
  hit_rate_pct: number;
  submitted_at: string | null;
  created_at: string | null;
}

/** hero primary CTA 변형(2026-05-11) — 학원장이 LandingEditor에서 선택. admin UI는 별도 cycle.
 *  - consult(default): 기존 config.cta_text/cta_link (수강 문의)
 *  - matchup: 매치업 적중보고서 (`/landing/reports`)
 *  - video: 학원장이 입력한 강의 영상 link
 *  - custom: label/link 자유 입력
 */
export type HeroPrimaryCtaVariant = "consult" | "matchup" | "video" | "custom";
export interface HeroPrimaryCta {
  variant?: HeroPrimaryCtaVariant;
  label?: string;
  link?: string;
}

/** hero_carousel 슬라이드 아이템(#63 Phase B, 2026-05-12).
 *  학원장이 LandingEditor에서 자유 mix:
 *  - hit_report: 매치업 적중 보고서 (report_id) — 자동 적중률 표시
 *  - custom: title/subtitle/cta_label/cta_link/image_url 자유 입력
 *  - post(P3): 일반 게시글 (post_id) — 미구현, 별도 cycle
 */
export type HeroCarouselItemKind = "hit_report" | "custom" | "post";
export interface HeroCarouselItem {
  kind: HeroCarouselItemKind;
  /** kind=hit_report 시 */
  report_id?: number;
  /** kind=post 시 */
  post_id?: number;
  /** kind=custom 시 모든 자유 필드 */
  category?: string;        // "공지" "이벤트" "강좌 안내" 등
  title?: string;
  subtitle?: string;
  cta_label?: string;
  cta_link?: string;
  image_url?: string;
}

export interface LandingSection {
  type: SectionType;
  enabled: boolean;
  order: number;
  title?: string;
  description?: string;
  items?: FeatureItem[] | TestimonialItem[] | ProgramItem[] | FaqItem[] | HitReportShowcaseItem[] | InstructorProfileItem[] | ManagementCardItem[] | ProcessStepItem[] | HeroCarouselItem[];
  /** hero section 전용 — primary CTA 변형. */
  hero_primary_cta?: HeroPrimaryCta;
}

export interface LandingContact {
  phone: string;
  email: string;
  address: string;
}

/** 공지 popup(2026-05-11) — 학원장이 LandingEditor에서 enable. localStorage 24h skip. */
export interface NoticePopupConfig {
  enabled?: boolean;
  title?: string;
  content?: string;
  link?: string;       // 클릭 시 이동(외부 URL 또는 내부 라우트)
  expire_at?: string;  // ISO datetime — 이후 자동 비노출
}

export interface LandingConfig {
  brand_name: string;
  tagline: string;
  subtitle: string;
  primary_color: string;
  hero_image_url: string;
  /** 다중 히어로 이미지 슬라이드(2026-05-12). 1장이면 정적, 2장↑면 5초 페이드 캐러셀.
   *  비어있고 hero_image_url만 있으면 단일 이미지로 fallback. */
  hero_images?: string[];
  logo_url: string;
  cta_text: string;
  cta_link: string;
  contact: LandingContact;
  sections: LandingSection[];
  template_key?: string;
  /** 공지 popup — 학원장 LandingEditor 설정. */
  notice_popup?: NoticePopupConfig;
  /** hero primary CTA (config-level, LandingEditor CtaEditor에서 편집).
   *  fallback 순서: hero section.hero_primary_cta → config.hero_primary_cta → config.cta_text/link */
  hero_primary_cta?: HeroPrimaryCta;
}

export type TemplateKey = "minimal_tutor" | "premium_dark" | "academic_trust" | "program_promo";

export interface TemplateMeta {
  key: TemplateKey;
  name: string;
  description: string;
  mood: string;
  preview_color: string;
}

export interface LandingPublicResponse {
  has_landing: boolean;
  template_key?: TemplateKey;
  config?: LandingConfig;
}

export interface LandingAdminResponse {
  template_key: TemplateKey;
  is_published: boolean;
  draft_config: LandingConfig;
  published_config: LandingConfig | null;
  updated_at: string | null;
}

export const ALLOWED_COLORS = [
  { value: "#2563EB", label: "블루" },
  { value: "#4F46E5", label: "인디고" },
  { value: "#7C3AED", label: "퍼플" },
  { value: "#EC4899", label: "핑크" },
  { value: "#EF4444", label: "레드" },
  { value: "#F97316", label: "오렌지" },
  { value: "#F59E0B", label: "앰버" },
  { value: "#10B981", label: "에메랄드" },
  { value: "#14B8A6", label: "틸" },
  { value: "#06B6D4", label: "시안" },
  { value: "#1E3A5F", label: "네이비" },
  { value: "#475569", label: "슬레이트" },
  { value: "#18181B", label: "블랙" },
  { value: "#0EA5E9", label: "스카이" },
  { value: "#8B5CF6", label: "바이올렛" },
  { value: "#D946EF", label: "퓨셔" },
] as const;
