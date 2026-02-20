// PATH: src/features/videos/pages/VideoDetailPage.tsx

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";

import VideoDetailLayout from "./VideoDetailLayout";
import { styles } from "./VideoDetail.styles";

import PermissionModal from "@/features/videos/components/features/video-detail/modals/PermissionModal";
import VideoPreviewSection from "@/features/videos/components/features/video-detail/components/VideoPreviewSection";
import VideoPolicySection from "@/features/videos/components/features/video-detail/components/VideoPolicySection";
import AdminMemoSection from "@/features/videos/components/features/video-detail/components/AdminMemoSection";
import VideoStudentsSection from "@/features/videos/components/features/video-detail/components/VideoStudentsSection";
import type { TabKey } from "@/features/videos/components/features/video-permission/permission.types";

type PreviewMode = "admin" | "student";

function formatBytes(b?: number) {
  return b ? `${(Number(b) / 1024 / 1024).toFixed(1)} MB` : "—";
}

export default function VideoDetailPage() {
  const params = useParams();
  const lectureId = Number(params.lectureId);
  const sessionId = Number(params.sessionId);
  const videoId = Number(params.videoId);

  const [previewMode, setPreviewMode] = useState<PreviewMode>("admin");
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [permissionTab, setPermissionTab] = useState<TabKey>("permission");
  const [memo, setMemo] = useState("");
  const qc = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/media/videos/${videoId}/retry/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-stats", videoId] });
      asyncStatusStore.addWorkerJob(
        video?.title ? `${video.title} 재처리` : `영상 ${videoId} 재처리`,
        String(videoId),
        "video_processing"
      );
      feedback.success("재처리 요청을 보냈습니다.");
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "재처리에 실패했습니다.";
      feedback.error(msg);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["video-stats", videoId],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/stats/`);
      return res.data;
    },
    enabled: !!videoId,
    retry: 1,
  });

  if (isLoading || !data?.video) {
    return <div className="text-sm text-[var(--color-text-muted)]">로딩중…</div>;
  }

  const video = data.video;
  const students = data.students ?? [];
  const total = students.length;
  const completed100 = students.filter((s) => (Number(s.progress ?? 0) || 0) >= 1).length;
  const progressSum = students.reduce((a, s) => a + (Number(s.progress ?? 0) || 0), 0);
  const avgProgress = total > 0 ? progressSum / total : 0;
  const completed90 = students.filter((s) => (Number(s.progress ?? 0) || 0) >= 0.9).length;

  const openModal = (tab: TabKey) => {
    setPermissionTab(tab);
    setPermissionOpen(true);
  };

  return (
    <>
      <VideoDetailLayout
        header={
          <>
            <div>
              <h1 className={styles.header.title}>{video.title}</h1>
              <p className={styles.header.subtitle}>
                세션 영상 관리 · 정책 / 시청 / 로그
              </p>
              <p className={styles.header.description}>
                이 영상에 대한 시청 정책, 학생 성과, 로그 데이터를 관리합니다.
              </p>
            </div>
            <div className={styles.header.actions}>
              <Link
                to={`/admin/lectures/${lectureId}/sessions/${sessionId}`}
                className={styles.header.primaryDropdown}
              >
                출석 화면으로
              </Link>
            </div>
          </>
        }
        left={
          <>
            <section className={styles.section.wrapper}>
              <div className={styles.section.header}>영상 미리보기</div>
              <div className={styles.section.body}>
                <VideoPreviewSection
                  previewMode={previewMode}
                  setPreviewMode={setPreviewMode}
                  hlsSrc={video.hls_url}
                  status={video.status}
                  progressPercent={null}
                  onRetry={
                    ["FAILED", "PROCESSING", "UPLOADED"].includes(video.status)
                      ? () => retryMutation.mutate()
                      : undefined
                  }
                  isRetrying={retryMutation.isPending}
                />
              </div>
            </section>

            <section className={styles.section.wrapper}>
              <div className={styles.section.header}>학생 시청 정책</div>
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
              <div className={styles.section.header}>관리자 메모</div>
              <div className={styles.section.body}>
                <AdminMemoSection memo={memo} setMemo={setMemo} />
              </div>
            </section>
          </>
        }
        right={
          <section className={styles.section.wrapper}>
            <div className={styles.section.header}>학생 시청 현황</div>
            <div className={styles.section.body}>
              <VideoStudentsSection
                students={students}
                onOpenPermission={() => openModal("permission")}
                onOpenAchievement={() => openModal("achievement")}
                onOpenLog={() => openModal("log")}
              />
            </div>
          </section>
        }
        bottom={
          <>
            <div className={styles.bottom.row}>
              <span className={styles.bottom.label}>파일 정보</span>
              <span>
                {video.status ?? "—"} / {video.duration ?? "—"} / {formatBytes(video.file_size)} / {video.created_at ?? "—"}
              </span>
            </div>
            <div className={styles.bottom.row}>
              <span className={styles.bottom.label}>통계</span>
              <span>
                평균 만족도 {total > 0 ? `${(avgProgress * 100).toFixed(1)}%` : "—"} / 100% 완료 {completed100}명 / 90% 완료 {completed90}명
              </span>
            </div>
          </>
        }
      />

      <PermissionModal
        open={permissionOpen}
        onClose={() => setPermissionOpen(false)}
        videoId={videoId}
        initialTab={permissionTab}
      />
    </>
  );
}
