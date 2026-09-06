import type { MessageTemplateCategory } from "../api/messages.api";
import type { TemplateCategory } from "../constants/templateBlocks";

export function toPersistedTemplateCategory(category: TemplateCategory): MessageTemplateCategory {
  if (category === "student" || category === "default") return "default";
  return category as MessageTemplateCategory;
}
