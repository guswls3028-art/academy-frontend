// src/features/lectures/components/AdminVideoPolicyPanel.tsx

import { useState } from "react";

interface Props {
  videoId: number;
  onChange?: () => void;
}

interface Policy {
  max_speed: number;
  allow_skip: boolean;
}

export default function AdminVideoPolicyPanel({ videoId, onChange }: Props) {
  // --------------------------------------------------
  // LOAD INITIAL POLICY
  // --------------------------------------------------
  const initial: Policy = (() => {
    const raw = localStorage.getItem(`video_policy_${videoId}`);

    if (!raw) {
      return { max_speed: 1.0, allow_skip: false };
    }

    try {
      const parsed = JSON.parse(raw);

      return {
        max_speed:
          typeof parsed.max_speed === "number" ? parsed.max_speed : 1.0,
        allow_skip: Boolean(parsed.allow_skip),
      };
    } catch {
      return { max_speed: 1.0, allow_skip: false };
    }
  })();

  const [policy, setPolicy] = useState<Policy>(initial);

  // --------------------------------------------------
  // SAVE POLICY
  // --------------------------------------------------
  const savePolicy = () => {
    localStorage.setItem(
      `video_policy_${videoId}`,
      JSON.stringify(policy)
    );

    alert("정책이 저장되었습니다.");
    if (onChange) onChange();
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="space-y-4 rounded border bg-white p-4 text-sm shadow-sm">
      <div className="text-base font-semibold">영상 시청 정책</div>

      {/* MAX SPEED */}
      <div className="flex items-center gap-2">
        <label className="w-28">최대 속도</label>
        <input
          type="number"
          step="0.05"
          min={0.25}
          max={5}
          className="w-24 rounded border px-2 py-1"
          value={policy.max_speed}
          onChange={(e) =>
            setPolicy((p) => ({
              ...p,
              max_speed: parseFloat(e.target.value),
            }))
          }
        />
      </div>

      {/* SKIP CONTROL */}
      <div className="flex items-center gap-2">
        <label className="w-28">건너뛰기 허용</label>
        <input
          type="checkbox"
          checked={policy.allow_skip}
          onChange={(e) =>
            setPolicy((p) => ({
              ...p,
              allow_skip: e.target.checked,
            }))
          }
        />
      </div>

      {/* SAVE BUTTON */}
      <button
        onClick={savePolicy}
        className="rounded bg-blue-600 px-3 py-1 text-xs text-white"
      >
        저장
      </button>
    </div>
  );
}
