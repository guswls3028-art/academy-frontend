// PATH: src/dev_app/hooks/useInbox.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { devQueryKeys } from "@dev/shared/queryKeys";
import { getInboxPosts, createInboxReply, deleteInboxReply } from "@dev/domains/inbox/api/inbox.api";

export function useInboxPosts(type?: "bug" | "feedback" | "all") {
  return useQuery({
    queryKey: devQueryKeys.inboxPosts(type),
    queryFn: () => getInboxPosts(type),
    staleTime: 30_000,
  });
}

export function useCreateInboxReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, content }: { postId: number; content: string }) =>
      createInboxReply(postId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: devQueryKeys.inbox }),
  });
}

export function useDeleteInboxReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, replyId }: { postId: number; replyId: number }) =>
      deleteInboxReply(postId, replyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: devQueryKeys.inbox }),
  });
}
