// PATH: src/features/videos/pages/VideoDetailPage.tsx

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import VideoDetailLayout from "./VideoDetailLayout";
import { styles } from "./VideoDetail.styles";

import PermissionModal from "@/features/videos/components/features/video-detail/modals/PermissionModal";
import VideoPreviewSection from "@/features/videos/components/features/video-detail/components/VideoPreviewSection";
import VideoPolicySection from "@/features/videos/components/features/video-detail/components/VideoPolicySection";
import VideoInfoSection from "@/features/videos/components/features/video-detail/components/VideoInfoSection";
import VideoStudentsSection from "@/features/videos/components/features/video-detail/components/VideoStudentsSection";

type PreviewMode = "admin" | "student";

export default function VideoDetailPage() {
  const params = useParams();
  const lectureId = Number(params.lectureId);
  const sessionId = Number(params.sessionId);
  const videoId = Number(params.videoId);

  const [previewMode, setPreviewMode] =
    useState<PreviewMode>("admin");
  const [openPermission, setOpenPermission] =
    useState(false);
  const [memo, setMemo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["video-stats", videoId],
    queryFn: async () => {
      const res = await api.get(
        `/media/videos/${videoId}/stats/`
      );
      return res.data;
    },
    enabled: !!videoId,
  });

  if (isLoading || !data?.video) {
    return (
      <div className="text-sm text-[var(--text-muted)]">
        로딩중…
      </div>
    );
  }

  const video = data.video;
  const students = data.students ?? [];

  return (
    <>
      <VideoDetailLayout
        header={
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={styles.header.title}>
                {video.title}
              </h2>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                세션 영상 관리 · 정책 / 시청 / 로그
              </div>
            </div>

            <div className={styles.header.actions}>
              <Link
                to={`/admin/lectures/${lectureId}/sessions/${sessionId}`}
                className={styles.header.backLink}
              >
                출석 화면으로
              </Link>
            </div>
          </div>
        }
        subtitle={
          <span>
            이 영상에 대한 시청 정책, 학생
            상태, 로그 데이터를 관리합니다.
          </span>
        }
        left={
          <>
            <section className={styles.section.wrapper}>
              <div className={styles.section.header}>
                영상 미리보기
              </div>
              <div className={styles.section.body}>
                <VideoPreviewSection
                  previewMode={previewMode}
                  setPreviewMode={setPreviewMode}
                  hlsSrc={video.hls_url}
                />
              </div>
            </section>

            <section className={styles.section.wrapper}>
              <div className={styles.section.header}>
                학생 시청 정책
              </div>
              <div className={styles.section.body}>
                <VideoPolicySection
                  videoId={videoId}
                  initial={{
                    allow_skip: video.allow_skip,
                    max_speed: video.max_speed,
                    show_watermark: video.show_watermark,
                  }}
                />
              </div>
            </section>

            <section className={styles.section.wrapper}>
              <div className={styles.section.header}>
                영상 정보
              </div>
              <div className={styles.section.body}>
                <VideoInfoSection
                  video={video}
                  memo={memo}
                  setMemo={setMemo}
                />
              </div>
            </section>
          </>
        }
        right={
          <section className={styles.section.wrapper}>
            <div className={styles.section.header}>
              학생 시청 현황
            </div>
            <div className={styles.section.body}>
              <VideoStudentsSection
                students={students}
                onOpenPermission={() =>
                  setOpenPermission(true)
                }
              />
            </div>
          </section>
        }
      />

      <PermissionModal
        open={openPermission}
        onClose={() => setOpenPermission(false)}
        videoId={videoId}
      />
    </>
  );
}
