// src/features/lectures/components/JsonViewerModal.tsx

import { useMemo } from "react";

interface Props {
  open: boolean;
  title: string;
  payload: any;
  snapshot: any;
  onClose: () => void;
}

export default function JsonViewerModal({ open, title, payload, snapshot, onClose }: Props) {
  const prettyPayload = useMemo(() => JSON.stringify(payload ?? {}, null, 2), [payload]);
  const prettySnap = useMemo(() => JSON.stringify(snapshot ?? {}, null, 2), [snapshot]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[400]">
      <div className="w-[900px] h-[600px] bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b flex items-center justify-between bg-gray-50">
          <div className="font-semibold text-sm">{title}</div>
          <button className="text-xs px-3 py-1 border rounded bg-white" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-0">
          <div className="border-r flex flex-col">
            <div className="px-3 py-2 text-xs font-semibold border-b bg-gray-50">event_payload</div>
            <pre className="flex-1 p-3 text-[12px] overflow-auto whitespace-pre-wrap">
              {prettyPayload}
            </pre>
          </div>

          <div className="flex flex-col">
            <div className="px-3 py-2 text-xs font-semibold border-b bg-gray-50">policy_snapshot</div>
            <pre className="flex-1 p-3 text-[12px] overflow-auto whitespace-pre-wrap">
              {prettySnap}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
