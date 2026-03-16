/**
 * PATH: src/features/videos/pages/VideoDetailOverlay.tsx
 * 영상 상세 오버레이 — VideoExplorerPage 그리드 위에 우측 와이드 드로어로 표시
 * YouTube-style layout: Player → Title + Engagement → Comments → Settings
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

import { styles } from "./VideoDetail.styles";

import PermissionModal from "@/features/videos/components/features/video-detail/modals/PermissionModal";
import VideoPreviewSection from "@/features/videos/components/features/video-detail/components/VideoPreviewSection";
import VideoPolicySection from "@/features/videos/components/features/video-detail/components/VideoPolicySection";
import VideoStudentsSection from "@/features/videos/components/features/video-detail/components/VideoStudentsSection";
import VideoEngagementBar from "@/features/videos/components/features/video-detail/components/VideoEngagementBar";
import AdminCommentSection from "@/features/videos/components/features/video-detail/components/AdminCommentSection";
import type { TabKey } from "@/features/videos/components/features/video-permission/permission.types";

function formatBytes(b?: number) {
  return b ? `${(Number(b) / 1024 / 1024).toFixed(1)} MB` : "\u2014";
}

function formatDuration(d?: string | number | null) {
  if (!d) return null;
  const sec = typeof d === "string" ? parseInt(d, 10) : d;
  if (isNaN(sec) || sec <= 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ── Chevron icon for collapsible ── */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 0.2s",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
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
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
                  className="h-[320px] rounded-2xl"
                  style={{ background: "#000" }}
                />
              </div>
            ) : (
              <>
                {/* ── YouTube-style layout ── */}
                <div className={styles.layout.root}>
                  {/* LEFT: Player → Title+Engagement → Comments → Settings */}
                  <div className={styles.layout.left}>
                    {/* 1. Video Player — cinematic, no card wrapper */}
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

                    {/* 2. Title + Meta — YouTube style below player */}
                    <div style={{ padding: "4px 0" }}>
                      <h1
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "var(--color-text-primary)",
                          lineHeight: 1.4,
                          letterSpacing: "-0.01em",
                          margin: 0,
                        }}
                      >
                        {video.title}
                      </h1>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginTop: 6,
                          fontSize: 13,
                          color: "var(--color-text-muted)",
                          flexWrap: "wrap",
                        }}
                      >
                        {video.created_at && (
                          <span>{video.created_at}</span>
                        )}
                        {formatDuration(video.duration) && (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span>{formatDuration(video.duration)}</span>
                          </>
                        )}
                        {video.file_size && (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span>{formatBytes(video.file_size)}</span>
                          </>
                        )}
                        <span style={{ flex: 1 }} />
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) {
                              deleteMutation.mutate();
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--color-danger)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: 6,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "color-mix(in srgb, var(--color-danger) 10%, transparent)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "none";
                          }}
                        >
                          {deleteMutation.isPending ? "\uC0AD\uC81C \uC911\u2026" : "\uC0AD\uC81C"}
                        </button>
                      </div>
                    </div>

                    {/* 3. Engagement Bar — directly under title */}
                    <VideoEngagementBar
                      videoId={videoId}
                      fallbackViewCount={video.view_count}
                    />

                    {/* 4. Comments — directly under engagement (YouTube style) */}
                    <div
                      style={{
                        background: "var(--color-bg-surface)",
                        borderRadius: 16,
                        border: "1px solid var(--color-border-divider)",
                        padding: "20px 24px",
                      }}
                    >
                      <AdminCommentSection videoId={videoId} />
                    </div>

                    {/* 5. Settings (Policy + Memo) — collapsible */}
                    <div
                      style={{
                        background: "var(--color-bg-surface)",
                        borderRadius: 16,
                        border: "1px solid var(--color-border-divider)",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 20px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                          시청 정책 · 관리자 메모
                        </span>
                        <ChevronIcon open={settingsOpen} />
                      </button>
                      {settingsOpen && (
                        <div
                          style={{
                            borderTop: "1px solid var(--color-border-divider)",
                            padding: "20px 24px",
                          }}
                        >
                          <div style={{ marginBottom: 24 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--color-text-primary)",
                                marginBottom: 12,
                              }}
                            >
                              학생 시청 정책
                            </div>
                            <VideoPolicySection
                              videoId={videoId}
                              initial={{
                                allow_skip: video.allow_skip,
                                max_speed: video.max_speed,
                                show_watermark: video.show_watermark,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom stats */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                        fontSize: 12,
                        color: "var(--color-text-muted)",
                        padding: "4px 0",
                      }}
                    >
                      <span>
                        평균 진도율{" "}
                        <strong style={{ color: "var(--color-text-secondary)" }}>
                          {total > 0 ? `${(avgProgress * 100).toFixed(1)}%` : "\u2014"}
                        </strong>
                      </span>
                      <span style={{ opacity: 0.3 }}>·</span>
                      <span>
                        100% 완료{" "}
                        <strong style={{ color: "var(--color-text-secondary)" }}>
                          {completed100}명
                        </strong>
                      </span>
                      <span style={{ opacity: 0.3 }}>·</span>
                      <span>
                        90% 이상{" "}
                        <strong style={{ color: "var(--color-text-secondary)" }}>
                          {completed90}명
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* RIGHT: Student watch status */}
                  <div className={styles.layout.right}>
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
                  </div>
                </div>

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
