import { useEffect, useRef, useState } from "react";
import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { Button } from "@/shared/ui/ds";
import styles from "./HomeworkMediaImage.module.css";

type CompatiblePreview = { status: "not_requested" | "queued" | "processing" | "ready" | "failed"; url?: string; detail?: string };
type Props = { src: string; homeworkId: number; fileId: string; filename: string; studentId?: number | null; onViewed?: () => void; onError: () => void };

/** Metadata/audio playback alone never counts as viewing a homework video. */
export default function HomeworkMediaVideo({ src, homeworkId, fileId, filename, studentId, onViewed, onError }: Props) {
  const [compatibleUrl, setCompatibleUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const started = useRef(false);
  useEffect(() => () => { active.current?.abort(); clearTimeout(timer.current); }, []);

  const prepare = async (retry = false) => {
    if (active.current) return;
    started.current = true;
    setPreparing(true);
    setError(null);
    const controller = new AbortController();
    active.current = controller;
    try {
      const generation = readAuthTokenEnvelopeSafely()?.generation;
      const tenant = getTenantCodeForApiRequest();
      if (!generation || !tenant) throw new Error("로그인 상태를 확인한 뒤 다시 열어 주세요.");
      const config = { ...createAuthSessionBoundConfig(generation, controller.signal, tenant),
        headers: studentId == null ? undefined : { "X-Student-Id": String(studentId) } };
      const path = `/submissions/submissions/homework/${homeworkId}/media/${encodeURIComponent(fileId)}/preview/compatible/`;
      let response = (await api.get<CompatiblePreview>(path, config)).data;
      if (response.status === "not_requested" || (retry && response.status === "failed")) {
        response = (await api.post<CompatiblePreview>(path, {}, config)).data;
      }
      const deadline = Date.now() + 30 * 60_000;
      while (response.status === "queued" || response.status === "processing") {
        if (Date.now() >= deadline) throw new Error("영상 준비가 지연되고 있습니다. 잠시 후 다시 확인해 주세요.");
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer.current); reject(new DOMException("Preview closed", "AbortError")); };
          controller.signal.addEventListener("abort", abort, { once: true });
          timer.current = setTimeout(() => { controller.signal.removeEventListener("abort", abort); resolve(); }, 3000);
          if (controller.signal.aborted) abort();
        });
        response = (await api.get<CompatiblePreview>(path, config)).data;
      }
      if (response.status !== "ready" || !response.url) throw new Error(response.detail || "영상을 준비하지 못했습니다. 다시 시도해 주세요.");
      if (!controller.signal.aborted) setCompatibleUrl(response.url);
    } catch (failure) {
      if (!controller.signal.aborted) {
        const detail = (failure as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
        setError(typeof detail === "string" ? detail : failure instanceof Error ? failure.message : "영상 준비에 실패했습니다. 다시 시도해 주세요.");
      }
    } finally {
      if (!controller.signal.aborted) setPreparing(false);
      if (active.current === controller) active.current = null;
    }
  };

  const cannotDecode = () => {
    if (compatibleUrl) {
      setError("이 브라우저에서 영상을 열지 못했습니다. 다시 시도해 주세요. 원본은 보관되어 있습니다.");
    } else if (!started.current) void prepare();
  };

  if (preparing) return <div className={styles.loading} role="status">이 기기에서 재생할 영상을 준비하고 있습니다. 원본은 그대로 유지되며, 창을 닫아도 준비는 계속됩니다.</div>;
  if (error) return <div className={styles.loading} role="alert"><p>{error}</p><Button type="button" intent="secondary" size="sm" onClick={() => { setCompatibleUrl(null); void prepare(true); }}>영상 다시 준비</Button></div>;
  return <video key={compatibleUrl ?? src} src={compatibleUrl ?? src} controls playsInline preload="auto" aria-label={filename}
    onLoadedMetadata={(event) => { if (event.currentTarget.videoWidth === 0) cannotDecode(); }}
    onLoadedData={(event) => {
      if (event.currentTarget.videoWidth > 0 && event.currentTarget.videoHeight > 0 && event.currentTarget.readyState >= 2) onViewed?.();
      else cannotDecode();
    }}
    onError={(event) => { if (event.currentTarget.error?.code === 2) onError(); else cannotDecode(); }}
  >브라우저에서 이 동영상을 재생할 수 없습니다.</video>;
}
