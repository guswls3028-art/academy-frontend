import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import type { PostAttachment } from "@/shared/api/contracts/community";
import "./reply-photos.css";

export function ReplyPhotoDraft({
  files,
  onRemove,
  disabled,
}: {
  files: File[];
  onRemove: (index: number) => void;
  disabled: boolean;
}) {
  if (!files.length) return null;
  return (
    <ul className="reply-photo-draft" aria-label="첨부할 답변 사진">
      {files.map((file, index) => (
        <ReplyPhotoPreview
          key={`${file.name}:${file.size}:${file.lastModified}`}
          file={file}
          onRemove={() => onRemove(index)}
          disabled={disabled}
        />
      ))}
    </ul>
  );
}

function ReplyPhotoPreview({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <li>
      {url && <img src={url} alt={file.name} />}
      <button type="button" title={`${file.name} 제거`} aria-label={`${file.name} 제거`} onClick={onRemove} disabled={disabled}>
        <X size={ICON.sm} />
      </button>
    </li>
  );
}

export function ReplyPhotos({ attachments, onRetry }: { attachments?: PostAttachment[]; onRetry: () => Promise<unknown> }) {
  if (!attachments?.length) return null;
  return (
    <div className="reply-photos">
      {attachments.map((photo) => (
        <ReplyPhoto key={photo.id} photo={photo} onRetry={onRetry} />
      ))}
    </div>
  );
}

function ReplyPhoto({ photo, onRetry }: { photo: PostAttachment; onRetry: () => Promise<unknown> }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const url = photo.download_url;
  if (!url || url === failedUrl) {
    return (
      <div className="reply-photos__error">
        <span>{photo.original_name} 사진을 불러오지 못했습니다.</span>
        <button type="button" disabled={retrying} onClick={async () => {
          setRetrying(true);
          try {
            await onRetry();
            setFailedUrl(undefined);
          } finally {
            setRetrying(false);
          }
        }}>
          {retrying ? "불러오는 중…" : "사진 다시 불러오기"}
        </button>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${photo.original_name} 원본 열기`}>
      <img src={url} alt={`답변 사진: ${photo.original_name}`} decoding="async" onError={() => setFailedUrl(url)} />
    </a>
  );
}
