/**
 * PATH: src/features/videos/pages/VideoExplorerPage.tsx
 * 영상 (사이드바 첫 페이지) — 저장소/메시지/시험과 동일한 폴더트리형 SSOT
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";
import { FilePlus, Video, Folder, Eye } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/domain";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import Breadcrumb from "@/features/storage/components/Breadcrumb";
import VideoExplorerTree, { type VideoFolderId } from "../components/VideoExplorerTree";
import VideoUploadModal from "../components/features/video-detail/modals/VideoUploadModal";
import VideoThumbnail from "../ui/VideoThumbnail";
import VideoStatusBadge from "../ui/VideoStatusBadge";
import {
  fetchSessionVideos,
  fetchPublicSession,
  fetchVideoFolders,
  createVideoFolder,
  deleteVideoFolder,
  deleteVideo,
  retryVideo,
  getRetryErrorMessage,
  type Video as ApiVideo,
  type VideoFolder,
} from "../api/videos";
import { canShowRetryButton } from "../constants/videoProcessing";
import { logRetryAttempt, logRetryError } from "@/shared/api/retryLogger";
import {
  fetchLectures,
  fetchSessions,
  sortSessionsByDateDesc,
  type Lecture,
  type Session,
} from "@/features/lectures/api/sessions";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import VideoDetailOverlay from "./VideoDetailOverlay";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "../components/VideoExplorer.module.css";

type LectureWithSessions = Lecture & { sessions: Session[] };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

/** 유튜브 스타일: 업로드 시각 → "N분 전", "N시간 전", "N일 전" */
function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  if (diffSec < 60) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffWeek < 4) return `${diffWeek}주 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

/** 조회수 표기: 1234 → "1.2천 회", 10000+ → "1만 회" 등 */
function formatViewCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}천`;
  return `${count}`;
}

/** duration(초) → "MM:SS" or "H:MM:SS" */
function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function VideoExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [selectedFolderId, setSelectedFolderId] = useState<VideoFolderId>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTargetSessionId, setUploadTargetSessionId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [addChoiceModalOpen, setAddChoiceModalOpen] = useState(false);

  // Overlay state — driven by ?videoId=N&lectureId=N&sessionId=N search params
  const overlayVideoId = searchParams.get("videoId") ? Number(searchParams.get("videoId")) : null;
  const overlayLectureId = searchParams.get("lectureId") ? Number(searchParams.get("lectureId")) : null;
  const overlaySessionId = searchParams.get("sessionId") ? Number(searchParams.get("sessionId")) : null;
  const isOverlayOpen = overlayVideoId != null && overlayLectureId != null && overlaySessionId != null;

  const openOverlay = useCallback(
    (videoId: number, lectureId: number, sessionId: number) => {
      setSearchParams(
        { videoId: String(videoId), lectureId: String(lectureId), sessionId: String(sessionId) },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const closeOverlay = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const { data: lectures = [], isLoading: lecturesLoading } = useQuery({
    queryKey: ["admin-videos-lectures"],
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const sessionQueries = useQueries({
    queries: lectures.map((lec) => ({
      queryKey: ["lecture-sessions-videos", lec.id],
      queryFn: () => fetchSessions(lec.id),
      enabled: lectures.length > 0,
    })),
  });

  const lecturesWithSessions: LectureWithSessions[] = useMemo(() => {
    // 전체공개영상 Lecture는 제외 (별도로 최상단에 표시되므로)
    const filteredLectures = lectures.filter(
      (lec) => lec.title !== "전체공개영상" && lec.name !== "전체공개영상"
    );
    return filteredLectures.map((lec, i) => {
      const originalIndex = lectures.indexOf(lec);
      const sessions = (sessionQueries[originalIndex]?.data as Session[] | undefined) ?? [];
      return { ...lec, sessions: sortSessionsByDateDesc(sessions) };
    });
  }, [lectures, sessionQueries]);

  // 사이드바로 진입 시에도 media API가 먼저 호출되도록 마운트 시점에 public-session prefetch
  const {
    data: publicSession,
    isLoading: publicSessionLoading,
    isError: publicSessionError,
  } = useQuery({
    queryKey: ["public-session"],
    queryFn: fetchPublicSession,
    enabled: true,
    staleTime: 60_000,
  });

  const { data: sessionVideos = [], isLoading: sessionVideosLoading } = useQuery({
    queryKey: ["session-videos", selectedFolderId],
    queryFn: () => fetchSessionVideos(selectedFolderId as number),
    enabled: typeof selectedFolderId === "number",
  });

  // 전체공개영상 폴더 목록
  const { data: publicFolders = [], isLoading: publicFoldersLoading } = useQuery({
    queryKey: ["video-folders", publicSession?.session_id],
    queryFn: () => fetchVideoFolders(publicSession!.session_id),
    enabled: !!publicSession?.session_id,
  });

  // 선택된 폴더 ID (음수는 폴더, 양수는 세션)
  const selectedPublicFolderId = useMemo(() => {
    if (selectedFolderId === "public") return null;
    if (typeof selectedFolderId === "number" && selectedFolderId < 0) {
      return -selectedFolderId; // 음수를 양수로 변환
    }
    return null;
  }, [selectedFolderId]);

  const { data: publicVideos = [], isLoading: publicVideosLoading } = useQuery({
    queryKey: ["session-videos", publicSession?.session_id, selectedPublicFolderId],
    queryFn: () => {
      if (selectedPublicFolderId) {
        // 폴더별 영상 조회
        return fetchSessionVideos(publicSession!.session_id).then((videos) =>
          videos.filter((v) => v.folder === selectedPublicFolderId)
        );
      }
      // 루트 폴더 영상 (folder가 null인 것만)
      return fetchSessionVideos(publicSession!.session_id).then((videos) =>
        videos.filter((v) => !v.folder)
      );
    },
    enabled: selectedFolderId === "public" && !!publicSession?.session_id,
  });

  const videos = selectedFolderId === "public" ? publicVideos : sessionVideos;
  const videosLoading =
    selectedFolderId === "public"
      ? publicSessionLoading || publicVideosLoading || publicFoldersLoading
      : sessionVideosLoading;

  const sessionsLoading = sessionQueries.some((q) => q.isLoading);
  const isLoading = lecturesLoading || sessionsLoading;

  const selectedSession = useMemo(() => {
    if (typeof selectedFolderId !== "number") return null;
    for (const lec of lecturesWithSessions) {
      const s = lec.sessions.find((x) => x.id === selectedFolderId);
      if (s) return { lecture: lec, session: s };
    }
    return null;
  }, [lecturesWithSessions, selectedFolderId]);

  const breadcrumbPath = useMemo(() => {
    const path: { id: string | null; name: string }[] = [{ id: null, name: "영상" }];
    if (selectedFolderId === "public") {
      path.push({ id: "public", name: "전체공개영상" });
    } else if (selectedSession) {
      path.push({
        id: String(selectedSession.lecture.id),
        name: selectedSession.lecture.title || selectedSession.lecture.name || "강의",
      });
      path.push({ id: String(selectedSession.session.id), name: `${selectedSession.session.order}차시` });
    }
    return path;
  }, [selectedFolderId, selectedSession]);

  const handleBreadcrumbSelect = (id: string | null) => {
    if (!id) setSelectedFolderId(null);
    else if (id === "public") setSelectedFolderId("public");
    else {
      const num = Number(id);
      const asSession = lecturesWithSessions.some((l) => l.sessions.some((s) => s.id === num));
      if (asSession) setSelectedFolderId(num);
      else {
        const lec = lecturesWithSessions.find((l) => l.id === num);
        const firstSession = lec?.sessions?.[0];
        setSelectedFolderId(firstSession ? firstSession.id : null);
      }
    }
  };

  const openVideoDetail = (video: ApiVideo) => {
    // 전체공개영상인 경우
    if (selectedFolderId === "public" && publicSession && video.session_id === publicSession.session_id) {
      openOverlay(video.id, publicSession.lecture_id, publicSession.session_id);
      return;
    }
    // 현재 선택된 세션의 영상인 경우
    if (video.session_id && selectedSession) {
      openOverlay(video.id, selectedSession.lecture.id, selectedSession.session.id);
      return;
    }
    // 다른 강의-차시 영상 탐색
    const lecWithSession = lecturesWithSessions.find((l) =>
      l.sessions.some((s) => s.id === video.session_id)
    );
    const sess = lecWithSession?.sessions.find((s) => s.id === video.session_id);
    if (lecWithSession && sess) {
      openOverlay(video.id, lecWithSession.id, sess.id);
    }
  };

  const openUploadModal = (sessionId: number) => {
    setUploadTargetSessionId(sessionId);
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setUploadTargetSessionId(null);
  };

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || !publicSession) return;
    try {
      const parentId =
        selectedPublicFolderId && selectedFolderId !== "public" ? selectedPublicFolderId : null;
      await createVideoFolder(publicSession.session_id, newFolderName.trim(), parentId);
      queryClient.invalidateQueries({ queryKey: ["video-folders", publicSession.session_id] });
      setNewFolderName("");
      setNewFolderOpen(false);
    } catch (e) {
      feedback.error((e as Error).message || "폴더 생성에 실패했습니다.");
    }
  }, [newFolderName, publicSession, selectedPublicFolderId, selectedFolderId, queryClient]);

  const handleDeleteFolder = useCallback(
    async (folderId: number) => {
      const ok = await confirm({ title: "폴더 삭제", message: "폴더를 삭제하시겠습니까? 폴더 내 영상이 있으면 삭제할 수 없습니다." });
      if (!ok) return;
      try {
        await deleteVideoFolder(folderId);
        queryClient.invalidateQueries({ queryKey: ["video-folders", publicSession?.session_id] });
        queryClient.invalidateQueries({
          queryKey: ["session-videos", publicSession?.session_id],
        });
        if (selectedFolderId === -folderId) {
          setSelectedFolderId("public");
        }
      } catch (e) {
        feedback.error((e as Error).message || "폴더 삭제에 실패했습니다.");
      }
    },
    [publicSession, selectedFolderId, queryClient, confirm]
  );

  const retryVideoMutation = useMutation({
    mutationFn: async (payload: { videoId: number; title?: string }) => {
      logRetryAttempt(payload.videoId);
      await retryVideo(payload.videoId);
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["session-videos"] });
      queryClient.invalidateQueries({ queryKey: ["video-folders"] });
      asyncStatusStore.addWorkerJob(
        payload.title ? `${payload.title} 재시도` : `영상 ${payload.videoId} 재시도`,
        String(payload.videoId),
        "video_processing"
      );
      feedback.success("재시도 요청을 보냈습니다. 우하단 진행 상황에서 확인할 수 있습니다.");
    },
    onError: (e: unknown, payload) => {
      const msg = getRetryErrorMessage(e);
      if (payload?.videoId != null) logRetryError(payload.videoId, msg);
      feedback.error(msg);
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: deleteVideo,
    onSuccess: (_data, videoId) => {
      queryClient.invalidateQueries({ queryKey: ["session-videos"] });
      queryClient.invalidateQueries({ queryKey: ["video-folders"] });
      asyncStatusStore.removeTask(String(videoId));
    },
    onError: (e) => {
      feedback.error((e as Error).message || "영상 삭제에 실패했습니다.");
    },
  });

  const handleDeleteVideo = useCallback(
    async (e: React.MouseEvent, videoId: number) => {
      e.preventDefault();
      e.stopPropagation();
      const ok = await confirm({ title: "영상 삭제", message: "정말 삭제하시겠습니까?" });
      if (!ok) return;
      deleteVideoMutation.mutate(videoId);
    },
    [deleteVideoMutation, confirm]
  );

  return (
    <DomainLayout title="영상">
      <div className={panelStyles.root}>
        <div className={panelStyles.toolbar}>
          <Breadcrumb
            path={breadcrumbPath.length > 1 ? breadcrumbPath : [{ id: null, name: "영상" }]}
            onSelect={(id) => handleBreadcrumbSelect(id)}
          />
          <div className={panelStyles.actions}>
            <Button intent="primary" size="sm" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
          </div>
        </div>

        <div className={panelStyles.body}>
          <aside className={panelStyles.tree}>
            <div className={panelStyles.treeNavHeader}>
              <span className={panelStyles.treeNavTitle}>폴더</span>
            </div>
            <div className={panelStyles.treeScroll}>
              <VideoExplorerTree
              lectures={lecturesWithSessions}
              publicFolders={publicFolders}
              currentFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
            />
            </div>
          </aside>

          <div
            className={`${panelStyles.gridWrap} ${selectedFolderId === "public" ? styles.gridWrapPublic : ""}`}
          >
            {isLoading ? (
              <div className={panelStyles.placeholder}>불러오는 중…</div>
            ) : selectedFolderId === null ? (
              <div className={panelStyles.placeholder}>
                <p className={panelStyles.placeholderTitle}>좌측에서 폴더를 선택하세요</p>
                <p className={panelStyles.placeholderDesc}>
                  왼쪽 목록에서 전체공개영상 또는 강의·차시를 선택하면 여기에 영상 목록이 표시됩니다.
                </p>
              </div>
            ) : selectedFolderId === "public" && publicSessionError ? (
              <div className={panelStyles.placeholder} style={{ color: "var(--color-text-error, #b91c1c)" }}>
                <p className={panelStyles.placeholderTitle}>전체공개영상 영역을 불러오지 못했습니다</p>
                <p className={panelStyles.placeholderDesc}>
                  같은 도메인(예: tchul.com)으로 로그인했는지, 관리자·스태프 권한이 있는지 확인하세요.
                </p>
              </div>
            ) : videosLoading ? (
              <div className={panelStyles.placeholder}>
                <p className={panelStyles.placeholderTitle}>영상 목록 불러오는 중…</p>
              </div>
            ) : videos.length === 0 ? (
              <div
                className={selectedFolderId === "public" ? styles.emptyStateWrapper : ""}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}
              >
                <EmptyState
                  scope="panel"
                  tone="empty"
                  title={
                    selectedFolderId === "public"
                      ? "등록된 영상이 없습니다"
                      : "이 차시에 등록된 영상이 없습니다"
                  }
                  description={
                    selectedFolderId === "public"
                      ? "아래 버튼으로 전체공개 영상을 업로드하세요. 프로그램에 등록된 모든 학생이 시청할 수 있습니다."
                      : "아래 버튼으로 이 차시에 영상을 추가하세요."
                  }
                  actions={
                    (selectedFolderId === "public" && publicSession ? (
                      <Button intent="primary" size="sm" onClick={() => openUploadModal(publicSession.session_id)}>
                        영상 추가
                      </Button>
                    ) : selectedSession ? (
                      <Button intent="primary" size="sm" onClick={() => openUploadModal(selectedSession.session.id)}>
                        영상 추가
                      </Button>
                    ) : null)
                  }
                />
              </div>
            ) : (
              <div className={styles.grid}>
                {/* Add card for public videos */}
                {selectedFolderId === "public" && publicSession && (
                  <div
                    className={styles.itemAdd}
                    onClick={() => setAddChoiceModalOpen(true)}
                    title="추가"
                  >
                    <FilePlus size={32} />
                    <span>추가</span>
                  </div>
                )}
                {/* Add card for session videos */}
                {selectedSession && selectedFolderId !== "public" && (
                  <div
                    className={styles.itemAdd}
                    onClick={() => openUploadModal(selectedSession.session.id)}
                    title="영상 추가"
                  >
                    <FilePlus size={32} />
                    <span>추가</span>
                  </div>
                )}

                {/* Video cards */}
                {videos.map((v) => {
                  const durationLabel = formatDuration(v.duration);
                  const hasViewCount = v.view_count != null && Number.isFinite(v.view_count);

                  return (
                    <div key={v.id} className={styles.card} onClick={() => openVideoDetail(v)}>
                      {/* Thumbnail area */}
                      <div className={styles.thumbnailWrap}>
                        <VideoThumbnail
                          title={v.title}
                          status={v.status ?? "PENDING"}
                          thumbnail_url={v.thumbnail_url}
                        />
                        {/* Duration overlay (bottom-right, YouTube-style) */}
                        {durationLabel && v.status === "READY" && (
                          <span className={styles.duration}>{durationLabel}</span>
                        )}
                        {/* Status badge overlaid on thumbnail (top-left) */}
                        <div className={styles.statusOverlay}>
                          <VideoStatusBadge status={v.status ?? "PENDING"} />
                        </div>
                      </div>

                      {/* Card body */}
                      <div className={styles.cardBody}>
                        <span className={styles.cardTitle} title={v.title}>
                          {v.title || "—"}
                        </span>
                        <div className={styles.cardMeta}>
                          {hasViewCount && (
                            <>
                              <span className={styles.viewCount}>
                                <Eye className={styles.viewIcon} />
                                조회수 {formatViewCount(v.view_count!)}회
                              </span>
                            </>
                          )}
                          {hasViewCount && v.created_at && (
                            <span className={styles.metaDot}>·</span>
                          )}
                          {v.created_at && (
                            <span>{formatTimeAgo(v.created_at)}</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className={styles.cardActions}>
                        {canShowRetryButton(v) && (
                          <Button
                            intent="primary"
                            size="sm"
                            disabled={retryVideoMutation.isPending}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await confirm({ title: "영상 재시도", message: "재시도할까요? 진행 중인 작업이 있으면 취소 후 다시 제출됩니다.", confirmText: "재시도" });
                              if (ok) {
                                retryVideoMutation.mutate({ videoId: v.id, title: v.title });
                              }
                            }}
                            title="재시도"
                          >
                            {retryVideoMutation.isPending ? "요청 중…" : "재시도"}
                          </Button>
                        )}
                        <Button
                          intent="ghost"
                          size="sm"
                          disabled={deleteVideoMutation.isPending}
                          onClick={(e) => handleDeleteVideo(e, v.id)}
                          title="삭제"
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadTargetSessionId != null && (
        <VideoUploadModal
          sessionId={uploadTargetSessionId}
          isOpen={uploadModalOpen}
          onClose={closeUploadModal}
        />
      )}

      {/* 추가 선택 모달 (전체공개영상 내에서만) */}
      {addChoiceModalOpen && publicSession && (
        <AdminModal
          open={addChoiceModalOpen}
          onClose={() => setAddChoiceModalOpen(false)}
          width={MODAL_WIDTH.sm}
        >
          <ModalHeader title="추가하기" />
          <ModalBody>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setAddChoiceModalOpen(false);
                  openUploadModal(publicSession.session_id);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-bg-surface-hover)] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
                  <Video size={20} className="text-[var(--color-brand-primary)]" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">영상 업로드</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    새로운 영상을 업로드합니다
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddChoiceModalOpen(false);
                  setNewFolderOpen(true);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-bg-surface-hover)] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
                  <Folder size={20} className="text-[var(--color-brand-primary)]" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">폴더 생성</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    새로운 폴더를 생성합니다
                  </div>
                </div>
              </button>
            </div>
          </ModalBody>
          <ModalFooter
            right={
              <Button intent="secondary" onClick={() => setAddChoiceModalOpen(false)}>
                취소
              </Button>
            }
          />
        </AdminModal>
      )}

      {/* 폴더 생성 모달 */}
      {newFolderOpen && (
        <AdminModal
          open={newFolderOpen}
          onClose={() => {
            setNewFolderOpen(false);
            setNewFolderName("");
          }}
          width={MODAL_WIDTH.sm}
          onEnterConfirm={newFolderName.trim() ? handleCreateFolder : undefined}
        >
          <ModalHeader title="새 폴더" />
          <ModalBody>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 block">
                  폴더 이름
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") {
                      setNewFolderOpen(false);
                      setNewFolderName("");
                    }
                  }}
                  placeholder="폴더 이름을 입력하세요"
                  autoFocus
                  className="w-full px-3 py-2 border border-[var(--color-border-divider)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-primary)]"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter
            left={
              <Button
                intent="secondary"
                onClick={() => {
                  setNewFolderOpen(false);
                  setNewFolderName("");
                }}
              >
                취소
              </Button>
            }
            right={
              <Button intent="primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                생성
              </Button>
            }
          />
        </AdminModal>
      )}
      {isOverlayOpen && (
        <VideoDetailOverlay
          videoId={overlayVideoId!}
          lectureId={overlayLectureId!}
          sessionId={overlaySessionId!}
          onClose={closeOverlay}
        />
      )}
    </DomainLayout>
  );
}
