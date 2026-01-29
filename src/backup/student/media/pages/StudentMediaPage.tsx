// src/student/media/pages/StudentMediaPage.tsx
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStudentSessionVideos } from "@/student/media/playback/api/media";

export default function StudentMediaPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const sessionParam = params.get("session");
  const sessionId = sessionParam ? Number(sessionParam) : null;

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["student-session-videos", sessionId],
    queryFn: () => fetchStudentSessionVideos(sessionId as number),
    enabled: !!sessionId, // ✅ 여기서만 제어
  });

  if (!sessionId) {
    return (
      <div className="p-4 text-gray-500">
        session id가 필요합니다.<br />
        예: <code>/student/media?session=1</code>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4">로딩중...</div>;
  }

  return (
    <div className="space-y-3 p-4">
      {videos.length === 0 && (
        <div className="text-gray-500">재생 가능한 영상이 없습니다.</div>
      )}

      {videos.map((v) => (
        <div
          key={v.id}
          className="border rounded p-4 flex justify-between items-center"
        >
          <div>
            <div className="font-semibold">{v.title}</div>
            <div className="text-xs text-gray-500">
              {v.duration ? `${v.duration}s` : "-"}
            </div>
          </div>

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => nav(`/student/media/videos/${v.id}`)}
          >
            시청하기
          </button>
        </div>
      ))}
    </div>
  );
}
