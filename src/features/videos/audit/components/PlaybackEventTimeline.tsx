// PATH: src/features/videos/audit/components/PlaybackEventTimeline.tsx

import { PLAYBACK_EVENT_LABELS } from "../utils/eventLabels";
import { isAnomalyEvent } from "../utils/anomaly";

type PlaybackEvent = {
  id?: number;
  type: string;
  occurred_at?: number;
  payload?: Record<string, any>;
};

type Props = {
  events: PlaybackEvent[];
};

export default function PlaybackEventTimeline({ events }: Props) {
  if (!events.length) {
    return (
      <div className="text-sm text-[var(--text-muted)]">
        기록된 이벤트가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((e, idx) => {
        const label = PLAYBACK_EVENT_LABELS[e.type] ?? e.type;
        const anomaly = isAnomalyEvent(e.type);

        return (
          <div
            key={e.id ?? idx}
            className={`flex items-start gap-3 border-b border-[var(--border-divider)] pb-2 text-sm ${
              anomaly ? "bg-red-50" : ""
            }`}
          >
            <div className="w-20 shrink-0 text-[var(--text-muted)]">
              {e.occurred_at
                ? new Date(e.occurred_at * 1000).toLocaleTimeString("ko-KR")
                : "-"}
            </div>

            <div className="flex-1">
              <div
                className={`font-medium ${
                  anomaly ? "text-red-600" : "text-[var(--text-primary)]"
                }`}
              >
                {label}
              </div>

              {e.payload && (
                <pre className="mt-1 rounded bg-[var(--bg-surface-soft)] px-2 py-1 text-xs text-[var(--text-secondary)] overflow-x-auto">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
