import { PLAYBACK_EVENT_LABELS } from "../utils/eventLabels";
import { isAnomalyEvent } from "../utils/anomaly";

type PlaybackEvent = {
  id?: number;
  type: string;
  occurred_at?: number; // epoch seconds
  payload?: Record<string, any>;
};

type Props = {
  events: PlaybackEvent[];
};

export default function PlaybackEventTimeline({ events }: Props) {
  if (!events.length) {
    return (
      <div className="text-sm text-gray-500">
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
            className={`flex items-start gap-3 border-b pb-2 text-sm ${
              anomaly ? "bg-red-50" : ""
            }`}
          >
            {/* TIME */}
            <div className="w-20 shrink-0 text-gray-500">
              {e.occurred_at
                ? new Date(e.occurred_at * 1000).toLocaleTimeString("ko-KR")
                : "-"}
            </div>

            {/* EVENT */}
            <div className="flex-1">
              <div
                className={`font-medium ${
                  anomaly ? "text-red-600" : "text-gray-800"
                }`}
              >
                {label}
              </div>

              {/* PAYLOAD (audit 핵심) */}
              {e.payload && (
                <pre className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 overflow-x-auto">
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
