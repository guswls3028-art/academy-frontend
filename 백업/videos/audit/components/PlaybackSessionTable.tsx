type PlaybackSession = {
  id: number;
  student_name: string;
  device_id: string;
  started_at: string; // ISO
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
      <div className="text-sm text-gray-500">
        재생 세션이 없습니다.
      </div>
    );
  }

  return (
    <div className="border rounded bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left">학생</th>
            <th className="px-3 py-2 text-left">기기</th>
            <th className="px-3 py-2">시작</th>
            <th className="px-3 py-2">종료</th>
            <th className="px-3 py-2">상태</th>
          </tr>
        </thead>

        <tbody>
          {sessions.map((s) => {
            const active = s.id === selectedSessionId;

            return (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`cursor-pointer border-t ${
                  active
                    ? "bg-blue-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <td className="px-3 py-2 font-medium">
                  {s.student_name}
                </td>

                <td className="px-3 py-2 text-xs text-gray-600">
                  {s.device_id}
                </td>

                <td className="px-3 py-2 text-center text-xs">
                  {new Date(s.started_at).toLocaleString("ko-KR")}
                </td>

                <td className="px-3 py-2 text-center text-xs">
                  {s.ended_at
                    ? new Date(s.ended_at).toLocaleString("ko-KR")
                    : "-"}
                </td>

                <td className="px-3 py-2 text-center">
                  <span className="rounded bg-
