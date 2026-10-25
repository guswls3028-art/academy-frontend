import { useEffect, useRef, useState } from "react";
import type { usePublicPhotoDraft } from "../hooks/usePublicPhotoDraft";
import "./PublicPhotos.css";

function DraftPhoto({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? <img src={url} alt={`${file.name} 미리보기`} /> : null;
}

export function PublicPhotoPicker({ draft, disabled }: { draft: ReturnType<typeof usePublicPhotoDraft>; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return <section className="public-photos" aria-label="첨부 사진">
    <div className="public-photos__header">
      <strong>사진 ({draft.existing.length + draft.files.length}/8)</strong>
      <button type="button" disabled={disabled || draft.existing.length + draft.files.length >= 8} onClick={() => input.current?.click()}>사진 추가</button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="사진 첨부" disabled={disabled} onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        draft.add(files);
      }} />
    </div>
    <p>PNG / JPG / WebP · 한 장 5MB 이하 · 저장하면 본문 아래에 표시됩니다.</p>
    <div className="public-photos__grid">
      {draft.existing.map((url, index) => <figure key={url}><img src={url} alt={`첨부 사진 ${index + 1}`} /><button type="button" disabled={disabled} aria-label={`첨부 사진 ${index + 1} 제거`} onClick={() => draft.setExisting(draft.existing.filter((_, i) => i !== index))}>제거</button></figure>)}
      {draft.files.map((file, index) => <figure key={`${file.name}-${file.size}-${file.lastModified}`}><DraftPhoto file={file} /><figcaption>{file.name}</figcaption><button type="button" disabled={disabled} aria-label={`${file.name} 제거`} onClick={() => draft.remove(index)}>제거</button></figure>)}
    </div>
    {draft.error && <p role="alert">{draft.error}</p>}
  </section>;
}

export function PublicPhotoGallery({ photos, onRefresh }: { photos: string[]; onRefresh: () => Promise<void> }) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!photos.length) return null;
  return <section className="public-photos" aria-label="첨부 사진">
    <div className="public-photos__gallery">{photos.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`첨부 사진 ${index + 1}`} onError={() => setFailed(true)} /></a>)}</div>
    {failed && <div role="alert">사진을 불러오지 못했습니다. <button type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await onRefresh(); setFailed(false); } catch { setFailed(true); } finally { setBusy(false); }
    }}>{busy ? "불러오는 중…" : "사진 다시 보기"}</button></div>}
  </section>;
}
