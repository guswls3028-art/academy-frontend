// PATH: src/app_admin/domains/landing/types/index.ts

export type SectionType = "hero" | "features" | "testimonials" | "about" | "programs" | "faq" | "contact" | "notice";

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

export interface LandingSection {
  type: SectionType;
  enabled: boolean;
  order: number;
  title?: string;
  description?: string;
  items?: FeatureItem[] | TestimonialItem[] | ProgramItem[] | FaqItem[];
}

export interface LandingContact {
  phone: string;
  email: string;
  address: string;
}

export interface LandingConfig {
  brand_name: string;
  tagline: string;
  subtitle: string;
  primary_color: string;
  hero_image_url: string;
  logo_url: string;
  cta_text: string;
  cta_link: string;
  contact: LandingContact;
  sections: LandingSection[];
  template_key?: string;
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
