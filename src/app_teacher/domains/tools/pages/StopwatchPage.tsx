// PATH: src/app_teacher/domains/tools/pages/StopwatchPage.tsx
// 모바일 스톱워치 — 내장 타이머 + PC 타이머 exe 다운로드 옵션
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { Download } from "@teacher/shared/ui/Icons";
import { fetchTimerDownloadUrl } from "@admin/domains/tools/stopwatch/api/timer.api";

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
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      setElapsed(baseRef.current + (performance.now() - lastStartRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  const start = () => {
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
    const prevTotal = laps.length > 0 ? laps[laps.length - 1].total : 0;
    setLaps([...laps, { index: laps.length + 1, total, delta: total - prevTotal }]);
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
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>스톱워치</h1>
      </div>

      {/* 큰 시간 표시 */}
      <Card style={{ padding: "var(--tc-space-6)", textAlign: "center" }}>
        <div
          className="tabular-nums font-bold"
          style={{
            fontSize: "clamp(48px, 13vw, 72px)",
            lineHeight: 1.1,
            color: running ? "var(--tc-primary)" : "var(--tc-text)",
            letterSpacing: "-0.03em",
          }}
        >
          {formatElapsed(elapsed)}
        </div>
        <div className="text-[12px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
          {running ? "진행 중" : elapsed > 0 ? "일시정지" : "대기"}
        </div>
      </Card>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        {!running ? (
          <button
            onClick={start}
            className="text-base font-bold cursor-pointer"
            style={{
              padding: "18px",
              minHeight: 56,
              borderRadius: "var(--tc-radius)",
              border: "none",
              background: "var(--tc-primary)",
              color: "#fff",
            }}
          >
            {elapsed > 0 ? "재개" : "시작"}
          </button>
        ) : (
          <button
            onClick={stop}
            className="text-base font-bold cursor-pointer"
            style={{
              padding: "18px",
              minHeight: 56,
              borderRadius: "var(--tc-radius)",
              border: "none",
              background: "var(--tc-danger)",
              color: "#fff",
            }}
          >
            정지
          </button>
        )}
        <button
          onClick={running ? lap : reset}
          disabled={!running && elapsed === 0}
          className="text-base font-bold cursor-pointer disabled:opacity-50"
          style={{
            padding: "18px",
            minHeight: 56,
            borderRadius: "var(--tc-radius)",
            border: "1px solid var(--tc-border-strong)",
            background: "var(--tc-surface)",
            color: "var(--tc-text)",
          }}
        >
          {running ? "랩" : "리셋"}
        </button>
      </div>

      {/* Laps */}
      {laps.length > 0 && (
        <>
          <SectionTitle>랩 ({laps.length})</SectionTitle>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {[...laps].reverse().map((l, i, arr) => (
              <div
                key={l.index}
                className="flex justify-between items-center"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--tc-border)" : "none",
                }}
              >
                <span className="text-[13px]" style={{ color: "var(--tc-text)" }}>랩 {l.index}</span>
                <div className="text-right">
                  <div className="text-[13px] font-bold tabular-nums" style={{ color: "var(--tc-text)" }}>
                    {formatElapsed(l.delta)}
                  </div>
                  <div className="text-[11px] tabular-nums" style={{ color: "var(--tc-text-muted)" }}>
                    합계 {formatElapsed(l.total)}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* PC 타이머 다운로드 */}
      <SectionTitle>PC 타이머</SectionTitle>
      <Card>
        <div className="text-[12px] leading-relaxed mb-2" style={{ color: "var(--tc-text-muted)" }}>
          학원 전용 PC 타이머(.exe)를 다운로드합니다. 테넌트 브랜딩이 적용된 큰 화면 타이머입니다.
        </div>
        <button
          onClick={handleDownloadExe}
          className="flex items-center justify-center gap-2 w-full text-sm font-semibold cursor-pointer"
          style={{
            padding: "12px",
            minHeight: "var(--tc-touch-min)",
            borderRadius: "var(--tc-radius)",
            border: "1px solid var(--tc-border-strong)",
            background: "var(--tc-surface)",
            color: "var(--tc-text)",
          }}
        >
          <Download size={14} /> PC 타이머 (.exe) 받기
        </button>
      </Card>
    </div>
  );
}
