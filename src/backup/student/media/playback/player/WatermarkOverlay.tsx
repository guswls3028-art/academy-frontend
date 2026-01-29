// src/features/media/playback/player/WatermarkOverlay.tsx

import { useMemo } from "react";

type Props = {
  enabled: boolean;
  text?: string;
  sessionId?: string | null;
};

export default function WatermarkOverlay({ enabled, text, sessionId }: Props) {
  const label = useMemo(() => {
    const base = (text?.trim() || "무단 배포 금지").trim();
    const sid = sessionId ? ` · ${sessionId.slice(0, 8)}` : "";
    return `${base}${sid}`;
  }, [sessionId, text]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded bg-black/20 px-3 py-1 text-xs font-bold text-white/40">
          {label}
        </div>
      </div>
    </div>
  );
}
