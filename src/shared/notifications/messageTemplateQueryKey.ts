// All role apps edit the same tenant-owned rows; invalidate one shared family.
export const messageTemplatesQueryKey = ["messaging", "templates"] as const;
export const teacherMessageTemplatesQueryKey = messageTemplatesQueryKey;
export const messageAutoSendQueryKey = ["messaging", "auto-send"] as const;
export const teacherMessageAutoSendQueryKey = [...messageAutoSendQueryKey, "teacher"] as const;
export const suppressedTemplateDefaultsQueryKey = ["messaging", "suppressed-defaults"] as const;
// Separate editing sessions from list invalidation so saving/refocusing cannot reset a draft.
export const messageTemplateEditorQueryKey = (view: "admin" | "teacher", id?: number) =>
  ["message-template-editor", view, id] as const;
