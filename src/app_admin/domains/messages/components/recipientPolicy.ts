import type { TemplateCategory } from "../constants/templateBlocks";

export type ManualRecipientSelection = {
  parent: boolean;
  student: boolean;
  studentLocked: boolean;
};

export function getManualRecipientSelection(
  blockCategory: TemplateCategory,
): ManualRecipientSelection {
  if (blockCategory === "grades") {
    return { parent: true, student: false, studentLocked: true };
  }
  return { parent: true, student: true, studentLocked: false };
}
