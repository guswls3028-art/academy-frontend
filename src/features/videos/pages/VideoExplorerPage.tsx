/**
 * 영상 (사이드바 첫 페이지) — 저장소/메시지/시험과 동일한 폴더트리형 SSOT
 * 전체공개영상(맨위) + 강의명 > 1~n차시 트리, 우측에 영상 그리드
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { FilePlus, FolderPlus, X, Video, Folder } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
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
  type Video as ApiVideo,
  type VideoFolder,
} from "../api/videos";
import {
  fetchLectures,
  fetchSessions,
  sortSessionsByDateDesc,
  type Lecture,
  type Session,
} from "@/features/lectures/api/sessions";
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

export default function VideoExplorerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFolderId, setSelectedFolderId] = useState<VideoFolderId>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTargetSessionId, setUploadTargetSessionId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [addChoiceModalOpen, setAddChoiceModalOpen] = useState(false);

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
    if (selectedFolderId === "public" && publicSession && video.session_id === publicSession.session_id) {
      navigate(
        `/admin/lectures/${publicSession.lecture_id}/sessions/${publicSession.session_id}/videos/${video.id}`
      );
      return;
    }
    if (video.session_id && selectedSession) {
      navigate(
        `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}/videos/${video.id}`
      );
      return;
    }
    const lecWithSession = lecturesWithSessions.find((l) =>
      l.sessions.some((s) => s.id === video.session_id)
    );
    const sess = lecWithSession?.sessions.find((s) => s.id === video.session_id);
    if (lecWithSession && sess) {
      navigate(`/admin/lectures/${lecWithSession.id}/sessions/${sess.id}/videos/${video.id}`);
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
      alert((e as Error).message || "폴더 생성에 실패했습니다.");
    }
  }, [newFolderName, publicSession, selectedPublicFolderId, selectedFolderId, queryClient]);

  const handleDeleteFolder = useCallback(
    async (folderId: number) => {
      if (!confirm("폴더를 삭제하시겠습니까? 폴더 내 영상이 있으면 삭제할 수 없습니다.")) return;
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
        alert((e as Error).message || "폴더 삭제에 실패했습니다.");
      }
    },
    [publicSession, selectedFolderId, queryClient]
  );

  return (
    <DomainLayout
      title="영상"
      description="강의·차시 단위 영상을 관리합니다. 전체공개영상은 프로그램에 등록된 모든 학생이 시청할 수 있는 영상입니다."
    >
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <Breadcrumb
            path={breadcrumbPath.length > 1 ? breadcrumbPath : [{ id: null, name: "영상" }]}
            onSelect={(id) => handleBreadcrumbSelect(id)}
          />
          <div className={styles.actions}>
            <Button intent="primary" size="sm" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
          </div>
        </div>

        <div className={styles.body}>
          <aside className={styles.tree}>
            <VideoExplorerTree
              lectures={lecturesWithSessions}
              publicFolders={publicFolders}
              currentFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
            />
          </aside>

          <div
            className={`${styles.gridWrap} ${selectedFolderId === "public" ? styles.gridWrapPublic : ""}`}
          >
            {isLoading ? (
              <div className={styles.placeholder}>불러오는 중…</div>
            ) : selectedFolderId === null ? (
              <div className={styles.placeholder}>좌측에서 폴더를 선택하세요</div>
            ) : selectedFolderId === "public" && publicSessionError ? (
              <div className={styles.placeholder} style={{ color: "var(--color-text-error, #b91c1c)" }}>
                전체공개영상 영역을 불러오지 못했습니다. 같은 도메인(예: tchul.com)으로 로그인했는지, 관리자·스태프 권한이 있는지 확인하세요.
              </div>
            ) : videosLoading ? (
              <div className={styles.placeholder}>영상 목록 불러오는 중…</div>
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
                {selectedFolderId === "public" && publicSession && (
                  <div
                    className={styles.item + " " + styles.itemAdd}
                    onClick={() => setAddChoiceModalOpen(true)}
                    title="추가"
                  >
                    <FilePlus size={32} />
                    <span>추가</span>
                  </div>
                )}
                {selectedSession && selectedFolderId !== "public" && (
                  <div
                    className={styles.item + " " + styles.itemAdd}
                    onClick={() => openUploadModal(selectedSession.session.id)}
                    title="영상 추가"
                  >
                    <FilePlus size={32} />
                    <span>추가</span>
                  </div>
                )}
                {videos.map((v) => (
                  <div key={v.id} className={styles.item} onClick={() => openVideoDetail(v)}>
                    <VideoThumbnail
                      title={v.title}
                      status={v.status ?? "PENDING"}
                      thumbnail_url={v.thumbnail_url}
                    />
                    <span className={styles.itemLabel} title={v.title}>
                      {v.title || "—"}
                    </span>
                    <span className={styles.itemMeta}>{formatDate(v.created_at)}</span>
                    <VideoStatusBadge status={v.status ?? "PENDING"} />
                  </div>
                ))}
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

      {newFolderOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            setNewFolderOpen(false);
            setNewFolderName("");
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-bg-surface)",
              padding: "var(--space-4)",
              borderRadius: "var(--radius-lg)",
              minWidth: 300,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: "var(--space-3)" }}>
              <h3 style={{ margin: 0, marginBottom: "var(--space-2)" }}>새 폴더</h3>
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
                placeholder="폴더 이름"
                autoFocus
                style={{
                  width: "100%",
                  padding: "var(--space-2)",
                  border: "1px solid var(--color-border-divider)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
              <Button intent="secondary" size="sm" onClick={() => {
                setNewFolderOpen(false);
                setNewFolderName("");
              }}>
                취소
              </Button>
              <Button intent="primary" size="sm" onClick={handleCreateFolder}>
                생성
              </Button>
            </div>
          </div>
        </div>
      )}
    </DomainLayout>
  );
}
