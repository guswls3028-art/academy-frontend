import { useCallback, useEffect, useRef, useState } from "react";
import { reportReviewWatch, REVIEW_EXHAUSTED, type ReviewWatch } from "../../api/reviewWatch.api";

export function useReviewWatch(
  videoId: number, enrollmentId: number | null, watch: ReviewWatch | null | undefined,
  playing: boolean, position: number, stop: (reason: string) => void,
) {
  const stream = watch?.stream;
  const sequence = useRef({ value: 0 }).current;
  const failureGeneration = useRef(0);
  const positionRef = useRef(position);
  positionRef.current = position;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const budget = useRef<number | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(watch?.remaining_ms ?? null);

  useEffect(() => {
    budget.current = watch?.remaining_ms ?? null;
    setRemaining(budget.current);
    if (!stream) return;
    return () => {
      failureGeneration.current++;
      void reportReviewWatch(videoId, enrollmentId, stream, ++sequence.value, false, positionRef.current).catch(() => {
        // Abrupt disconnects are bounded by the server's active-signal timeout.
      });
    };
  }, [stream, videoId, enrollmentId, sequence, watch?.remaining_ms]);

  useEffect(() => {
    if (!stream) return;
    let live = true;
    let busy = false;
    let confirmedPlaying = false;
    let pendingSequence: number | undefined;
    let retry: number | undefined;
    setReconnecting(false);
    let deadline: number | null = null;
    let lastAck = performance.now();
    const startDeadline = (ms: number | null) => {
      budget.current = ms;
      deadline = ms !== null && playing ? performance.now() + ms : null;
      setRemaining(ms);
    };
    startDeadline(budget.current);
    const fail = (reason: string) => {
      if (!live) return;
      live = false;
      stopRef.current(reason);
    };
    const send = async () => {
      if (busy || !live) return;
      busy = true;
      try {
        pendingSequence ??= ++sequence.value;
        const data = await reportReviewWatch(videoId, enrollmentId, stream, pendingSequence, playing, positionRef.current);
        if (!live) return;
        pendingSequence = undefined;
        confirmedPlaying = playing;
        clearTimeout(retry);
        setReconnecting(false);
        lastAck = performance.now();
        if (data.remaining_ms === 0) {
          fail(REVIEW_EXHAUSTED);
        } else {
          // Count the confirmed allowance from its acknowledgement so the ledger reaches zero before the UI stops.
          startDeadline(data.remaining_ms);
        }
      } catch (error) {
        if (!live) return;
        const response = (error as { response?: { status: number; data?: { detail?: string } } }).response;
        const temporary = !response || response.status >= 500 || response.status === 429 || response.status === 408;
        if (temporary && performance.now() - lastAck < 12_000) {
          setReconnecting(true);
          clearTimeout(retry);
          retry = window.setTimeout(() => { void send(); }, 1200);
        } else if (budget.current !== null) {
          fail(response?.data?.detail || "복습 시청시간을 저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
        } else {
          setReconnecting(false);
        }
      } finally {
        busy = false;
      }
    };
    void send();
    const pulse = playing ? window.setInterval(() => { void send(); }, 5000) : undefined;
    const clock = playing && budget.current !== null ? window.setInterval(() => {
      if (deadline === null || !live) return;
      const ms = Math.max(0, deadline - performance.now());
      setRemaining(ms);
      if (ms === 0) fail(confirmedPlaying ? REVIEW_EXHAUSTED : "남은 복습시간을 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
      else if (performance.now() - lastAck > 15000) fail("연결을 확인하고 영상을 다시 열어 주세요.");
    }, 200) : undefined;
    return () => {
      live = false;
      if (deadline !== null) budget.current = Math.max(0, deadline - performance.now());
      clearTimeout(retry);
      clearInterval(pulse);
      clearInterval(clock);
    };
  }, [stream, videoId, enrollmentId, playing, sequence]);

  const limitedStream = watch?.remaining_ms != null ? stream : undefined;
  const settleMediaFailure = useCallback(async (reason: string) => {
    const generation = ++failureGeneration.current;
    let message = reason;
    if (limitedStream) {
      try {
        // The last denied fragment can reach the player before its next usage heartbeat.
        const final = await reportReviewWatch(videoId, enrollmentId, limitedStream, ++sequence.value, false, positionRef.current);
        if (final.remaining_ms === 0) message = REVIEW_EXHAUSTED;
      } catch {
        // Keep the player's recovery action if the server cannot confirm exhaustion.
      }
    }
    if (generation === failureGeneration.current) stopRef.current(message);
  }, [limitedStream, videoId, enrollmentId, sequence]);

  return { remaining, reconnecting, settleMediaFailure };
}
