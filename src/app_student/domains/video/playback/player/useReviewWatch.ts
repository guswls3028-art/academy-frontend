import { useEffect, useRef, useState } from "react";
import { reportReviewWatch, type ReviewWatch } from "../../api/video.api";

export function useReviewWatch(
  videoId: number, enrollmentId: number | null, watch: ReviewWatch | null | undefined,
  playing: boolean, stop: (reason: string) => void,
) {
  const stream = watch?.stream;
  const sequence = useRef({ value: 0 }).current;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const budget = useRef<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(watch?.remaining_ms ?? null);

  useEffect(() => {
    budget.current = watch?.remaining_ms ?? null;
    setRemaining(budget.current);
    if (!stream) return;
    return () => {
      void reportReviewWatch(videoId, enrollmentId, stream, ++sequence.value, false).catch(() => {
        // Abrupt disconnects are bounded by the server's active-signal timeout.
      });
    };
  }, [stream, videoId, enrollmentId, sequence, watch?.remaining_ms]);

  useEffect(() => {
    if (!stream) return;
    let live = true;
    let busy = false;
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
        const sentAt = performance.now();
        const data = await reportReviewWatch(videoId, enrollmentId, stream, ++sequence.value, playing);
        if (!live) return;
        lastAck = performance.now();
        if (data.remaining_ms === 0) {
          fail("이 영상의 복습 시청시간을 모두 사용했습니다.");
        } else {
          startDeadline(data.remaining_ms === null ? null :
            Math.max(0, data.remaining_ms - (playing ? lastAck - sentAt : 0)));
        }
      } catch (error) {
        if (budget.current !== null) {
          const detail = (error as {response?: {data?: {detail?: string}}}).response?.data?.detail;
          fail(detail || "복습 시청시간을 저장하지 못했습니다. 연결을 확인하고 다시 열어 주세요.");
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
      if (ms === 0) fail("이 영상의 복습 시청시간을 모두 사용했습니다.");
      else if (performance.now() - lastAck > 15000) fail("연결을 확인하고 영상을 다시 열어 주세요.");
    }, 200) : undefined;
    return () => {
      live = false;
      if (deadline !== null) budget.current = Math.max(0, deadline - performance.now());
      clearInterval(pulse);
      clearInterval(clock);
    };
  }, [stream, videoId, enrollmentId, playing, sequence]);

  return remaining;
}
