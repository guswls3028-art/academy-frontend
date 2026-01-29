// src/features/media/playback/hooks/usePlaybackEvents.ts

import { useCallback, useEffect, useRef } from "react";
import type { PlaybackEvent, PlaybackEventType } from "../api/types";
import { postPlaybackEvents, postPlaybackEventsBestEffort } from "../api/playback";
import { nowEpochSeconds } from "../utils/time";

type Args = {
  videoId: number;
  getToken: () => string | null;
  enabled: boolean;
};

export function usePlaybackEvents({ videoId, getToken, enabled }: Args) {
  const queueRef = useRef<PlaybackEvent[]>([]);
  const flushingRef = useRef(false);

  const push = useCallback(
    (type: PlaybackEventType, payload?: PlaybackEvent["payload"]) => {
      if (!enabled) return;

      queueRef.current.push({
        type,
        payload,
        occurred_at: nowEpochSeconds(),
      });

      if (queueRef.current.length >= 10) {
        void flush(false);
      }
    },
    [enabled],
  );

  const flush = useCallback(
    async (bestEffort: boolean) => {
      if (!enabled) return;
      if (flushingRef.current) return;

      const token = getToken();
      if (!token) return;

      const events = queueRef.current;
      if (!events.length) return;

      queueRef.current = [];
      flushingRef.current = true;

      try {
        const body = { token, events };
        if (bestEffort) {
          await postPlaybackEventsBestEffort(videoId, body);
        } else {
          await postPlaybackEvents(videoId, body);
        }
      } catch {
        // v1: drop
      } finally {
        flushingRef.current = false;
      }
    },
    [enabled, getToken, videoId],
  );

  // 5초 주기 flush
  useEffect(() => {
    if (!enabled) return;

    const t = window.setInterval(() => {
      void flush(false);
    }, 5000);

    return () => window.clearInterval(t);
  }, [enabled, flush]);

  // visibilitychange: backend enum에 맞게 hidden/visible 분리
  useEffect(() => {
    if (!enabled) return;

    const handler = () => {
      if (document.visibilityState === "hidden") {
        push("VISIBILITY_HIDDEN");
        void flush(true);
      } else {
        push("VISIBILITY_VISIBLE");
      }
    };

    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [enabled, flush, push]);

  // beforeunload best-effort flush
  useEffect(() => {
    if (!enabled) return;

    const handler = () => {
      void flush(true);
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, flush]);

  // focus/blur (선택: 감사 로그 풍부화, enforcement 아님)
  useEffect(() => {
    if (!enabled) return;

    const onBlur = () => push("FOCUS_LOST");
    const onFocus = () => push("FOCUS_GAINED");

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, push]);

  return { push, flush };
}
