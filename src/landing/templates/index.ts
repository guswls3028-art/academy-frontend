// PATH: src/app_admin/domains/landing/templates/index.ts

import type { ComponentType } from "react";
import type { TemplateProps } from "./shared";
import type { TemplateKey } from "../types";

import MinimalTutor from "./MinimalTutor";
import PremiumDark from "./PremiumDark";
import AcademicTrust from "./AcademicTrust";
import ProgramPromo from "./ProgramPromo";

export const TEMPLATE_MAP: Record<TemplateKey, ComponentType<TemplateProps>> = {
  minimal_tutor: MinimalTutor,
  premium_dark: PremiumDark,
  academic_trust: AcademicTrust,
  program_promo: ProgramPromo,
};

export function getTemplateComponent(key: TemplateKey): ComponentType<TemplateProps> {
  return TEMPLATE_MAP[key] || MinimalTutor;
}

export type { TemplateProps } from "./shared";
