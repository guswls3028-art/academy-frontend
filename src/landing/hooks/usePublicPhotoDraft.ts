import { useRef, useState } from "react";
import { uploadReviewPhoto } from "../api/publicCommunity";

export function usePublicPhotoDraft() {
  const [existing, setExisting] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const uploaded = useRef(new Map<File, string>());
  const add = (incoming: File[]) => {
    const next = [...files];
    const warnings = new Set<string>();
    for (const file of incoming) {
      if (!/\.(png|jpe?g|webp)$/i.test(file.name) || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) warnings.add("PNG / JPG / WebP 사진을 선택해 주세요.");
      else if (file.size > 5 * 1024 * 1024) warnings.add("사진은 한 장당 5MB 이하여야 합니다.");
      else if (next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) warnings.add("이미 선택한 사진입니다.");
      else if (existing.length + next.length >= 8) warnings.add("사진은 최대 8장까지 첨부할 수 있습니다.");
      else next.push(file);
    }
    setFiles(next);
    setError([...warnings].join(" "));
  };
  const remove = (index: number) => {
    uploaded.current.delete(files[index]);
    setFiles(files.filter((_, i) => i !== index));
    setError("");
  };
  const upload = async () => {
    const references = [...existing];
    for (const file of files) {
      let key = uploaded.current.get(file);
      if (!key) {
        // The existing public-community endpoint returns an author/content-bound
        // key. Keep completed files when a later upload or post save fails.
        const result = await uploadReviewPhoto(file);
        key = result.key;
        uploaded.current.set(file, key);
      }
      references.push(key);
    }
    return references;
  };
  return { existing, setExisting, files, error, add, remove, upload };
}
