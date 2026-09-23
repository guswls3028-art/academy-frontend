// PATH: src/app_teacher/domains/comms/queryKeys.ts
import { teacherMessageTemplatesQueryKey } from "@/shared/notifications/messageTemplateQueryKey";

export const teacherCommsQueryKeys = {
  posts: ["teacher-comms"] as const,
  postsList: (tab: string, searchQuery: string) => ["teacher-comms", tab, searchQuery] as const,
  registrationRequests: ["teacher-registration-requests"] as const,
  postReplies: (postId: number) => ["post-replies", postId] as const,
  notificationCounts: ["admin", "notification-counts"] as const,
  scopeNodes: ["community-scope-nodes"] as const,
  messageLog: ["teacher-message-log"] as const,
  templates: teacherMessageTemplatesQueryKey,
  messagingInfo: ["teacher-messaging-info"] as const,
  autoSendConfigs: ["teacher-auto-send-configs"] as const,
};
