// PATH: src/features/videos/pages/VideoIdToSessionRedirect.tsx
// /admin/videos/:videoId 직접 접근 시 해당 영상이 있는 강의-차시-영상 탭으로 리다이렉트

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchVideoDetail } from "../api/videos";
import { fetchSession } from "@/features/lectures/api/sessions";

export default function VideoIdToSessionRedirect() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = Number(videoId);
    if (!Number.isFinite(id)) {
      navigate("/admin/videos", { replace: true });
      setDone(true);
      return;
    }
    fetchVideoDetail(id)
      .then((video) => fetchSession(video.session_id))
      .then((session) => {
        navigate(
          `/admin/lectures/${session.lecture}/sessions/${session.id}/videos`,
          { replace: true }
        );
      })
      .catch(() => {
        navigate("/admin/videos", { replace: true });
      })
      .finally(() => setDone(true));
  }, [videoId, navigate]);

  if (!done) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          color: "var(--color-text-secondary)",
          fontSize: 14,
        }}
      >
        이동 중…
      </div>
    );
  }
  return null;
}
