import { useRef, useState } from "react";
import { createClientRequestKey, isHttpStatus, type ReplyPhotoBatch } from "@/shared/api/contracts/community";
import { feedback } from "@/shared/ui/feedback/feedback";
import { selectCommunityFiles } from "@/shared/utils/selectCommunityFiles";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function useReplyPhotoDraft() {
  const [files, setFiles] = useState<File[]>([]);
  const [locked, setLocked] = useState(false);
  const key = useRef<string | null>(null);

  const add = (incoming: File[]) => {
    if (key.current) return;
    const supported = incoming.filter((file) => IMAGE_TYPES.has(file.type));
    if (supported.length !== incoming.length) feedback.warning("JPG, PNG, GIF 또는 WebP 사진을 첨부해 주세요.");
    setFiles(selectCommunityFiles(files, supported));
  };

  const remove = (index: number) => {
    if (!key.current) setFiles((current) => current.filter((_, i) => i !== index));
  };

  const batch = (): ReplyPhotoBatch | undefined => {
    if (!files.length) return undefined;
    // Keep the same request and files if the server may already have saved them.
    key.current ??= createClientRequestKey();
    setLocked(true);
    return { files, requestKey: key.current };
  };

  const unlock = () => {
    key.current = null;
    setLocked(false);
  };

  const handleError = (error: unknown) => {
    if (isHttpStatus(error, 400) || isHttpStatus(error, 413)) unlock();
  };

  const reset = () => {
    unlock();
    setFiles([]);
  };

  return { files, locked, add, remove, batch, handleError, reset };
}
