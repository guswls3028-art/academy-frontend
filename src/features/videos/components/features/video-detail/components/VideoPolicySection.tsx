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
      <div className="bg-[var(--bg-surface-soft)] rounded-lg p-4">
        <div className="flex items-center gap-6 text-xs text-[var(--text-secondary)]">
          <label className="flex items-center gap-2">
            워터마크
            <ToggleSwitch checked={policy.show_watermark} onChange={setShowWatermark} />
          </label>

          <label className="flex items-center gap-2">
            건너뛰기
            <ToggleSwitch checked={policy.allow_skip} onChange={setAllowSkip} />
          </label>

          <label className="flex items-center gap-2">
            최대 배속
            <input
              type="number"
              step={0.25}
              min={0.25}
              max={5}
              value={policy.max_speed}
              onChange={(e) => setMaxSpeed(Number(e.target.value))}
              className="w-20 rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-2 py-1 text-xs text-[var(--text-primary)]"
            />
            {policy.max_speed.toFixed(2)}x
          </label>

          <button
            onClick={() => save()}
            disabled={!canSave}
            className="ml-auto rounded bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            type="button"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
