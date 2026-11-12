import { useEffect, useRef, useState } from "react";

import { isAxiosError } from "axios";
import { requestVideoSourceDownload } from "../../../../api/videos.api";

export default function VideoSourceDownload({ videoId }: { videoId: number }) {
  const requestRef = useRef<AbortController | null>(null);
  const saveRef = useRef<HTMLAnchorElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<{ href: string; filename: string; lifetimeMs: number } | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (!file) return;
    saveRef.current?.focus({ preventScroll: true });
    const timeout = window.setTimeout(() => setFile(null), file.lifetimeMs);
    return () => window.clearTimeout(timeout);
  }, [file]);

  async function download() {
    if (requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setPending(true);
    setError("");
    try {
      const result = await requestVideoSourceDownload(videoId, request.signal);
      if (request.signal.aborted) return;
      const url = new URL(result.download_url);
      if (
        url.protocol !== "https:" || url.username || url.password || !result.filename
        || !Number.isInteger(result.expires_in) || result.expires_in <= 5 || result.expires_in > 300
      ) {
        throw new Error("Invalid download response");
      }
      setFile({ href: url.href, filename: result.filename, lifetimeMs: (result.expires_in - 5) * 1000 });
    } catch (cause) {
      if (!request.signal.aborted) {
        const detail = isAxiosError<{ detail?: string }>(cause) ? cause.response?.data?.detail : undefined;
        setError(typeof detail === "string" ? detail : "원본을 내려받지 못했습니다. 다시 시도해 주세요.");
      }
    } finally {
      if (!request.signal.aborted) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }

  return <>
    {file
      ? <a ref={saveRef} className="video-detail-action" href={file.href} download={file.filename} rel="noreferrer">
        파일 저장
      </a>
      : <button type="button" className="video-detail-action" onClick={download} disabled={pending}>
        {pending ? "원본 확인 중…" : "원본 다운로드"}
      </button>}
    {error && <span role="alert" className="video-detail-download-error">{error}</span>}
  </>;
}
