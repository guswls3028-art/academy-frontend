import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { boardDate, boardKeys, deleteReply, editReply, type BoardScope, type Post, type Reply } from "./api";
import styles from "./StaffBoard.module.css";

export default function BoardReply({ item, postId, scope }: { item: Reply; postId: number; scope: BoardScope }) {
  const [draft, setDraft] = useState<string | null>(null);
  const confirm = useConfirm();
  const cache = useQueryClient();
  const change = useMutation({
    mutationFn: (body: string | null) => body === null
      ? deleteReply(postId, item.id).then(() => null)
      : editReply(postId, item.id, body),
    onSuccess: updated => {
      cache.setQueryData<Post>(boardKeys.detail(scope, postId), current => {
        if (!current) return current;
        const replies = updated ? current.replies.map(reply => reply.id === updated.id ? updated : reply)
          : current.replies.filter(reply => reply.id !== item.id);
        return { ...current, replies, reply_count: replies.length };
      });
      setDraft(null);
      void cache.invalidateQueries({ queryKey: scope });
      feedback.success(updated ? "댓글을 수정했습니다." : "댓글을 삭제했습니다.");
    },
  });

  async function remove() {
    if (await confirm({ title: "댓글 삭제", message: "이 댓글을 삭제할까요?", confirmText: "댓글 삭제", danger: true })) {
      change.mutate(null);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (draft?.trim() && !change.isPending) change.mutate(draft.trim());
  }
  return <li>
    <div className={styles.byline}>
      <div className={styles.meta}><strong>{item.author_name}</strong> · <time dateTime={item.created_at}>{boardDate(item.created_at)}</time></div>
      {draft === null && <div className={styles.actions}>
        {item.can_edit && <Button size="sm" disabled={change.isPending} onClick={() => { change.reset(); setDraft(item.body); }}>댓글 수정</Button>}
        {item.can_delete && <Button size="sm" loading={change.isPending} onClick={() => void remove()}>댓글 삭제</Button>}
      </div>}
    </div>
    {draft === null ? <p className={styles.content}>{item.body}</p> : <form className={styles.form} onSubmit={save}>
      <label>댓글 수정 내용<textarea autoFocus required rows={2} maxLength={5000} value={draft}
        disabled={change.isPending} onChange={event => setDraft(event.target.value)} /></label>
      <div className={styles.actions}><Button type="button" disabled={change.isPending} onClick={() => { setDraft(null); change.reset(); }}>취소</Button>
        <Button type="submit" intent="primary" loading={change.isPending} disabled={!draft.trim()}>댓글 수정 저장</Button></div>
    </form>}
    {change.isError && <p role="alert" className={styles.error}>{getApiErrorMessage(change.error, "댓글을 변경하지 못했습니다. 다시 시도해 주세요.")}</p>}
  </li>;
}
