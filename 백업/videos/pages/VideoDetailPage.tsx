// src/features/videos/pages/VideoDetailPage.tsx

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import PermissionModal from "@/features/videos/components/permission/PermissionModal";
import VideoPreviewSection from "./sections/VideoPreviewSection";
import VideoPolicySection from "./sections/VideoPolicySection";
import VideoInfoSection from "./sections/VideoInfoSection";
import VideoStudentsSection from "./sections/VideoStudentsSection";

type PreviewMode = "admin" | "student";

export default function VideoDetailPage() {
  const params = useParams();
  const lectureId = Number(params.lectureId);
  const sessionId = Number(params.sessionId);
  const videoId = Number(params.videoId);

  const [previewMode, setPreviewMode] = useState<PreviewMode>("admin");
  const [openPermission, setOpenPermission] = useState(false);
  const [memo, setMemo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["video-stats", videoId],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/stats/`);
      return res.data;
    },
    enabled: !!videoId,
  });

  if (isLoading || !data?.video) {
    return <div className="text-sm">로딩중…</div>;
  }

  const video = data.video;
  const students = data.students ?? [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{video.title}</h2>

        <Link
          to={`/admin/lectures/${lectureId}/sessions/${sessionId}`}
          className="rounded border px-3 py-1.5 text-sm"
        >
          출석 화면으로
        </Link>
      </div>

      <div className="mt-6 flex gap-6">
        <div className="w-[720px] space-y-4">
          <VideoPreviewSection
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            hlsSrc={video.hls_url}
          />

          <VideoPolicySection
            videoId={videoId}
            initial={{
              allow_skip: video.allow_skip,
              max_speed: video.max_speed,
              show_watermark: video.show_watermark,
            }}
          />

          <VideoInfoSection
            video={video}
            memo={memo}
            setMemo={setMemo}
          />
        </div>

        <VideoStudentsSection
          students={students}
          onOpenPermission={() => setOpenPermission(true)}
        />
      </div>

      <PermissionModal
        open={openPermission}
        onClose={() => setOpenPermission(false)}
        videoId={videoId}
      />
    </>
  );
}
