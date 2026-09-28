// All role apps edit the same tenant-owned rows; invalidate one shared family.
export const messageTemplatesQueryKey = ["messaging", "templates"] as const;
export const teacherMessageTemplatesQueryKey = messageTemplatesQueryKey;
export const suppressedTemplateDefaultsQueryKey = ["messaging", "suppressed-defaults"] as const;
