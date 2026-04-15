// PATH: src/app_teacher/domains/videos/pages/VideoDetailPage.tsx
// 영상 상세 — 시청 통계 + 댓글
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Send } from "@teacher/shared/ui/Icons";
import { BackButton, Card, TabBar, KpiCard } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchVideoDetail, fetchVideoStats } from "../api";
import api from "@/shared/api/axios";

type Tab = "stats" | "comments";

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const vid = Number(videoId);
  const [tab, setTab] = useState<Tab>("stats");

  const { data: video, isLoading: loadingVideo } = useQuery({
    queryKey: ["teacher-video", vid],
    queryFn: () => fetchVideoDetail(vid),
    enabled: Number.isFinite(vid),
  });

  const { data: stats } = useQuery({
    queryKey: ["teacher-video-stats", vid],
    queryFn: () => fetchVideoStats(vid),
    enabled: Number.isFinite(vid),
  });

  const { data: comments } = useQuery({
    queryKey: ["teacher-video-comments", vid],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${vid}/comments/`);
      const raw = res.data;
      return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
    },
    enabled: Number.isFinite(vid) && tab === "comments",
  });

  if (loadingVideo)
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!video)
    return <EmptyState scope="panel" tone="error" title="영상을 찾을 수 없습니다" />;

  const students = Array.isArray(stats?.students) ? stats.students : [];
  const watched = students.filter((s: any) => s.watched || s.progress >= 80);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {video.title}
        </h1>
      </div>

      {/* Info */}
      <Card>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--tc-text-muted)" }}>재생시간</span>
          <span style={{ color: "var(--tc-text)" }}>{video.duration_display ?? "-"}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span style={{ color: "var(--tc-text-muted)" }}>업로드</span>
          <span style={{ color: "var(--tc-text)" }}>{video.created_at ? new Date(video.created_at).toLocaleDateString("ko-KR") : "-"}</span>
        </div>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label="전체" value={students.length} sub="명" />
        <KpiCard label="시청 완료" value={watched.length} color="var(--tc-success)" />
        <KpiCard label="시청률" value={students.length > 0 ? `${Math.round((watched.length / students.length) * 100)}%` : "-"} />
      </div>

      {/* Tabs */}
      <TabBar
        tabs={[
          { key: "stats" as Tab, label: `학생 현황 (${students.length})` },
          { key: "comments" as Tab, label: `댓글 (${comments?.length ?? "…"})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Students tab */}
      {tab === "stats" && (
        students.length > 0 ? (
          <div className="flex flex-col gap-1">
            {students.map((s: any) => {
              const pct = Math.round(s.progress ?? 0);
              const done = pct >= 80;
              return (
                <div key={s.student_id ?? s.id} className="flex justify-between items-center py-2 px-1 border-b last:border-b-0" style={{ borderColor: "var(--tc-border)" }}>
                  <span className="text-sm" style={{ color: "var(--tc-text)" }}>{s.student_name ?? s.name ?? "이름 없음"}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--tc-border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: done ? "var(--tc-success)" : "var(--tc-primary)" }} />
                    </div>
                    <span className="text-xs font-semibold w-8 text-right" style={{ color: done ? "var(--tc-success)" : "var(--tc-text-muted)" }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState scope="panel" tone="empty" title="시청 기록이 없습니다" />
        )
      )}

      {/* Comments tab */}
      {tab === "comments" && <CommentSection videoId={vid} comments={comments ?? []} />}
    </div>
  );
}

function CommentSection({ videoId, comments }: { videoId: number; comments: any[] }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const createMut = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/media/videos/${videoId}/comments/`, { content });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-video-comments", videoId] });
      setText("");
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Comment input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="댓글 입력..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) createMut.mutate(text.trim()); }}
          className="flex-1 text-sm rounded-lg outline-none"
          style={{ padding: "8px 12px", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text)" }}
        />
        <button
          onClick={() => text.trim() && createMut.mutate(text.trim())}
          disabled={!text.trim() || createMut.isPending}
          className="flex items-center justify-center shrink-0 cursor-pointer rounded-lg"
          style={{ width: 36, height: 36, background: "var(--tc-primary)", color: "#fff", border: "none" }}
        >
          <Send size={16} />
        </button>
      </div>

      {/* Comment list */}
      {comments.length > 0 ? (
        <div className="flex flex-col gap-2">
          {comments.map((c: any) => (
            <Card key={c.id} style={{ padding: "var(--tc-space-3)" }}>
              <div className="flex justify-between items-start">
                <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
                  {c.author_display_name ?? c.created_by_name ?? "작성자"}
                </span>
                <span className="text-[10px]" style={{ color: "var(--tc-text-muted)" }}>
                  {c.created_at ? new Date(c.created_at).toLocaleDateString("ko-KR") : ""}
                </span>
              </div>
              <p className="text-sm m-0 mt-1" style={{ color: "var(--tc-text-secondary)", whiteSpace: "pre-wrap" }}>
                {c.content}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="댓글이 없습니다" />
      )}
    </div>
  );
}
