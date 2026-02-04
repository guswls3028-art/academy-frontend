// PATH: C:\academyfront\src\student\domains\media\pages\MediaPlayerPage.tsx
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import StudentPageShell from "@/student/shared/components/StudentPageShell";
import EmptyState from "@/student/shared/components/EmptyState";

import {
  fetchStudentSessionVideos,
  fetchStudentVideoPlayback,
  StudentVideoListItem,
} from "@/student/domains/media/api/media";

import StudentVideoPlayer from
  "@student/domains/media/playback/player/StudentVideoPlayer";

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const bg =
    tone === "danger" ? "#ffecec" : tone === "warn" ? "#fff6e5" : "#e8fff0";
  const color =
    tone === "danger" ? "#b10000" : tone === "warn" ? "#a06100" : "#0a7a38";

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {children}
    </span>
  );
}

export default function MediaPlayerPage() {
  const [sp] = useSearchParams();
  const sessionId = Number(sp.get("session"));

  // enrollmentId가 필요하면 여기서 query param으로도 받을 수 있게 확장 가능
  // (지금은 단일진실 위배 없이 optional)
  const enrollmentId: number | null = null;

  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);

  const listQ = useQuery({
    queryKey: ["student-session-videos", sessionId],
    queryFn: () => fetchStudentSessionVideos(sessionId, enrollmentId),
    enabled: Number.isFinite(sessionId),
    staleTime: 3000,
    retry: 1,
  });

  const videos: StudentVideoListItem[] = listQ.data?.items ?? [];

  const activeVideoId = useMemo(() => {
    if (selectedVideoId) return selectedVideoId;
    return videos.length ? videos[0].id : null;
  }, [selectedVideoId, videos]);

  const playbackQ = useQuery({
    queryKey: ["student-video-playback", activeVideoId],
    queryFn: () => fetchStudentVideoPlayback(activeVideoId!, enrollmentId),
    enabled: !!activeVideoId,
    staleTime: 2000,
    retry: 1,
  });

  if (!Number.isFinite(sessionId)) {
    return (
      <StudentPageShell title="영상" description="잘못된 접근입니다.">
        <EmptyState title="session 파라미터가 올바르지 않습니다." />
      </StudentPageShell>
    );
  }

  if (listQ.isLoading) {
    return (
      <StudentPageShell title="영상" description={`session: ${sessionId}`}>
        <div style={{ fontSize: 14, color: "#666" }}>불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (listQ.isError) {
    return (
      <StudentPageShell title="영상" description={`session: ${sessionId}`}>
        <EmptyState title="영상 목록을 불러오지 못했습니다." />
      </StudentPageShell>
    );
  }

  if (!videos.length) {
    return (
      <StudentPageShell title="영상" description={`session: ${sessionId}`}>
        <EmptyState title="세션에 영상이 없습니다." />
      </StudentPageShell>
    );
  }

  const p = playbackQ.data;
  const policy = p?.policy;

  return (
    <StudentPageShell
      title="영상"
      description={`session: ${sessionId} · videos: ${videos.length}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* ===== video select ===== */}
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>영상 목록</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {videos.map((v) => {
              const active = v.id === activeVideoId;
              const blocked = v.effective_rule === "blocked";

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVideoId(v.id)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: active ? "#111" : "#fafafa",
                    color: active ? "#fff" : "#111",
                    fontWeight: 800,
                    opacity: blocked ? 0.55 : 1,
                    cursor: "pointer",
                  }}
                  title={blocked ? "시청 제한" : "재생"}
                >
                  #{v.id} {v.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== policy snapshot (single truth) ===== */}
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>적용 정책(단일진실)</div>

          {!policy && playbackQ.isLoading && (
            <div style={{ fontSize: 13, color: "#666" }}>정책 불러오는 중...</div>
          )}

          {playbackQ.isError && (
            <div style={{ fontSize: 13, color: "#c00" }}>
              정책/재생 정보 조회 실패 (blocked면 403일 수 있음)
            </div>
          )}

          {policy && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {policy.effective_rule === "blocked" ? (
                <Pill tone="danger">권한: 제한</Pill>
              ) : policy.effective_rule === "once" ? (
                <Pill tone="warn">권한: 1회</Pill>
              ) : (
                <Pill tone="ok">권한: 무제한</Pill>
              )}

              <Pill tone="ok">워터마크: {policy.show_watermark ? "ON" : "OFF"}</Pill>
              <Pill tone="ok">건너뛰기: {policy.allow_skip ? "허용" : "차단"}</Pill>
              <Pill tone="ok">최대 배속: {Number(policy.max_speed ?? 1).toFixed(2)}x</Pill>
            </div>
          )}
        </div>

        {/* ===== real player ===== */}
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>재생</div>

          {/* ✅ blocked 등으로 playbackQ가 403이면 여기서 재생하지 않음 */}
          {playbackQ.isError ? (
            <EmptyState
              title="재생할 수 없습니다."
              description="권한이 제한되었거나(403) 영상이 준비되지 않았을 수 있습니다."
            />
          ) : activeVideoId ? (
            <StudentVideoPlayer
              videoId={activeVideoId}
              enrollmentId={enrollmentId ?? -1}
              previewMode="student"
            />
          ) : (
            <EmptyState title="선택된 영상이 없습니다." />
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}
