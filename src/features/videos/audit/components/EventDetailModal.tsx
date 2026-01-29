// PATH: src/features/videos/audit/components/EventDetailModal.tsx

interface Props {
  event: any;
  onClose: () => void;
}

export default function EventDetailModal({ event, onClose }: Props) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-[800px] max-h-[80vh] overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-xl">
        {/* ✅ header = 텍스트 블록 */}
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                이벤트 상세
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                재생 이벤트 원본 데이터 / 정책 스냅샷
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
            >
              닫기
            </button>
          </div>
        </div>

        {/* ✅ body = surface */}
        <div className="px-5 pb-5">
          <div className="bg-[var(--bg-surface-soft)] rounded-lg p-4 space-y-4 text-sm overflow-auto max-h-[70vh]">
            <Section
              title="기본 정보"
              data={{
                event_type: event.event_type,
                violated: event.violated,
                violation_reason: event.violation_reason,
                occurred_at: event.occurred_at,
                session_id: event.session_id,
              }}
            />

            <Section title="Payload" data={event.event_payload} />
            <Section title="Policy Snapshot" data={event.policy_snapshot} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, data }: { title: string; data: any }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </div>
      <pre className="bg-[var(--bg-app)] rounded p-3 text-xs overflow-auto whitespace-pre-wrap text-[var(--text-secondary)]">
        {JSON.stringify(data || {}, null, 2)}
      </pre>
    </div>
  );
}
