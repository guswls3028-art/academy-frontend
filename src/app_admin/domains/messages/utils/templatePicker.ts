import type { MessageTemplateItem } from "../api/messages.api";
import type { TemplateCategory } from "../constants/templateBlocks";
import { isFixedAlimtalkContent } from "@/shared/messaging/alimtalkEnvelope";

export function isSystemMessageTemplate(
  template: Pick<MessageTemplateItem, "is_system" | "name">,
): boolean {
  return template.is_system;
}

export function isTemplateVisibleInPicker(
  template: Pick<MessageTemplateItem, "category" | "is_system" | "name">,
  blockCategory: TemplateCategory,
  showAllCategories: boolean,
): boolean {
  if (isFixedAlimtalkContent(template.category, template.name)) return false;
  if (showAllCategories) return true;
  if (!isSystemMessageTemplate(template)) return true;
  if (blockCategory === "default" || blockCategory === "student") {
    return template.category === "default" || isSystemMessageTemplate(template);
  }
  return template.category === blockCategory;
}

export function savedTemplatePickerPriority(
  template: Pick<MessageTemplateItem, "category" | "is_user_default">,
  blockCategory: TemplateCategory,
): number {
  const categoryPriority = template.category === blockCategory
    ? 0
    : template.category === "default"
      ? 10
      : 20;
  return categoryPriority + (template.is_user_default ? 0 : 1);
}
