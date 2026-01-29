// src/features/lectures/pages/sessions/LectureSessionsPage.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchSessions } from "../../api/sessions";
import SessionCreateModal from "../../components/SessionCreateModal";

export default function LectureSessionsPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lecId = Number(lectureId);

  const [open, setOpen] = useState(false);

  const { data: sessions = [] } = useQuery({
    queryKey: ["lecture-sessions", lecId],
    queryFn: () => fetchSessions(lecId),
    enabled: Number.isFinite(lecId),
  });

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-between">
        <h2 className="text-xl font-semibold">차시 목록</h2>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => setOpen(true)}
        >
          + 차시 추가
        </button>
      </div>

      <div className="space-y-2">
        {sessions.map((s: any) => (
          <Link
            key={s.id}
            to={`${s.id}`}   // ✅ 상대경로
            className="flex justify-between rounded border bg-gray-50 px-4 py-3 hover:bg-gray-100"
          >
            <div>
              <div className="text-lg font-semibold">
                {s.order}차시 - {s.title}
              </div>
              {s.date && (
                <div className="text-sm text-gray-600">{s.date}</div>
              )}
            </div>
            <div className="text-sm text-gray-500">ID: {s.id}</div>
          </Link>
        ))}
      </div>

      {open && (
        <SessionCreateModal
          lectureId={lecId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
