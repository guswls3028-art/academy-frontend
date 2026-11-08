import type Hls from "hls.js";
import type { Level } from "hls.js";
import type { ControllerState, QualityLevel } from "./controllerTypes";

export function capturePlaybackSource(el: HTMLVideoElement, state: ControllerState) {
  return {
    position: Number(el.currentTime || state.current || 0),
    wasPlaying: !el.paused,
    rate: Number(el.playbackRate || state.rate || 1),
    volume: Number(el.volume ?? state.volume),
    muted: Boolean(el.muted),
    quality: state.currentQuality,
  };
}

export type PlaybackSourceSnapshot = ReturnType<typeof capturePlaybackSource>;

export function restorePlaybackSource(el: HTMLVideoElement, pending: PlaybackSourceSnapshot, hls: Hls | null) {
  el.currentTime = pending.position;
  el.playbackRate = pending.rate;
  el.volume = pending.volume;
  el.muted = pending.muted;
  if (pending.quality >= 0 && hls) hls.currentLevel = pending.quality;
}

export function describeQualityLevels(levels: Level[]): QualityLevel[] {
  // A single rendition has no meaningful quality choice.
  if (!Array.isArray(levels) || levels.length < 2) return [];
  const options = levels.map((level, index) => {
    const height = Number(level?.height || 0);
    const bitrate = Number(level?.bitrate || 0);
    const label = height > 0 ? `${height}p` : bitrate > 0 ? `${Math.round(bitrate / 1000)}k` : `Level ${index + 1}`;
    return { index, label, height, bitrate };
  });
  options.sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
  return [{ index: -1, label: "Auto", height: 0, bitrate: 0 }, ...options];
}
