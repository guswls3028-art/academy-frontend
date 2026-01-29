// src/features/media/playback/hooks/usePlaybackSession.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaybackPolicy, PlaybackStartResponse } from "../api/types";
import { playVideo, heartbeatSession, refreshSession, endSession } from "../api/playback";
import { nowEpochSeconds } from "../utils/time";

type State = {
  token: string | null;
  sessionId: string | null;
  expiresAt: number | null;
  policy: PlaybackPolicy | null;
  playUrl: string | null;
};

type Args = {
  videoId: number;
  enrollmentId: number | null;
  deviceId: string;
  enabled: boolean;
};

export function usePlaybackSession({ videoId, enrollmentId, deviceId, enabled }: Args) {
  const [state, setState] = useState<State>({
    token: null,
    sessionId: null,
    expiresAt: null,
    policy: null,
    playUrl: null,
  });

  const tokenRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const expiresRef = useRef<number | null>(null);

  const refreshInFlightRef = useRef(false);

  // 🔒 start 1회 보장 가드 (핵심)
  const startedRef = useRef(false);

  const setFromStart = useCallback((resp: PlaybackStartResponse) => {
    tokenRef.current = resp.token;
    sessionRef.current = resp.session_id;
    expiresRef.current = resp.expires_at;

    setState({
      token: resp.token,
      sessionId: resp.session_id,
      expiresAt: resp.expires_at,
      policy: resp.policy,
      playUrl: resp.play_url,
    });
  }, []);

  const startInternal = useCallback(async () => {
    if (!enabled) return;
    if (!enrollmentId) return;

    // ✅ 이미 start 했으면 재호출 금지
    if (startedRef.current) return;
    startedRef.current = true;

    try {
      const resp = await playVideo({
        videoId,
        enrollment_id: enrollmentId,
        device_id: deviceId,
      });

      setFromStart(resp);
    } catch (e) {
      // 실패 시 재시도 가능하도록 롤백
      startedRef.current = false;
      throw e;
    }
  }, [deviceId, enabled, enrollmentId, setFromStart, videoId]);

  const heartbeat = useCallback(async () => {
    const token = tokenRef.current;
    if (!enabled || !token) return;

    try {
      await heartbeatSession({ videoId, token });
    } catch {
      // v1: drop
    }
  }, [enabled, videoId]);

  const refresh = useCallback(async () => {
    const token = tokenRef.current;
    const expiresAt = expiresRef.current;
    if (!enabled || !token || !expiresAt) return;

    const now = nowEpochSeconds();
    const left = expiresAt - now;

    // expires 60s 이내에만 refresh
    if (left > 60) return;
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    try {
      const resp = await refreshSession({ videoId, token });
      setFromStart(resp);
    } catch {
      // v1: drop
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [enabled, setFromStart, videoId]);

  const end = useCallback(async () => {
    const token = tokenRef.current;
    if (!enabled || !token) return;

    try {
      await endSession({ videoId, token });
    } catch {
      // v1: drop
    }
  }, [enabled, videoId]);

  // ▶️ enabled일 때 최초 1회 start
  useEffect(() => {
    if (!enabled) return;
    if (!enrollmentId) return;

    void startInternal();
  }, [enabled, enrollmentId, startInternal]);

  // 🔁 heartbeat + refresh 주기
  useEffect(() => {
    if (!enabled) return;

    const t = window.setInterval(() => {
      void heartbeat();
      void refresh();
    }, 45_000);

    return () => window.clearInterval(t);
  }, [enabled, heartbeat, refresh]);

  // ⛔ unmount 시 best-effort end
  useEffect(() => {
    return () => {
      void end();
    };
  }, [end]);

  const ready = useMemo(() => {
    return Boolean(
      enabled &&
        state.token &&
        state.sessionId &&
        state.playUrl &&
        state.policy &&
        state.expiresAt
    );
  }, [enabled, state.expiresAt, state.playUrl, state.policy, state.sessionId, state.token]);

  return {
    ...state,
    ready,
    getToken: () => tokenRef.current,
    heartbeat,
    refresh,
    end,
  };
}
