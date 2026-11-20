import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getCommunityStorageCleanupNotice } from "@/shared/api/contracts/community";
import { deletePostAttachment, getAttachmentDownloadUrl, type PostAttachment } from "../api/community.api";
import { adminCommunityQueryKeys } from "../queryKeys";
import PhotoPreview from "@/shared/ui/media/PhotoPreview";
import { isPhotoFile } from "@/shared/ui/media/photoType";
import { formatFileSize } from "../utils/communityHelpers";

function DraftImage({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  if (failed) return <p role="status" className="cms-attach__hint">사진을 미리 볼 수 없습니다. 파일을 제거하고 다시 선택할 수 있습니다.</p>;
  return url ? (
    <PhotoPreview
      className="notice-attach__image notice-attach__draft-image"
      src={url}
      blob={file}
      filename={file.name}
      mimeType={file.type}
      alt={`${file.name} 미리보기`}
      onError={() => setFailed(true)}
    />
  ) : null;
}

export function NoticeDraftFiles({ files, disabled, onRemove }: {
  files: File[];
  disabled: boolean;
  onRemove: (index: number) => void;
}) {
  if (!files.length) return null;
  return (
    <div className="cms-attach__list notice-attach__draft" aria-label="저장할 첨부파일">
      <p className="cms-attach__hint">사진은 저장 후에도 본문 아래에 표시됩니다. 이미지 5MB · 파일 50MB · 최대 10개</p>
      {files.map((file, index) => (
        <div className="notice-attach__saved" key={`${file.name}-${file.size}-${file.lastModified}`}>
          {isPhotoFile(file.name, file.type) && <DraftImage file={file} />}
          <div className="cms-attach__item">
            <span className="cms-attach__item-name" title={file.name}>{file.name}</span>
            <span className="cms-attach__item-size">{formatFileSize(file.size)}</span>
            <button className="cms-attach__item-remove" type="button" aria-label={`${file.name} 제거`} disabled={disabled} onClick={() => onRemove(index)}>&times;</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NoticeAttachments({ postId, attachments, disabled }: {
  postId: number;
  attachments: PostAttachment[];
  disabled: boolean;
}) {
  if (!attachments.length) return null;
  return (
    <section className="cms-attach__section" aria-label="첨부파일">
      <h2 className="cms-detail__section-label">첨부파일 ({attachments.length}/10)</h2>
      <div className="cms-attach__list">
        {attachments.map((attachment) => <Attachment key={`${postId}:${attachment.id}`} postId={postId} attachment={attachment} disabled={disabled} />)}
      </div>
    </section>
  );
}

function Attachment({ postId, attachment, disabled }: {
  postId: number;
  attachment: PostAttachment;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [preview, setPreview] = useState(attachment.download_url ?? "");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const isImage = isPhotoFile(attachment.original_name, attachment.content_type);

  const perform = async (action: "preview" | "download" | "delete") => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") {
        if (disabled || !await confirm({ title: "첨부파일 삭제", message: `"${attachment.original_name}" 파일을 삭제할까요?`, confirmText: "삭제", danger: true }) || !active.current) return;
        const result = await deletePostAttachment(postId, attachment.id);
        await qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
        const warning = getCommunityStorageCleanupNotice(result);
        if (warning) feedback.warning(warning);
      } else {
        const { url } = await getAttachmentDownloadUrl(postId, attachment.id);
        if (!active.current) return;
        if (action === "preview") {
          setPreview(url);
          setFailed(false);
        } else {
          const { downloadPresignedUrl } = await import("@/shared/utils/safeDownload");
          if (active.current) downloadPresignedUrl(url, attachment.original_name);
        }
      }
    } catch {
      if (active.current) setError("파일을 처리하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  };

  return (
    <div className="notice-attach__saved">
      {isImage && preview && !failed && (
        <PhotoPreview className="notice-attach__image" src={preview} filename={attachment.original_name} mimeType={attachment.content_type} alt={attachment.original_name} onError={() => setFailed(true)} />
      )}
      {isImage && (failed || !preview) && <p role="status" className="cms-attach__hint">사진 미리보기를 불러오지 못했습니다.</p>}
      <div className="cms-attach__file-card">
        <div className="cms-attach__file-info">
          <span className="cms-attach__file-name" title={attachment.original_name}>{attachment.original_name}</span>
          <span className="cms-attach__file-size">{formatFileSize(attachment.size_bytes)}</span>
        </div>
        <div className="cms-attach__file-actions">
          {isImage && (failed || !preview) && <Button intent="ghost" size="sm" disabled={busy} onClick={() => void perform("preview")}>다시 보기</Button>}
          <Button intent="ghost" size="sm" disabled={busy} onClick={() => void perform("download")}>다운로드</Button>
          <Button intent="ghost" size="sm" disabled={busy || disabled} aria-label={`${attachment.original_name} 삭제`} onClick={() => void perform("delete")}>삭제</Button>
        </div>
      </div>
      {busy && <p role="status" className="cms-attach__hint">파일 처리 중…</p>}
      {error && <p role="alert" className="community-field__error">{error}</p>}
    </div>
  );
}
