import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { devQueryKeys } from "@dev/shared/queryKeys";
import {
  createInboxReply,
  getInboxItems,
  updateInboxItem,
  type InboxFilters,
  type InboxItem,
  type InboxStatus,
} from "@dev/domains/inbox/api/inbox.api";

export function useInboxItems(filters: InboxFilters) {
  return useQuery({
    queryKey: devQueryKeys.inboxItems(filters),
    queryFn: () => getInboxItems(filters),
    staleTime: 30_000,
  });
}

export function useCreateInboxReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      content,
      idempotencyKey,
    }: {
      postId: number;
      content: string;
      idempotencyKey: string;
    }) => createInboxReply(postId, content, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: devQueryKeys.inbox }),
  });
}

export function useUpdateInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      item,
      status,
      adminMemo,
    }: {
      item: Pick<InboxItem, "source" | "id">;
      status: InboxStatus;
      adminMemo: string;
    }) => updateInboxItem(item, { status, admin_memo: adminMemo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: devQueryKeys.inbox }),
  });
}
