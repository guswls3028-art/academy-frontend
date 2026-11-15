import type Hls from "hls.js";
import type { ControllerState } from "./controllerTypes";
import { hlsErrorDetails } from "./hlsErrorDetails";
import { describeQualityLevels } from "./playbackMediaSettings";

type EngineHost = {
  protectedReview: boolean;
  disposed(): boolean;
  setState(state: Partial<ControllerState>): void;
  currentQuality(): number;
  buffered(): void;
  error(payload: Record<string, unknown>): void;
  canRetry(): boolean;
  retry(kind: "network" | "media"): void;
  fatal(message: string): void;
};

/** Shared engine configuration and event policy for initial and recovered HLS playback. */
export function createStudentHls(HlsClass: typeof Hls, host: EngineHost): Hls {
  const hls = new HlsClass({
    lowLatencyMode: false,
    autoStartLoad: !host.protectedReview,
    backBufferLength: 30,
    maxBufferLength: 60,
    maxMaxBufferLength: 120,
    startLevel: -1,
    abrEwmaDefaultEstimate: 20_000_000,
    abrEwmaDefaultEstimateMax: 50_000_000,
  });
  hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
    if (host.disposed()) return;
    if (host.protectedReview) host.setState({ ready: true });
    host.setState({ qualities: describeQualityLevels(hls.levels) });
  });
  hls.on(HlsClass.Events.FRAG_BUFFERED, () => {
    if (!host.disposed()) host.buffered();
  });
  hls.on(HlsClass.Events.LEVEL_SWITCHED, (_event, data) => {
    if (host.disposed()) return;
    const quality = hls.autoLevelEnabled ? -1 : data.level;
    if (typeof quality === "number" && quality !== host.currentQuality()) {
      host.setState({ currentQuality: quality });
    }
  });
  hls.on(HlsClass.Events.ERROR, (_event, data) => {
    if (host.disposed()) return;
    try {
      host.error({ fatal: !!data?.fatal, details: data?.details || "", type: data?.type || "" });
    } catch { /* Best-effort telemetry must not interrupt playback recovery. */ }
    if (!data?.fatal) return;
    const { detail, is404, isServiceAuthError, isServiceUnavailable, isNetworkError, isMediaError } =
      hlsErrorDetails(data, HlsClass.ErrorTypes.NETWORK_ERROR, HlsClass.ErrorTypes.MEDIA_ERROR);
    const fail = (message: string, toast = message) => {
      host.setState({ toast: { text: toast, kind: "danger" }, reconnecting: false });
      host.fatal(message);
    };
    if (is404) {
      fail("비디오 파일을 찾을 수 없습니다.", "비디오 파일을 찾을 수 없습니다. 처리 중이거나 업로드되지 않았을 수 있습니다.");
      return;
    }
    // Authentication failures require a new authorized URL, never a same-URL retry.
    if (isServiceAuthError) {
      fail("영상 서비스 인증에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if ((isNetworkError || isMediaError) && host.canRetry()) {
      host.retry(isMediaError ? "media" : "network");
      return;
    }
    fail(isServiceUnavailable
      ? "영상 서비스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
      : isNetworkError ? "영상 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요."
      : `재생 오류가 발생했습니다: ${detail}`);
  });
  return hls;
}
