/**
 * PATH: src/app_admin/domains/videos/components/VideoTreeView.tsx
 *
 * 폴더·차시 트리 진입 화면 (보조 진입점)
 * — KPI 인박스(기본)에서 「폴더별 탐색」 토글 시 노출
 *
 * 본 컴포넌트는 기존 VideoExplorerPage의 트리/그리드/모달 로직을 그대로 옮겨온 것이다.
 * 디자인/동작 변경 없음. 페이지에서 KPI 모드와 분리하기 위한 추출만 수행.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";
import { FilePlus, Video, Folder, Eye, ArrowUpDown, Play } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import Breadcrumb from "@/shared/ui/navigation/PathBreadcrumb";
import VideoExplorerTree, { type VideoFolderId } from "./VideoExplorerTree";
import VideoUploadModal from "./features/video-detail/modals/VideoUploadModal";
import VideoThumbnail from "../ui/VideoThumbnail";
import VideoStatusBadge from "../ui/VideoStatusBadge";
import {
  fetchSessionVideos,
  fetchPublicSession,
  fetchVideoFolders,
  createVideoFolder,
  deleteVideo,
  retryVideo,
  getRetryErrorMessage,
  type Video as ApiVideo,
} from "../api/videos.api";
import { canShowRetryButton } from "../constants/videoProcessing";
import { logRetryAttempt, logRetryError } from "@/shared/api/retryLogger";
import {
  fetchAllSessions,
  fetchLectures,
  sortSessionsByDisplayOrder,
  type Lecture,
  type Session,
} from "@/shared/api/contracts/sessions";
import { formatSessionBlockLabel } from "@/shared/ui/session-block";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import VideoDetailOverlay from "../pages/VideoDetailOverlay";
import VideoEditModal from "./features/video-detail/modals/VideoEditModal";
import VideoReorderModal from "./VideoReorderModal";
import { adminVideoQueryKeys } from "../queryKeys";
import {
  formatRoundedVideoDuration,
  formatVideoTimeAgo,
  formatVideoViewCount,
} from "@/shared/media/video/videoFormat";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "./VideoExplorer.module.css";

type LectureWithSessions = Lecture & { sessions: Session[] };

export default function VideoTreeView() {
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
  const [editTarget, setEditTarget] = useState<ApiVideo | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);

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
    queryKey: adminVideoQueryKeys.lectures,
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const { data: allSessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: adminVideoQueryKeys.lectureSessionsAll,
    queryFn: fetchAllSessions,
    staleTime: 60_000,
  });

  const lecturesWithSessions: LectureWithSessions[] = useMemo(() => {
    const sessionsByLecture = new Map<number, Session[]>();
    for (const session of allSessions) {
      const bucket = sessionsByLecture.get(session.lecture) ?? [];
      bucket.push(session);
      sessionsByLecture.set(session.lecture, bucket);
    }
    const filteredLectures = lectures.filter((lec) => !lec.is_system);
    return filteredLectures.map((lec) => {
      const sessions = sessionsByLecture.get(lec.id) ?? [];
      return { ...lec, sessions: sortSessionsByDisplayOrder(sessions) };
    });
  }, [lectures, allSessions]);

  const {
    data: publicSession,
    isLoading: publicSessionLoading,
    isError: publicSessionError,
  } = useQuery({
    queryKey: adminVideoQueryKeys.publicSession,
    queryFn: fetchPublicSession,
    enabled: true,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (selectedFolderId === null && lecturesWithSessions.length > 0) {
      for (const lec of lecturesWithSessions) {
        if (lec.sessions.length > 0) {
          setSelectedFolderId(lec.sessions[0].id);
          break;
        }
      }
    }
  }, [lecturesWithSessions, selectedFolderId]);

  const { data: publicFolders = [], isLoading: publicFoldersLoading } = useQuery({
    queryKey: adminVideoQueryKeys.foldersForSession(publicSession?.session_id),
    queryFn: () => fetchVideoFolders(publicSession!.session_id),
    enabled: !!publicSession?.session_id,
  });

  const selectedPublicFolderId = useMemo(() => {
    if (selectedFolderId === "public") return null;
    if (typeof selectedFolderId === "number" && selectedFolderId < 0) {
      return -selectedFolderId;
    }
    return null;
  }, [selectedFolderId]);
  const isPublicSelection = selectedFolderId === "public" || selectedPublicFolderId != null;

  const { data: sessionVideos = [], isLoading: sessionVideosLoading } = useQuery({
    queryKey: adminVideoQueryKeys.sessionVideosScoped(selectedFolderId),
    queryFn: () => fetchSessionVideos(selectedFolderId as number),
    enabled: typeof selectedFolderId === "number" && selectedFolderId > 0,
  });

  const { data: publicVideos = [], isLoading: publicVideosLoading } = useQuery({
    queryKey: adminVideoQueryKeys.sessionVideosInFolder(publicSession?.session_id, selectedPublicFolderId),
    queryFn: () => {
      if (selectedPublicFolderId) {
        return fetchSessionVideos(publicSession!.session_id).then((videos) =>
          videos.filter((v) => v.folder === selectedPublicFolderId)
        );
      }
      return fetchSessionVideos(publicSession!.session_id).then((videos) =>
        videos.filter((v) => !v.folder)
      );
    },
    enabled: isPublicSelection && !!publicSession?.session_id,
  });

  const unsortedVideos = isPublicSelection ? publicVideos : sessionVideos;
  const videos = useMemo(
    () =>
      [...unsortedVideos].sort((a, b) => {
        const orderDiff = (a.order ?? 1) - (b.order ?? 1);
        if (orderDiff !== 0) return orderDiff;
        const titleCmp = (a.title ?? "").localeCompare(b.title ?? "", "ko");
        return titleCmp !== 0 ? titleCmp : a.id - b.id;
      }),
    [unsortedVideos]
  );
  const videosLoading =
    isPublicSelection
      ? publicSessionLoading || publicVideosLoading || publicFoldersLoading
      : sessionVideosLoading;

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
    } else if (selectedPublicFolderId != null) {
      const folder = publicFolders.find((f) => f.id === selectedPublicFolderId);
      path.push({ id: "public", name: "전체공개영상" });
      path.push({ id: String(selectedFolderId), name: folder?.name ?? "폴더" });
    } else if (selectedSession) {
      path.push({
        id: String(selectedSession.lecture.id),
        name: selectedSession.lecture.title || selectedSession.lecture.name || "강의",
      });
      path.push({ id: String(selectedSession.session.id), name: formatSessionBlockLabel(selectedSession.session) });
    }
    return path;
  }, [publicFolders, selectedFolderId, selectedPublicFolderId, selectedSession]);

  const handleBreadcrumbSelect = (id: string | null) => {
    if (!id) setSelectedFolderId(null);
    else if (id === "public") setSelectedFolderId("public");
    else {
      const num = Number(id);
      if (Number.isFinite(num) && num < 0) {
        setSelectedFolderId(num);
        return;
      }
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
    if (isPublicSelection && publicSession && video.session_id === publicSession.session_id) {
      openOverlay(video.id, publicSession.lecture_id, publicSession.session_id);
      return;
    }
    if (video.session_id && selectedSession) {
      openOverlay(video.id, selectedSession.lecture.id, selectedSession.session.id);
      return;
    }
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
      queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.foldersForSession(publicSession.session_id) });
      setNewFolderName("");
      setNewFolderOpen(false);
    } catch (e) {
      feedback.error((e as Error).message || "폴더 생성에 실패했습니다.");
    }
  }, [newFolderName, publicSession, selectedPublicFolderId, selectedFolderId, queryClient]);

  const retryVideoMutation = useMutation({
    mutationFn: async (payload: { videoId: number; title?: string }) => {
      logRetryAttempt(payload.videoId);
      await retryVideo(payload.videoId);
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.sessionVideos });
      queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.folders });
      asyncStatusStore.addWorkerJob(
        payload.title ? `${payload.title} 재시도` : `영상 ${payload.videoId} 재시도`,
        String(payload.videoId),
        "video_processing"
      );
      feedback.success("재시도 요청을 보냈습니다. 우상단 작업박스에서 확인할 수 있습니다.");
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
      queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.sessionVideos });
      queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.folders });
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
      const ok = await confirm({ title: "영상 삭제", message: "이 영상을 삭제하시겠습니까? 학생 시청 기록과 진도 데이터도 함께 삭제됩니다." });
      if (!ok) return;
      deleteVideoMutation.mutate(videoId);
    },
    [deleteVideoMutation, confirm]
  );

  return (
    <>
      <div className={panelStyles.root}>
        <div className={panelStyles.toolbar}>
          <Breadcrumb
            path={breadcrumbPath.length > 1 ? breadcrumbPath : [{ id: null, name: "영상" }]}
            onSelect={(id) => handleBreadcrumbSelect(id)}
          />
          <div className={panelStyles.actions}>
            {selectedFolderId != null && videos.length > 1 && (
              <Button
                intent="ghost"
                size="sm"
                onClick={() => setReorderOpen(true)}
                leftIcon={<ArrowUpDown size={14} />}
              >
                순서 관리
              </Button>
            )}
            <Button intent="primary" size="sm" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
          </div>
        </div>

        <div className={panelStyles.body}>
          <aside data-guide="videos-tree" className={panelStyles.tree}>
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

          <div className={`${panelStyles.gridWrap} ${isPublicSelection ? styles.gridWrapPublic : ""}`}>
            {isLoading ? (
              <div className={panelStyles.placeholder}>불러오는 중…</div>
            ) : selectedFolderId === null ? (
              <div className={panelStyles.placeholder}>
                <div className={panelStyles.placeholderIcon}>
                  <Play size={28} />
                </div>
                <p className={panelStyles.placeholderTitle}>폴더를 선택하세요</p>
                <p className={panelStyles.placeholderDesc}>
                  왼쪽 목록에서 전체공개영상 또는 강의·차시를 선택하면 영상을 확인할 수 있습니다.
                </p>
              </div>
            ) : isPublicSelection && publicSessionError ? (
              <div className={`${panelStyles.placeholder} ${styles.errorPlaceholder}`}>
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
                className={`flex min-h-[200px] items-center justify-center ${isPublicSelection ? styles.emptyStateWrapper : ""}`}
              >
                <EmptyState
                  scope="panel"
                  tone="empty"
                  title={
                    isPublicSelection
                      ? "등록된 영상이 없습니다"
                      : "이 차시에 등록된 영상이 없습니다"
                  }
                  description={
                    isPublicSelection
                      ? "아래 버튼으로 전체공개영상을 업로드하세요. 프로그램에 등록된 모든 학생이 시청할 수 있습니다."
                      : "아래 버튼으로 이 차시에 영상을 추가하세요."
                  }
                  actions={
                    isPublicSelection && publicSession ? (
                      <Button intent="primary" size="sm" onClick={() => openUploadModal(publicSession.session_id)}>
                        영상 추가
                      </Button>
                    ) : selectedSession ? (
                      <Button intent="primary" size="sm" onClick={() => openUploadModal(selectedSession.session.id)}>
                        영상 추가
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <div className={styles.grid}>
                {isPublicSelection && publicSession && (
                  <button
                    type="button"
                    data-guide="videos-add"
                    className={styles.itemAdd}
                    onClick={() => setAddChoiceModalOpen(true)}
                    title="추가"
                  >
                    <FilePlus size={32} />
                    <span>추가</span>
                  </button>
                )}
                {selectedSession && !isPublicSelection && (
                  <button
                    type="button"
                    className={styles.itemAdd}
                    onClick={() => openUploadModal(selectedSession.session.id)}
                    title="영상 추가"
                  >
                    <FilePlus size={32} />
                    <span>추가</span>
                  </button>
                )}

                {videos.map((v) => {
                  const durationLabel = formatRoundedVideoDuration(v.duration);
                  const hasViewCount = v.view_count != null && Number.isFinite(v.view_count);

                  return (
                    <div key={v.id} className={styles.card}>
                      <button
                        type="button"
                        className={styles.cardOpen}
                        onClick={() => openVideoDetail(v)}
                        aria-label={`${v.title || "영상"} 상세 보기`}
                      >
                        <div className={styles.thumbnailWrap}>
                          <VideoThumbnail
                            title={v.title}
                            status={v.status ?? "PENDING"}
                            thumbnail_url={v.thumbnail_url}
                          />
                          {durationLabel && v.status === "READY" && (
                            <span className={styles.duration}>{durationLabel}</span>
                          )}
                          <div className={styles.statusOverlay}>
                            <VideoStatusBadge status={v.status ?? "PENDING"} />
                          </div>
                        </div>

                        <div className={styles.cardBody}>
                          <span className={styles.cardTitle} title={v.title}>
                            {v.title || "—"}
                          </span>
                          <div className={styles.cardMeta}>
                            {v.source_type === "youtube" && (
                              <span className={styles.sourceChip}>YouTube</span>
                            )}
                            {v.source_type === "youtube" && (hasViewCount || v.created_at) && <span className={styles.metaDot}>·</span>}
                            {hasViewCount && (
                              <span className={styles.viewCount}>
                                <Eye className={styles.viewIcon} />
                                조회수 {formatVideoViewCount(v.view_count!)}회
                              </span>
                            )}
                            {hasViewCount && v.created_at && <span className={styles.metaDot}>·</span>}
                            {v.created_at && <span>{formatVideoTimeAgo(v.created_at)}</span>}
                          </div>
                        </div>
                      </button>

                      <div className={styles.cardActions}>
                        {canShowRetryButton(v) && (
                          <Button
                            intent="primary"
                            size="sm"
                            disabled={retryVideoMutation.isPending}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await confirm({
                                title: "영상 재시도",
                                message: "재시도할까요? 진행 중인 작업이 있으면 취소 후 다시 제출됩니다.",
                                confirmText: "재시도",
                              });
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTarget(v);
                          }}
                          title="수정"
                        >
                          수정
                        </Button>
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
          folderId={isPublicSelection ? selectedPublicFolderId : null}
          isOpen={uploadModalOpen}
          onClose={closeUploadModal}
        />
      )}

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
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">새로운 영상을 업로드합니다</div>
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
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">새로운 폴더를 생성합니다</div>
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
      {editTarget && (
        <VideoEditModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          videoId={editTarget.id}
          initialTitle={editTarget.title}
          initialOrder={editTarget.order ?? 1}
        />
      )}
      {isOverlayOpen && (
        <VideoDetailOverlay
          videoId={overlayVideoId!}
          lectureId={overlayLectureId!}
          sessionId={overlaySessionId!}
          onClose={closeOverlay}
        />
      )}
      <VideoReorderModal
        open={reorderOpen}
        onClose={() => setReorderOpen(false)}
        videos={videos}
        sessionTitle={
          isPublicSelection
            ? "전체공개영상"
            : selectedSession
              ? formatSessionBlockLabel(selectedSession.session)
              : undefined
        }
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.sessionVideos });
        }}
      />
    </>
  );
}
