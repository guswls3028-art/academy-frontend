// PATH: src/app_admin/domains/videos/components/features/video-detail/components/VideoPolicySection.tsx

import { useEffect, useState } from "react";
import ToggleSwitch from "@admin/domains/videos/ui/ToggleSwitch";
import { useVideoPolicy } from "@admin/domains/videos/hooks/useVideoPolicy";
import type { VideoPolicy } from "@admin/domains/videos/hooks/useVideoPolicy";
import { Button } from "@/shared/ui/ds";
import "./VideoPolicySection.css";

interface Props {
  videoId: number;
  initial: VideoPolicy;
}

export default function VideoPolicySection({ videoId, initial }: Props) {
  const { policy, canSave, setAllowSkip, setMaxSpeed, setShowWatermark, save } =
    useVideoPolicy({
      videoId,
      initial,
    });
  const [maxSpeedInput, setMaxSpeedInput] = useState(String(policy.max_speed));

  useEffect(() => {
    setMaxSpeedInput(String(policy.max_speed));
  }, [policy.max_speed]);

  return (
    <div className="space-y-4">
      {/* POLICY CONTROLS */}
      <div className="video-policy-panel">
        <div className="video-policy-controls">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="video-policy-label">워터마크</span>
            <ToggleSwitch checked={policy.show_watermark} onChange={setShowWatermark} />
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="video-policy-label">건너뛰기 허용</span>
            <ToggleSwitch checked={policy.allow_skip} onChange={setAllowSkip} />
          </label>

          <label className="flex items-center gap-2 select-none">
            <span className="video-policy-label">최대 배속</span>
            <input
              type="number"
              step={0.25}
              min={0.25}
              max={5}
              value={maxSpeedInput}
              onChange={(e) => {
                const nextValue = e.target.value;
                setMaxSpeedInput(nextValue);
                if (nextValue === "" || nextValue.endsWith(".")) return;
                const parsed = Number(nextValue);
                if (Number.isFinite(parsed)) setMaxSpeed(parsed);
              }}
              onBlur={() => {
                const parsed = Number(maxSpeedInput);
                if (!Number.isFinite(parsed) || maxSpeedInput === "") {
                  setMaxSpeedInput(String(policy.max_speed));
                  return;
                }
                const normalized = Math.min(5, Math.max(0.25, parsed));
                setMaxSpeedInput(String(normalized));
                setMaxSpeed(normalized);
              }}
              className="video-policy-input"
            />
            <span className="video-policy-speed">
              {policy.max_speed.toFixed(2)}x
            </span>
          </label>

          <Button
            intent="primary"
            size="sm"
            onClick={() => save()}
            disabled={!canSave}
            className="ml-auto"
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
