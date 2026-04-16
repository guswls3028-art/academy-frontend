// PATH: src/app_teacher/domains/videos/pages/VideoListPage.tsx
// 영상 목록 — 인코딩 상태, 시청 현황
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Upload, Trash2 } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { fetchVideos, retryVideo, uploadInit, uploadComplete, deleteVideo, fetchPublicSession } from "../api";

type VideoStatus = "pending" | "processing" | "completed" | "failed";

const STATUS_MAP: Record<VideoStatus, { label: string; color: string; bg: string }> = {
  completed: { label: "완료", color: "var(--tc-success)", bg: "var(--tc-success-bg)" },
  processing: { label: "인코딩 중", color: "var(--tc-warn)", bg: "var(--tc-warn-bg)" },
  pending: { label: "대기", color: "var(--tc-text-muted)", bg: "var(--tc-surface-soft)" },
  failed: { label: "실패", color: "var(--tc-danger)", bg: "var(--tc-danger-bg)" },
};

export default function VideoListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: videos, isLoading } = useQuery({
    queryKey: ["teacher-videos"],
    queryFn: () => fetchVideos(),
    staleTime: 30_000,
  });

  const retryMut = useMutation({
    mutationFn: retryVideo,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-videos"] }); teacherToast.success("인코딩 재시도가 요청되었습니다."); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-videos"] }); teacherToast.info("영상이 삭제되었습니다."); },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const pub = await fetchPublicSession();
      if (!pub) { alert("업로드 세션을 찾을 수 없습니다."); return; }
      const init = await uploadInit({ session: pub.session_id, title: file.name.replace(/\.[^.]+$/, ""), filename: file.name, content_type: file.type || "video/mp4" });
      // Upload to presigned URL
      await fetch(init.upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "video/mp4" } });
      await uploadComplete(init.id);
      qc.invalidateQueries({ queryKey: ["teacher-videos"] });
    } catch {
      alert("업로드 실패. 다시 시도해주세요.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold py-1" style={{ color: "var(--tc-text)" }}>영상</h2>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: uploading ? 0.5 : 1 }}>
          <Upload size={14} /> {uploading ? "업로드 중..." : "영상 업로드"}
        </button>
        <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} style={{ display: "none" }} />
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : videos && videos.length > 0 ? (
        <div className="flex flex-col gap-2">
          {videos.map((v: any) => {
            const status: VideoStatus = v.status ?? "pending";
            const st = STATUS_MAP[status] ?? STATUS_MAP.pending;
            return (
              <div
                key={v.id}
                className="flex gap-3 rounded-xl"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  background: "var(--tc-surface)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                {/* Thumbnail placeholder */}
                <div
                  className="shrink-0 rounded-lg flex items-center justify-center"
                  style={{
                    width: 64,
                    height: 48,
                    background: "var(--tc-surface-soft)",
                    border: "1px solid var(--tc-border)",
                  }}
                >
                  <VideoIcon />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <button
                    onClick={() => status === "completed" && navigate(`/teacher/videos/${v.id}`)}
                    className="text-[14px] font-semibold text-left truncate cursor-pointer"
                    style={{
                      color: "var(--tc-text)",
                      background: "none",
                      border: "none",
                      padding: 0,
                    }}
                  >
                    {v.title}
                  </button>
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
                    {v.duration_display && <span>{v.duration_display}</span>}
                    {v.created_at && (
                      <span>{new Date(v.created_at).toLocaleDateString("ko-KR")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ color: st.color, background: st.bg }}
                    >
                      {st.label}
                    </span>
                    {v.view_count != null && status === "completed" && (
                      <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                        {v.view_count}명 시청
                      </span>
                    )}
                    {status === "failed" && (
                      <button
                        onClick={() => retryMut.mutate(v.id)}
                        disabled={retryMut.isPending}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer"
                        style={{
                          color: "var(--tc-danger)",
                          background: "var(--tc-danger-bg)",
                          border: "none",
                        }}
                      >
                        재시도
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm("이 영상을 삭제하시겠습니까?")) deleteMut.mutate(v.id); }}
                      className="flex items-center text-[11px] cursor-pointer ml-auto"
                      style={{ background: "none", border: "none", color: "var(--tc-text-muted)", padding: "2px" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="등록된 영상이 없습니다" />
      )}
    </div>
  );
}

function VideoIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
