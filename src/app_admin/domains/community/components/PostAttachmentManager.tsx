import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { feedback } from "@/shared/ui/feedback/feedback";
import type { PostAttachment } from "../api/community.api";
import { adminCommunityQueryKeys } from "../queryKeys";
import { usePostAttachmentBatch } from "../hooks/usePostAttachmentBatch";
import NoticeAttachments, { NoticeDraftFiles } from "./NoticeAttachments";
import "../notice-attachments.css";

export default function PostAttachmentManager({ postId, attachments }: { postId: number; attachments: PostAttachment[] }) {
  const qc = useQueryClient();
  const batch = usePostAttachmentBatch(attachments.length);
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await batch.upload(postId);
      await qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
      feedback.success("파일이 첨부되었습니다.");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "파일을 저장하지 못했습니다. 선택한 파일로 다시 시도해 주세요."));
    } finally { saving.current = false; setBusy(false); }
  };
  return <>
    <NoticeAttachments postId={postId} attachments={attachments} disabled={busy || batch.locked} />
    <div className="cms-attach__header">
      {!attachments.length && <div className="cms-detail__section-label">첨부파일</div>}
      <Button intent="ghost" size="sm" disabled={busy || batch.locked || attachments.length + batch.files.length >= 10} onClick={() => input.current?.click()}>+ 파일 추가</Button>
      <input ref={input} type="file" multiple hidden aria-label="첨부할 파일 선택" disabled={busy || batch.locked} onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        batch.add(files);
      }} />
    </div>
    <NoticeDraftFiles files={batch.files} disabled={busy || batch.locked} onRemove={batch.remove} />
    {error && <p role="alert" className="community-field__error">{error}</p>}
    {batch.files.length > 0 && <Button intent="primary" size="sm" disabled={busy} onClick={() => void upload()}>{busy ? "저장 중…" : batch.locked ? "첨부 다시 시도" : "첨부 저장"}</Button>}
  </>;
}
