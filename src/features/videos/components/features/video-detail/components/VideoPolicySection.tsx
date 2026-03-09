// PATH: src/features/videos/components/features/video-detail/components/VideoPolicySection.tsx

import ToggleSwitch from "@/features/videos/ui/ToggleSwitch";
import { useVideoPolicy } from "@/features/videos/hooks/useVideoPolicy";

interface Props {
  videoId: number;
  initial: {
    allow_skip: boolean;
    max_speed: number;
    show_watermark: boolean;
  };
}

export default function VideoPolicySection({ videoId, initial }: Props) {
  const { policy, canSave, setAllowSkip, setMaxSpeed, setShowWatermark, save } =
    useVideoPolicy({
      videoId,
      initial,
    } as any);

  return (
    <div className="space-y-4">
      {/* POLICY CONTROLS */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--color-bg-surface-soft)" }}
      >
        <div
          className="flex flex-wrap items-center gap-5 text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>워터마크</span>
            <ToggleSwitch checked={policy.show_watermark} onChange={setShowWatermark} />
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>건너뛰기 허용</span>
            <ToggleSwitch checked={policy.allow_skip} onChange={setAllowSkip} />
          </label>

          <label className="flex items-center gap-2 select-none">
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>최대 배속</span>
            <input
              type="number"
              step={0.25}
              min={0.25}
              max={5}
              value={policy.max_speed}
              onChange={(e) => setMaxSpeed(Number(e.target.value))}
              className="w-16 rounded border px-2 py-1 text-xs"
              style={{
                borderColor: "var(--color-border-divider)",
                background: "var(--color-bg-app)",
                color: "var(--color-text-primary)",
              }}
            />
            <span style={{ color: "var(--color-text-muted)", minWidth: 36 }}>
              {policy.max_speed.toFixed(2)}x
            </span>
          </label>

          <button
            onClick={() => save()}
            disabled={!canSave}
            className="ml-auto rounded px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ background: "var(--color-primary)" }}
            type="button"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
