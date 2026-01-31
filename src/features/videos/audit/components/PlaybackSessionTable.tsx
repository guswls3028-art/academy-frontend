// PATH: src/features/videos/audit/components/PlaybackSessionTable.tsx

type PlaybackSession = {
  id: number;
  student_name: string;
  device_id: string;
  started_at: string;
  ended_at?: string | null;
  status: string;
};

type Props = {
  sessions: PlaybackSession[];
  selectedSessionId?: number | null;
  onSelect: (sessionId: number) => void;
};

export default function PlaybackSessionTable({
  sessions,
  selectedSessionId,
  onSelect,
}: Props) {
  if (!sessions.length) {
    return (
      <div className="text-sm text-[var(--text-muted)]">
        재생 세션이 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]">
          <tr>
            <th className="px-3 py-2 text-left">학생</th>
            <th className="px-3 py-2 text-left">기기</th>
            <th className="px-3 py-2 text-center">시작</th>
            <th className="px-3 py-2 text-center">종료</th>
            <th className="px-3 py-2 text-center">상태</th>
          </tr>
        </thead>

        <tbody>
          {sessions.map((s) => {
            const active = s.id === selectedSessionId;

            return (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`cursor-pointer border-t border-[var(--border-divider)] ${
                  active
                    ? "bg-[var(--bg-surface-soft)]"
                    : "hover:bg-[var(--bg-surface-soft)]"
                }`}
              >
                <td className="px-3 py-2 font-medium">{s.student_name}</td>
                <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                  {s.device_id}
                </td>
                <td className="px-3 py-2 text-center text-xs">
                  {s.started_at
                    ? new Date(s.started_at).toLocaleString("ko-KR")
                    : "-"}
                </td>
                <td className="px-3 py-2 text-center text-xs">
                  {s.ended_at ? new Date(s.ended_at).toLocaleString("ko-KR") : "-"}
                </td>
                <td className="px-3 py-2 text-center text-xs">{s.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
