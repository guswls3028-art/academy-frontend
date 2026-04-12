// PATH: src/dev_app/hooks/useInbox.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInboxPosts, createInboxReply, deleteInboxReply } from "@dev/domains/inbox/api/inbox.api";

const KEY = ["dev-platform-inbox"];

export function useInboxPosts(type?: "bug" | "feedback" | "all") {
  return useQuery({
    queryKey: [...KEY, type ?? "all"],
    queryFn: () => getInboxPosts(type),
    staleTime: 30_000,
  });
}

export function useCreateInboxReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, content }: { postId: number; content: string }) =>
      createInboxReply(postId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteInboxReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, replyId }: { postId: number; replyId: number }) =>
      deleteInboxReply(postId, replyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
