import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { feedback } from "@/shared/ui/feedback/feedback";
import type { PostAttachment } from "../api/community.api";
import { adminCommunityQueryKeys } from "../queryKeys";
import { usePostAttachmentBatch } from "../hooks/usePostAttachmentBatch";
import type { PostDraftStateChange } from "../hooks/usePostDraftNavigation";
import NoticeAttachments, { NoticeDraftFiles } from "./NoticeAttachments";
import "../notice-attachments.css";

export default function PostAttachmentManager({ postId, attachments, nativePicker = false, onDraftStateChange }: { postId: number; attachments: PostAttachment[]; nativePicker?: boolean; onDraftStateChange?: PostDraftStateChange }) {
  const qc = useQueryClient();
  const batch = usePostAttachmentBatch(attachments.length);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    onDraftStateChange?.(batch.files.length > 0, busy);
    return () => onDraftStateChange?.(false, false);
  }, [onDraftStateChange, batch.files.length, busy]);
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
      {!nativePicker && <Button intent="ghost" size="sm" disabled={busy || batch.locked || attachments.length + batch.files.length >= 10} onClick={() => input.current?.click()}>+ 파일 추가</Button>}
      <label htmlFor={inputId} className={nativePicker ? "ds-button cms-attach__picker" : "cms-form__file-input--hidden"} data-intent="ghost" data-size="sm" data-disabled={busy || batch.locked || attachments.length + batch.files.length >= 10 ? "true" : "false"}>
      {nativePicker && <span className="ds-button__label">+ 파일 추가</span>}
      <input id={inputId} ref={input} type="file" multiple className={nativePicker ? "cms-attach__picker-input" : "cms-form__file-input--hidden"} aria-label="첨부할 파일 선택" disabled={busy || batch.locked || attachments.length + batch.files.length >= 10} onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        batch.add(files);
      }} />
      </label>
    </div>
    <NoticeDraftFiles files={batch.files} disabled={busy || batch.locked} onRemove={batch.remove} />
    {error && <p role="alert" className="community-field__error">{error}</p>}
    {batch.files.length > 0 && <Button intent="primary" size="sm" disabled={busy} onClick={() => void upload()}>{busy ? "저장 중…" : batch.locked ? "첨부 다시 시도" : "첨부 저장"}</Button>}
  </>;
}
