// PATH: src/app_teacher/domains/tools/pages/StopwatchPage.tsx
// 모바일 스톱워치 — 내장 타이머 + PC 타이머 exe 다운로드 옵션
import { useEffect, useRef, useState } from "react";
import { ICON } from "@/shared/ui/ds";
import { cx } from "@/shared/utils/cx";
import { useNavigate } from "react-router-dom";
import { SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { Download } from "@teacher/shared/ui/Icons";
import { fetchTimerDownloadUrl } from "@/shared/api/contracts/tools";
import styles from "./StopwatchPage.module.css";

const TIMER_TICK_MS = 30;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const hh = h > 0 ? `${String(h).padStart(2, "0")}:` : "";
  return `${hh}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

type Lap = { index: number; total: number; delta: number };

export default function StopwatchPage() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const lastStartRef = useRef<number>(0);
  const baseRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      setElapsed(baseRef.current + (performance.now() - lastStartRef.current));
    };
    tick();
    const intervalId = window.setInterval(tick, TIMER_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [running]);

  const start = () => {
    if (running) return;
    lastStartRef.current = performance.now();
    setRunning(true);
  };
  const stop = () => {
    if (!running) return;
    baseRef.current += performance.now() - lastStartRef.current;
    setElapsed(baseRef.current);
    setRunning(false);
  };
  const reset = () => {
    baseRef.current = 0;
    lastStartRef.current = performance.now();
    setElapsed(0);
    setLaps([]);
  };
  const lap = () => {
    const total = running ? baseRef.current + (performance.now() - lastStartRef.current) : baseRef.current;
    setLaps((prevLaps) => {
      const prevTotal = prevLaps.length > 0 ? prevLaps[prevLaps.length - 1].total : 0;
      return [...prevLaps, { index: prevLaps.length + 1, total, delta: total - prevTotal }];
    });
  };

  const handleDownloadExe = async () => {
    try {
      const { download_url, filename } = await fetchTimerDownloadUrl();
      const a = document.createElement("a");
      a.href = download_url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      teacherToast.success("PC 타이머 다운로드 시작");
    } catch {
      teacherToast.error("PC 타이머가 준비되지 않았습니다.");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <BackButton onClick={() => navigate(-1)} />
        <h1 className={styles.title}>타이머</h1>
      </div>

      {/* 큰 시간 표시 */}
      <section className={styles.timeCard}>
        <div
          className={cx(styles.timeDisplay, running && styles.timeDisplayRunning)}
        >
          {formatElapsed(elapsed)}
        </div>
        <div className={styles.statusLabel}>
          {running ? "진행 중" : elapsed > 0 ? "일시정지" : "대기"}
        </div>
      </section>

      {/* Controls */}
      <div className={styles.controls}>
        {!running ? (
          <button
            type="button"
            onClick={start}
            className={cx(styles.controlButton, styles.startButton)}
          >
            {elapsed > 0 ? "재개" : "시작"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className={cx(styles.controlButton, styles.stopButton)}
          >
            정지
          </button>
        )}
        <button
          type="button"
          onClick={running ? lap : reset}
          disabled={!running && elapsed === 0}
          className={cx(styles.controlButton, styles.secondaryButton)}
        >
          {running ? "랩" : "리셋"}
        </button>
      </div>

      {/* Laps */}
      {laps.length > 0 && (
        <>
          <SectionTitle>랩 ({laps.length})</SectionTitle>
          <section className={styles.lapCard}>
            {[...laps].reverse().map((l) => (
              <div
                key={l.index}
                className={styles.lapRow}
              >
                <span className={styles.lapLabel}>랩 {l.index}</span>
                <div className={styles.lapTimes}>
                  <div className={styles.lapDelta}>
                    {formatElapsed(l.delta)}
                  </div>
                  <div className={styles.lapTotal}>
                    합계 {formatElapsed(l.total)}
                  </div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {/* PC 타이머 다운로드 */}
      <SectionTitle>PC 타이머</SectionTitle>
      <section className={styles.pcCard}>
        <div className={styles.pcDescription}>
          학원 전용 PC 타이머(.exe)를 다운로드합니다. 테넌트 브랜딩이 적용된 큰 화면 타이머입니다.
        </div>
        <button
          type="button"
          onClick={handleDownloadExe}
          className={styles.downloadButton}
        >
          <Download size={ICON.xs} /> PC 타이머 (.exe) 받기
        </button>
      </section>
    </div>
  );
}
