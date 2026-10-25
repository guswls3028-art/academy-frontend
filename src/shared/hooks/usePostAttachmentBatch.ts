import { useRef, useState } from "react";
import api from "@/shared/api/axios";
import { createClientRequestKey, uploadCommunityPostAttachments } from "@/shared/api/contracts/community";

import { selectCommunityFiles } from "@/shared/utils/selectCommunityFiles";

/** An uncertain response retains the exact batch and request key until retry succeeds. */
export function usePostAttachmentBatch(existingCount = 0) {
  const [files, setFiles] = useState<File[]>([]);
  const [locked, setLocked] = useState(false);
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);
  const add = (incoming: File[]) => {
    if (key.current || inFlight.current) return;
    setFiles(selectCommunityFiles(files, incoming, existingCount));
  };
  const remove = (index: number) => {
    if (!key.current && !inFlight.current) setFiles((current) => current.filter((_, i) => i !== index));
  };
  const reset = () => {
    key.current = null;
    setLocked(false);
    setFiles([]);
  };
  const upload = async (postId: number) => {
    if (!files.length) return;
    if (inFlight.current) throw new Error("첨부파일을 저장하고 있습니다.");
    inFlight.current = true;
    key.current ??= createClientRequestKey();
    setLocked(true);
    try {
      await uploadCommunityPostAttachments(api, postId, files, key.current);
      reset();
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status === 400) {
        key.current = null;
        setLocked(false);
      }
      throw error;
    } finally {
      inFlight.current = false;
    }
  };
  return { files, locked, add, remove, reset, upload };
}
