/**
 * PATH: src/features/videos/pages/VideoDetailOverlay.tsx
 * 영상 상세 오버레이 — VideoExplorerPage 그리드 위에 우측 와이드 드로어로 표시
 * ds-overlay SSOT 패턴 준수, createPortal 사용
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { deleteVideo, getRetryErrorMessage } from "../api/videos";
import { canShowRetryButton } from "../constants/videoProcessing";
import { logRetryAttempt, logRetryError } from "@/shared/api/retryLogger";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import { CloseButton } from "@/shared/ui/ds";

import VideoDetailLayout from "./VideoDetailLayout";
import { styles } from "./VideoDetail.styles";

import PermissionModal from "@/features/videos/components/features/video-detail/modals/PermissionModal";
import VideoPreviewSection from "@/features/videos/components/features/video-detail/components/VideoPreviewSection";
import VideoPolicySection from "@/features/videos/components/features/video-detail/components/VideoPolicySection";
import AdminMemoSection from "@/features/videos/components/features/video-detail/components/AdminMemoSection";
import VideoStudentsSection from "@/features/videos/components/features/video-detail/components/VideoStudentsSection";
import VideoEngagementBar from "@/features/videos/components/features/video-detail/components/VideoEngagementBar";
import AdminCommentSection from "@/features/videos/components/features/video-detail/components/AdminCommentSection";
import type { TabKey } from "@/features/videos/components/features/video-permission/permission.types";

function formatBytes(b?: number) {
  return b ? `${(Number(b) / 1024 / 1024).toFixed(1)} MB` : "\u2014";
}

interface VideoDetailOverlayProps {
  videoId: number;
  lectureId: number;
  sessionId: number;
  onClose: () => void;
}

export default function VideoDetailOverlay({
  videoId,
  lectureId,
  sessionId,
  onClose,
}: VideoDetailOverlayProps) {
  const qc = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [permissionTab, setPermissionTab] = useState<TabKey>("permission");
  const [memo, setMemo] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !permissionOpen) {
        onClose();
      }
    },
    [onClose, permissionOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll while overlay is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [handleKeyDown]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteVideo(videoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-videos"] });
      qc.invalidateQueries({ queryKey: ["video-stats", videoId] });
      asyncStatusStore.removeTask(String(videoId));
      onClose();
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "\uC601\uC0C1 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.";
      feedback.error(msg);
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      logRetryAttempt(videoId);
      await api.post(`/media/videos/${videoId}/retry/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-stats", videoId] });
      qc.invalidateQueries({ queryKey: ["session-videos"] });
      asyncStatusStore.addWorkerJob(
        `영상 ${videoId} 재시도`,
        String(videoId),
        "video_processing"
      );
      feedback.success("재시도 요청을 보냈습니다.");
    },
    onError: (e: unknown) => {
      const msg = getRetryErrorMessage(e);
      logRetryError(videoId, msg);
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

  const video = data?.video;
  const students = data?.students ?? [];
  const total = students.length;
  const completed100 = students.filter((s: any) => (Number(s.progress ?? 0) || 0) >= 1).length;
  const progressSum = students.reduce((a: number, s: any) => a + (Number(s.progress ?? 0) || 0), 0);
  const avgProgress = total > 0 ? progressSum / total : 0;
  const completed90 = students.filter((s: any) => (Number(s.progress ?? 0) || 0) >= 0.9).length;

  const openModal = (tab: TabKey) => {
    setPermissionTab(tab);
    setPermissionOpen(true);
  };

  const content = (
    <>
      <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />

      <div className="ds-overlay-wrap ds-overlay-wrap--drawer-wide">
        <div
          ref={panelRef}
          className="ds-overlay-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <CloseButton
            className="ds-overlay-panel__close"
            onClick={onClose}
          />

          <div className="ds-overlay-body">
            {isLoading || !video ? (
              <div className="space-y-4 p-4 animate-pulse">
                <div
                  className="h-6 w-48 rounded"
                  style={{ background: "var(--color-bg-surface-soft)" }}
                />
                <div
                  className="h-4 w-72 rounded"
                  style={{ background: "var(--color-bg-surface-soft)" }}
                />
                <div
                  className="h-[320px] rounded-lg"
                  style={{ background: "var(--color-bg-surface-soft)" }}
                />
              </div>
            ) : (
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
                      <div
                        className={styles.header.actions}
                        style={{ display: "flex", gap: 12, alignItems: "center", marginRight: 48 }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) {
                              deleteMutation.mutate();
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className={styles.header.primaryDropdown}
                          style={{
                            color: "var(--color-danger)",
                            borderColor: "var(--color-danger)",
                            background: "transparent",
                          }}
                        >
                          {deleteMutation.isPending ? "\uC0AD\uC81C \uC911\u2026" : "\uC0AD\uC81C"}
                        </button>
                      </div>
                    </>
                  }
                  left={
                    <>
                      <section className={styles.section.wrapper}>
                        <div className={styles.section.header}>영상 미리보기</div>
                        <div className={styles.section.body}>
                          <VideoPreviewSection
                            hlsSrc={video.hls_url}
                            status={video.status}
                            progressPercent={null}
                            onRetry={
                              canShowRetryButton(video)
                                ? () => retryMutation.mutate()
                                : undefined
                            }
                            isRetrying={retryMutation.isPending}
                          />
                        </div>
                      </section>

                      <VideoEngagementBar
                        videoId={videoId}
                        fallbackViewCount={video.view_count}
                      />

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

                      <section className={styles.section.wrapper}>
                        <div className={styles.section.header}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            학생 댓글
                          </span>
                        </div>
                        <div className={styles.section.body}>
                          <AdminCommentSection videoId={videoId} />
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
                          selectedEnrollmentId={selectedEnrollmentId}
                          onSelectPreviewStudent={(id) => {
                            setSelectedEnrollmentId(id);
                          }}
                        />
                      </div>
                    </section>
                  }
                  bottom={
                    <>
                      <div className={styles.bottom.row}>
                        <span className={styles.bottom.label}>파일 정보</span>
                        <span>
                          {video.status ?? "\u2014"} / {video.duration ?? "\u2014"} /{" "}
                          {formatBytes(video.file_size)} / {video.created_at ?? "\u2014"}
                        </span>
                      </div>
                      <div className={styles.bottom.row}>
                        <span className={styles.bottom.label}>통계</span>
                        <span>
                          평균 진도율{" "}
                          {total > 0 ? `${(avgProgress * 100).toFixed(1)}%` : "\u2014"} / 100%
                          완료 {completed100}명 / 90% 완료 {completed90}명
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
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
