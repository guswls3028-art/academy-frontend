/**
 * 영상 (사이드바 첫 페이지) — 저장소/메시지/시험과 동일한 폴더트리형 SSOT
 * 전체공개영상(맨위) + 강의명 > 1~n차시 트리, 우측에 영상 그리드
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { FilePlus } from "lucide-react";
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
  type Video as ApiVideo,
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

const PUBLIC_LECTURE_TITLE = "전체공개영상";

export default function VideoExplorerPage() {
  const navigate = useNavigate();
  const [selectedFolderId, setSelectedFolderId] = useState<VideoFolderId>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTargetSessionId, setUploadTargetSessionId] = useState<number | null>(null);

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
    return lectures.map((lec, i) => {
      const sessions = (sessionQueries[i]?.data as Session[] | undefined) ?? [];
      return { ...lec, sessions: sortSessionsByDateDesc(sessions) };
    });
  }, [lectures, sessionQueries]);

  const { data: publicSession, isLoading: publicSessionLoading } = useQuery({
    queryKey: ["public-session"],
    queryFn: fetchPublicSession,
    enabled: selectedFolderId === "public",
  });

  const { data: sessionVideos = [], isLoading: sessionVideosLoading } = useQuery({
    queryKey: ["session-videos", selectedFolderId],
    queryFn: () => fetchSessionVideos(selectedFolderId as number),
    enabled: typeof selectedFolderId === "number",
  });

  const { data: publicVideos = [], isLoading: publicVideosLoading } = useQuery({
    queryKey: ["session-videos", publicSession?.session_id],
    queryFn: () => fetchSessionVideos(publicSession!.session_id),
    enabled: selectedFolderId === "public" && !!publicSession?.session_id,
  });

  const videos = selectedFolderId === "public" ? publicVideos : sessionVideos;
  const videosLoading =
    selectedFolderId === "public" ? publicSessionLoading || publicVideosLoading : sessionVideosLoading;

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
    if (video.session_id && selectedSession) {
      navigate(
        `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}/videos/${video.id}`
      );
    } else {
      const lecWithSession = lecturesWithSessions.find((l) =>
        l.sessions.some((s) => s.id === video.session_id)
      );
      const sess = lecWithSession?.sessions.find((s) => s.id === video.session_id);
      if (lecWithSession && sess) {
        navigate(`/admin/lectures/${lecWithSession.id}/sessions/${sess.id}/videos/${video.id}`);
      }
    }
  };

  return (
    <DomainLayout
      title="영상"
      description="강의·차시 단위 영상을 관리합니다. 전체공개영상은 모든 영상을 한곳에서 조회합니다."
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
              currentFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
            />
          </aside>

          <div className={styles.gridWrap}>
            {isLoading ? (
              <div className={styles.placeholder}>불러오는 중…</div>
            ) : selectedFolderId === null ? (
              <div className={styles.placeholder}>좌측에서 폴더를 선택하세요</div>
            ) : videosLoading ? (
              <div className={styles.placeholder}>영상 목록 불러오는 중…</div>
            ) : videos.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
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
                      ? "강의 > 차시에서 영상을 업로드할 수 있습니다."
                      : "강의 > 해당 차시에서 영상을 추가해 주세요."
                  }
                  actions={
                    selectedSession && (
                      <Button
                        intent="primary"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}`
                          )
                        }
                      >
                        영상 추가
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <div className={styles.grid}>
                {selectedSession && (
                  <div
                    className={styles.item + " " + styles.itemAdd}
                    onClick={() =>
                      navigate(
                        `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}`
                      )
                    }
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
    </DomainLayout>
  );
}
