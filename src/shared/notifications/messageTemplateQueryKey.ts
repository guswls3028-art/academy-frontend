// All role apps edit the same tenant-owned rows; invalidate one shared family.
export const messageTemplatesQueryKey = ["messaging", "templates"] as const;
export const teacherMessageTemplatesQueryKey = messageTemplatesQueryKey;
export const messageAutoSendQueryKey = ["messaging", "auto-send"] as const;
export const teacherMessageAutoSendQueryKey = [...messageAutoSendQueryKey, "teacher"] as const;
export const suppressedTemplateDefaultsQueryKey = ["messaging", "suppressed-defaults"] as const;
