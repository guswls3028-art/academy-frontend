// src/features/media/playback/utils/time.ts

export function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
