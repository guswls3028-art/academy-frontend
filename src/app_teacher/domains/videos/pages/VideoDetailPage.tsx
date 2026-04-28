// PATH: src/app_teacher/domains/videos/pages/VideoDetailPage.tsx
// 영상 상세 — 시청 통계 + 댓글
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Send, MoreVertical, Pencil, Trash2, Save, X } from "@teacher/shared/ui/Icons";
import { BackButton, Card, TabBar, KpiCard } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchVideoDetail, fetchVideoStats, renameVideo, updateVideo, deleteVideo } from "../api";
import VideoSettingsSheet from "../components/VideoSettingsSheet";
import api from "@/shared/api/axios";
import { teacherToast } from "@teacher/shared/ui/teacherToast";

type Tab = "stats" | "comments";

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const vid = Number(videoId);
  const [tab, setTab] = useState<Tab>("stats");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const renameMut = useMutation({
    mutationFn: () => renameVideo(vid, titleInput),
    onSuccess: () => { setEditingTitle(false); qc.invalidateQueries({ queryKey: ["teacher-video", vid] }); teacherToast.success("제목이 변경되었습니다."); },
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteVideo(vid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-videos"] }); teacherToast.info("영상이 삭제되었습니다."); navigate(-1); },
  });

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
  // backend progress: 0~1 float. 80% 이상이면 시청 완료.
  const watched = students.filter((s: any) => s.watched || (s.progress ?? 0) >= 0.8);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        {editingTitle ? (
          <div className="flex items-center gap-1 flex-1">
            <input type="text" value={titleInput} onChange={(e) => setTitleInput(e.target.value)}
              className="flex-1 text-[15px] font-bold"
              style={{ padding: "4px 8px", border: "1px solid var(--tc-border-strong)", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
            <button onClick={() => renameMut.mutate()} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-primary)" }}><Save size={16} /></button>
            <button onClick={() => setEditingTitle(false)} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}><X size={16} /></button>
          </div>
        ) : (
          <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
            {video.title}
          </h1>
        )}
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex p-1 cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 rounded-lg shadow-lg"
                style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", zIndex: 100, minWidth: 120 }}>
                <button onClick={() => { setTitleInput(video.title); setEditingTitle(true); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)" }}>
                  <Pencil size={14} /> 제목 변경
                </button>
                <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <MoreVertical size={14} /> 시청 설정
                </button>
                <button onClick={() => { if (confirm("이 영상을 삭제하시겠습니까?")) deleteMut.mutate(); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-danger)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <Trash2 size={14} /> 삭제
                </button>
              </div>
            </>
          )}
        </div>
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
              const pct = Math.round((s.progress ?? 0) * 100);
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

      {video && <VideoSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} video={video} />}
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
      teacherToast.success("댓글이 등록되었습니다.");
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
