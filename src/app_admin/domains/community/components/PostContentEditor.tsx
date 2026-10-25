import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import PostReadView from "./PostReadView";
import { updatePost, type PostEntity } from "../api/community.api";
import { adminCommunityQueryKeys } from "../queryKeys";
import { usePostAttachmentBatch } from "../hooks/usePostAttachmentBatch";
import type { PostDraftStateChange } from "../hooks/usePostDraftNavigation";
import { NoticeDraftFiles } from "./NoticeAttachments";
import "../notice-attachments.css";

export default function PostContentEditor({ post, saveLabel = "저장", onDraftStateChange }: { post: PostEntity; saveLabel?: string; onDraftStateChange?: PostDraftStateChange }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(post.content ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saved = useRef(post.content ?? "");
  const saving = useRef(false);
  const batch = usePostAttachmentBatch(post.attachments?.length ?? 0);
  const dirty = editing && (content !== saved.current || batch.files.length > 0);
  useEffect(() => {
    onDraftStateChange?.(dirty, busy);
    return () => onDraftStateChange?.(false, false);
  }, [onDraftStateChange, dirty, busy]);

  useEffect(() => {
    if (!dirty) return;
    const preventExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventExit);
    return () => window.removeEventListener("beforeunload", preventExit);
  }, [dirty]);

  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      if (content !== saved.current) {
        await updatePost(post.id, { content });
        saved.current = content;
      }
      await batch.upload(post.id);
      await qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(post.id) });
      void qc.invalidateQueries({ queryKey: post.post_type === "materials" ? adminCommunityQueryKeys.materialsPosts : adminCommunityQueryKeys.boardPosts });
      setEditing(false);
      feedback.success("내용이 저장되었습니다.");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "저장하지 못했습니다. 작성 내용과 파일은 유지됩니다. 다시 시도해 주세요."));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (saving.current) return;
    if (dirty && !await confirm({ title: "수정 취소", message: "저장하지 않은 변경을 취소할까요? 이미 저장된 내용은 유지됩니다.", confirmText: "수정 취소" })) return;
    batch.reset();
    setEditing(false);
    setError("");
    void qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(post.id) });
  };

  if (!editing) return <>
    <PostReadView html={post.content ?? ""} />
    <div className="cms-detail__content-actions"><Button size="sm" intent="ghost" onClick={() => {
      saved.current = post.content ?? "";
      setContent(saved.current);
      setEditing(true);
    }}>수정</Button></div>
  </>;

  return <>
    <RichTextEditor value={content} onChange={setContent} onFileAttach={batch.add} readOnly={busy || batch.locked} placeholder="내용을 입력하세요." minHeight={200} />
    <NoticeDraftFiles files={batch.files} disabled={busy || batch.locked} onRemove={batch.remove} />
    {error && <p role="alert" className="community-field__error">{error}</p>}
    <div className="cms-detail__content-actions">
      <Button size="sm" intent="primary" disabled={busy} onClick={() => void save()}>{busy ? "저장 중…" : batch.locked ? "첨부 다시 시도" : saveLabel}</Button>
      <Button size="sm" intent="secondary" disabled={busy} onClick={() => void cancel()}>취소</Button>
    </div>
  </>;
}
