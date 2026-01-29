interface Props {
  event: any;
  onClose: () => void;
}

export default function EventDetailModal({ event, onClose }: Props) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[800px] max-h-[80vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="font-semibold">이벤트 상세</div>
          <button onClick={onClose} className="text-sm border px-3 py-1 rounded">
            닫기
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <Section title="기본 정보" data={{
            event_type: event.event_type,
            violated: event.violated,
            violation_reason: event.violation_reason,
            occurred_at: event.occurred_at,
            session_id: event.session_id,
          }} />

          <Section title="Payload" data={event.event_payload} />
          <Section title="Policy Snapshot" data={event.policy_snapshot} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, data }: { title: string; data: any }) {
  return (
    <div>
      <div className="font-medium mb-1">{title}</div>
      <pre className="bg-gray-100 rounded p-3 text-xs overflow-auto">
        {JSON.stringify(data || {}, null, 2)}
      </pre>
    </div>
  );
}
