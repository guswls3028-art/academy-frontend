// PATH: src/features/videos/components/features/video-analytics/JsonViewerModal.tsx

import { useMemo } from "react";

interface Props {
  open: boolean;
  title: string;
  payload: any;
  snapshot: any;
  onClose: () => void;
}

export default function JsonViewerModal({
  open,
  title,
  payload,
  snapshot,
  onClose,
}: Props) {
  const prettyPayload = useMemo(
    () => JSON.stringify(payload ?? {}, null, 2),
    [payload]
  );
  const prettySnap = useMemo(
    () => JSON.stringify(snapshot ?? {}, null, 2),
    [snapshot]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[400] p-4">
      <div className="w-[900px] h-[600px] rounded-xl bg-[var(--bg-surface)] shadow-xl overflow-hidden flex flex-col">
        {/* ✅ header = 텍스트 블록 */}
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {title}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                event_payload / policy_snapshot 비교
              </div>
            </div>

            <button
              className="shrink-0 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>

        {/* ✅ body = surface */}
        <div className="px-5 pb-5 flex-1 min-h-0">
          <div className="bg-[var(--bg-surface-soft)] rounded-lg p-4 h-full min-h-0">
            <div className="h-full grid grid-cols-2 gap-3 min-h-0">
              <div className="rounded-lg bg-[var(--bg-surface)] overflow-hidden flex flex-col min-h-0">
                <div className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                  event_payload
                </div>
                <pre className="flex-1 p-3 text-[12px] overflow-auto whitespace-pre-wrap text-[var(--text-secondary)] bg-[var(--bg-app)]">
                  {prettyPayload}
                </pre>
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] overflow-hidden flex flex-col min-h-0">
                <div className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                  policy_snapshot
                </div>
                <pre className="flex-1 p-3 text-[12px] overflow-auto whitespace-pre-wrap text-[var(--text-secondary)] bg-[var(--bg-app)]">
                  {prettySnap}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
