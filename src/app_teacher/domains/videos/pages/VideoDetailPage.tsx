// PATH: src/app_teacher/domains/videos/pages/VideoDetailPage.tsx
// 영상 상세 — 시청 통계 + 학생별 현황
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchVideoDetail, fetchVideoStats } from "../api";

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const vid = Number(videoId);

  const { data: video, isLoading: loadingVideo } = useQuery({
    queryKey: ["teacher-video", vid],
    queryFn: () => fetchVideoDetail(vid),
    enabled: Number.isFinite(vid),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["teacher-video-stats", vid],
    queryFn: () => fetchVideoStats(vid),
    enabled: Number.isFinite(vid),
  });

  if (loadingVideo || loadingStats)
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!video)
    return <EmptyState scope="panel" tone="error" title="영상을 찾을 수 없습니다" />;

  const students = Array.isArray(stats?.students) ? stats.students : [];
  const watched = students.filter((s: any) => s.watched || s.progress >= 80);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {video.title}
        </h1>
      </div>

      {/* Video Info */}
      <div
        className="rounded-xl flex flex-col gap-2"
        style={{ padding: "var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        {video.duration_display && (
          <InfoRow label="재생시간" value={video.duration_display} />
        )}
        <InfoRow
          label="업로드"
          value={video.created_at ? new Date(video.created_at).toLocaleDateString("ko-KR") : "-"}
        />
        <InfoRow label="시청" value={`${watched.length} / ${students.length}명`} />
      </div>

      {/* Students */}
      {students.length > 0 && (
        <div
          className="rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--tc-text)" }}>학생별 시청 현황</h3>
          <div className="flex flex-col gap-1">
            {students.map((s: any) => {
              const pct = Math.round(s.progress ?? 0);
              const done = pct >= 80;
              return (
                <div key={s.student_id ?? s.id} className="flex justify-between items-center py-2 border-b last:border-b-0" style={{ borderColor: "var(--tc-border)" }}>
                  <span className="text-sm" style={{ color: "var(--tc-text)" }}>
                    {s.student_name ?? s.name ?? "이름 없음"}
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: done ? "var(--tc-success)" : "var(--tc-text-muted)" }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {students.length === 0 && (
        <EmptyState scope="panel" tone="empty" title="시청 기록이 없습니다" />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--tc-text-muted)" }}>{label}</span>
      <span style={{ color: "var(--tc-text)" }}>{value}</span>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex p-1 cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
