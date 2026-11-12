import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isAxiosError } from "axios";
import {
  fetchVideoPlaybackExport,
  requestVideoPlaybackExport,
  requestVideoSourceDownload,
} from "../../../../api/videos.api";
import { adminVideoQueryKeys } from "../../../../queryKeys";

type SaveFile = { href: string; filename: string; lifetimeMs: number };

function downloadFile(result: { download_url?: string; filename?: string; expires_in?: number }): SaveFile {
  if (
    !result.download_url || !result.filename || typeof result.expires_in !== "number"
    || !Number.isInteger(result.expires_in) || result.expires_in <= 5 || result.expires_in > 300
  ) throw new Error("Invalid download response");
  const url = new URL(result.download_url);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid download URL");
  return { href: url.href, filename: result.filename, lifetimeMs: (result.expires_in - 5) * 1000 };
}

function SaveVideoFile({ file, onExpiry }: { file: SaveFile; onExpiry: () => void }) {
  const saveRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    saveRef.current?.focus({ preventScroll: true });
    const timeout = window.setTimeout(onExpiry, file.lifetimeMs);
    return () => window.clearTimeout(timeout);
  }, [file, onExpiry]);
  return <a ref={saveRef} className="video-detail-action" href={file.href} download={file.filename} rel="noreferrer">
    파일 저장
  </a>;
}

function PlaybackExport({ videoId }: { videoId: number }) {
  const queryClient = useQueryClient();
  const queryKey = adminVideoQueryKeys.playbackExport(videoId);
  const [file, setFile] = useState<SaveFile | null>(null);
  const [error, setError] = useState("");
  const clearFile = useCallback(() => setFile(null), []);
  const progress = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchVideoPlaybackExport(videoId, signal),
    refetchInterval: (query) => query.state.data?.state === "preparing" ? 5000 : false,
    retry: false,
  });
  const prepare = useMutation({
    mutationFn: async () => {
      const result = await requestVideoPlaybackExport(videoId);
      if (result.download_url) setFile(downloadFile(result));
      return result.state;
    },
    onMutate: () => setError(""),
    onSuccess: (state) => queryClient.setQueryData(queryKey, { state }),
    onError: (cause) => {
      const detail = isAxiosError<{ detail?: string }>(cause) ? cause.response?.data?.detail : undefined;
      setError(typeof detail === "string" ? detail : "재생본을 준비하지 못했습니다. 다시 시도해 주세요.");
    },
  });
  const state = progress.data?.state;
  if (file) return <SaveVideoFile file={file} onExpiry={clearFile} />;
  return <>
    {state === "preparing" ? <span role="status">재생본을 준비하고 있습니다. 나중에 다시 열어도 됩니다.</span>
      : <button type="button" className="video-detail-action" onClick={() => prepare.mutate()} disabled={prepare.isPending}>
        {prepare.isPending ? "재생본 확인 중…" : state === "ready" ? "재생본 받기" : "재생본 MP4 준비"}
      </button>}
    {(error || state === "failed") && <span role="alert" className="video-detail-download-error">
      {error || "재생본 준비가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요."}
    </span>}
  </>;
}

export default function VideoSourceDownload({ videoId, canExport }: { videoId: number; canExport: boolean }) {
  const requestRef = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [file, setFile] = useState<SaveFile | null>(null);
  const clearFile = useCallback(() => setFile(null), []);
  useEffect(() => () => requestRef.current?.abort(), []);

  async function download() {
    if (requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setPending(true);
    setError("");
    setMissing(false);
    try {
      const result = await requestVideoSourceDownload(videoId, request.signal);
      if (request.signal.aborted) return;
      setFile(downloadFile(result));
    } catch (cause) {
      if (!request.signal.aborted) {
        const data = isAxiosError<{ detail?: string; code?: string }>(cause) ? cause.response?.data : undefined;
        setError(typeof data?.detail === "string" ? data.detail : "원본을 내려받지 못했습니다. 다시 시도해 주세요.");
        setMissing(data?.code === "video_source_missing");
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
      ? <SaveVideoFile file={file} onExpiry={clearFile} />
      : <button type="button" className="video-detail-action" onClick={download} disabled={pending}>
        {pending ? "원본 확인 중…" : "원본 다운로드"}
      </button>}
    {error && <span role="alert" className="video-detail-download-error">{error}</span>}
    {missing && canExport && <PlaybackExport videoId={videoId} />}
  </>;
}
