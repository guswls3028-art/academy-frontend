// PATH: src/app_admin/domains/videos/pages/VideoDetailPage.tsx
// YouTube-style layout: Player → Title + Engagement → Comments → Settings

import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { deleteVideo, renameVideo, getRetryErrorMessage } from "../api/videos.api";
import { canShowRetryButton } from "../constants/videoProcessing";
import { logRetryAttempt, logRetryError } from "@/shared/api/retryLogger";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";

import { styles } from "./VideoDetail.styles";

import PermissionModal from "@admin/domains/videos/components/features/video-detail/modals/PermissionModal";
import VideoPreviewSection from "@admin/domains/videos/components/features/video-detail/components/VideoPreviewSection";
import VideoPolicySection from "@admin/domains/videos/components/features/video-detail/components/VideoPolicySection";
import VideoStudentsSection from "@admin/domains/videos/components/features/video-detail/components/VideoStudentsSection";
import VideoEngagementBar from "@admin/domains/videos/components/features/video-detail/components/VideoEngagementBar";
import AdminCommentSection from "@admin/domains/videos/components/features/video-detail/components/AdminCommentSection";
import type { TabKey } from "@admin/domains/videos/components/features/video-permission/permission.types";
import VideoEditModal from "@admin/domains/videos/components/features/video-detail/modals/VideoEditModal";

function formatBytes(b?: number) {
  return b ? `${(Number(b) / 1024 / 1024).toFixed(1)} MB` : "—";
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

export default function VideoDetailPage() {
  const params = useParams();
  const lectureId = Number(params.lectureId);
  const sessionId = Number(params.sessionId);
  const videoId = Number(params.videoId);

  const [permissionOpen, setPermissionOpen] = useState(false);
  const [permissionTab, setPermissionTab] = useState<TabKey>("permission");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const deleteMutation = useMutation({
    mutationFn: () => deleteVideo(videoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-videos"] });
      qc.invalidateQueries({ queryKey: ["video-stats", videoId] });
      asyncStatusStore.removeTask(String(videoId));
      navigate(`/admin/lectures/${lectureId}/sessions/${sessionId}/videos`);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "영상 삭제에 실패했습니다.";
      feedback.error(msg);
    },
  });

  const renameMutation = useMutation({
    mutationFn: (title: string) => renameVideo(videoId, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-stats", videoId] });
      qc.invalidateQueries({ queryKey: ["session-videos"] });
      setIsEditingTitle(false);
      feedback.success("제목이 변경되었습니다.");
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "제목 변경에 실패했습니다.";
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

  if (isLoading || !data?.video) {
    return (
      <div className="space-y-4 p-4 animate-pulse">
        <div className="h-6 w-48 rounded" style={{ background: "var(--color-bg-surface-soft)" }} />
        <div className="h-4 w-72 rounded" style={{ background: "var(--color-bg-surface-soft)" }} />
        <div className="h-[320px] rounded-2xl" style={{ background: "#000" }} />
      </div>
    );
  }

  const video = data.video;
  const students = data.students ?? [];
  const total = students.length;
  const completed100 = students.filter((s: any) => (Number(s.progress ?? 0) || 0) >= 1).length;
  const progressSum = students.reduce((a: number, s: any) => a + (Number(s.progress ?? 0) || 0), 0);
  const avgProgress = total > 0 ? progressSum / total : 0;
  const completed90 = students.filter((s: any) => (Number(s.progress ?? 0) || 0) >= 0.9).length;

  const openModal = (tab: TabKey) => {
    setPermissionTab(tab);
    setPermissionOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
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
              {isEditingTitle ? (
                <form
                  style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = editTitle.trim();
                    if (trimmed && trimmed !== video.title) {
                      renameMutation.mutate(trimmed);
                    } else {
                      setIsEditingTitle(false);
                    }
                  }}
                >
                  <input
                    autoFocus
                    className="ds-input"
                    style={{ fontSize: 20, fontWeight: 700, flex: 1, padding: "4px 8px" }}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsEditingTitle(false);
                    }}
                    onBlur={() => {
                      const trimmed = editTitle.trim();
                      if (trimmed && trimmed !== video.title) {
                        renameMutation.mutate(trimmed);
                      } else {
                        setIsEditingTitle(false);
                      }
                    }}
                    disabled={renameMutation.isPending}
                  />
                </form>
              ) : (
                <h1
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    lineHeight: 1.4,
                    letterSpacing: "-0.01em",
                    margin: 0,
                    cursor: "pointer",
                    borderRadius: 6,
                    padding: "2px 4px",
                    transition: "background 0.15s",
                  }}
                  title="클릭하여 제목 변경"
                  onClick={() => {
                    setEditTitle(video.title);
                    setIsEditingTitle(true);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-bg-surface-soft)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {video.title}
                </h1>
              )}
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
                  onClick={() => setEditModalOpen(true)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 6,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-bg-surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({ title: "삭제 확인", message: "정말 삭제하시겠습니까?", danger: true, confirmText: "삭제" });
                    if (!ok) return;
                    deleteMutation.mutate();
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
                  {deleteMutation.isPending ? "삭제 중…" : "삭제"}
                </button>
                <Link
                  to={`/admin/lectures/${lectureId}/sessions/${sessionId}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--color-border-divider)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-bg-surface-soft)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  ← 세션으로
                </Link>
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
                  {total > 0 ? `${(avgProgress * 100).toFixed(1)}%` : "—"}
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
      </div>

      <PermissionModal
        open={permissionOpen}
        onClose={() => setPermissionOpen(false)}
        videoId={videoId}
        initialTab={permissionTab}
      />

      {video && (
        <VideoEditModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          videoId={videoId}
          initialTitle={video.title ?? ""}
          initialOrder={video.order ?? 1}
          sessionId={sessionId}
        />
      )}
    </>
  );
}
