// PATH: src/app_teacher/domains/videos/pages/VideoListPage.tsx
// 영상 목록 — 검색·상태필터·정렬 + 인코딩 상태/시청 현황
import { useState, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Upload, Trash2 } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { fetchVideos, retryVideo, uploadInit, uploadComplete, deleteVideo, fetchPublicSession } from "../api";

type VideoStatus = "pending" | "processing" | "completed" | "failed";
type StatusFilter = "all" | VideoStatus;
type SortKey = "recent" | "title" | "views";

const STATUS_MAP: Record<VideoStatus, { label: string; color: string; bg: string }> = {
  completed: { label: "시청 가능", color: "var(--tc-success)", bg: "var(--tc-success-bg)" },
  processing: { label: "처리 중", color: "var(--tc-warn)", bg: "var(--tc-warn-bg)" },
  pending: { label: "처리 대기", color: "var(--tc-text-muted)", bg: "var(--tc-surface-soft)" },
  failed: { label: "처리 실패", color: "var(--tc-danger)", bg: "var(--tc-danger-bg)" },
};

const STATUS_FILTER_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "processing", label: "처리 중" },
  { key: "completed", label: "시청 가능" },
  { key: "failed", label: "실패" },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "recent", label: "최신순" },
  { key: "title", label: "제목순" },
  { key: "views", label: "조회순" },
];

function isValidStatusFilter(v: string | null): v is StatusFilter {
  return v === "all" || v === "pending" || v === "processing" || v === "completed" || v === "failed";
}

export default function VideoListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const initialStatus = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    isValidStatusFilter(initialStatus) ? initialStatus : "all"
  );
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const { data: videos, isLoading } = useQuery({
    queryKey: ["teacher-videos"],
    queryFn: () => fetchVideos(),
    staleTime: 30_000,
  });

  const retryMut = useMutation({
    mutationFn: retryVideo,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-videos"] }); teacherToast.success("다시 시도 요청을 보냈습니다."); },
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
      if (!pub) { teacherToast.error("업로드 세션을 찾을 수 없습니다."); return; }
      const init = await uploadInit({ session: pub.session_id, title: file.name.replace(/\.[^.]+$/, ""), filename: file.name, content_type: file.type || "video/mp4" });
      await fetch(init.upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "video/mp4" } });
      await uploadComplete(init.id);
      qc.invalidateQueries({ queryKey: ["teacher-videos"] });
      teacherToast.success("업로드 완료. 처리는 잠시 후 시작됩니다.");
    } catch {
      teacherToast.error("업로드에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // 필터·검색·정렬 적용
  const visibleVideos = useMemo(() => {
    if (!videos) return [];
    const q = query.trim().toLowerCase();
    const filtered = videos.filter((v: any) => {
      if (statusFilter !== "all" && (v.status ?? "pending") !== statusFilter) return false;
      if (q && !(v.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sortKey === "title") {
      sorted.sort((a: any, b: any) => (a.title || "").localeCompare(b.title || "", "ko"));
    } else if (sortKey === "views") {
      sorted.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0));
    } else {
      sorted.sort((a: any, b: any) => {
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bd - ad;
      });
    }
    return sorted;
  }, [videos, query, statusFilter, sortKey]);

  // 상태별 카운트 (필터 칩에 표시)
  const statusCount = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    (videos || []).forEach((v: any) => {
      const s: VideoStatus = v.status ?? "pending";
      c.all += 1;
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [videos]);

  const total = videos?.length ?? 0;
  const filteredCount = visibleVideos.length;
  const isEmpty = !isLoading && total === 0;
  const isFilteredEmpty = !isLoading && total > 0 && filteredCount === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold py-1" style={{ color: "var(--tc-text)" }}>영상</h2>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: uploading ? 0.5 : 1, minHeight: 36 }}>
          <Upload size={14} /> {uploading ? "업로드 중…" : "영상 업로드"}
        </button>
        <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} style={{ display: "none" }} />
      </div>

      {/* 검색 + 정렬 */}
      {!isEmpty && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목으로 검색"
              aria-label="영상 제목 검색"
              className="flex-1 text-[13px]"
              style={{
                padding: "8px 12px",
                borderRadius: "var(--tc-radius)",
                border: "1px solid var(--tc-border)",
                background: "var(--tc-surface)",
                color: "var(--tc-text)",
                minHeight: 36,
              }}
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="정렬"
              className="text-[12px] font-semibold"
              style={{
                padding: "8px 10px",
                borderRadius: "var(--tc-radius)",
                border: "1px solid var(--tc-border)",
                background: "var(--tc-surface)",
                color: "var(--tc-text)",
                minHeight: 36,
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* 상태 칩 */}
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ paddingBottom: 2 }}>
            {STATUS_FILTER_OPTIONS.map((opt) => {
              const active = statusFilter === opt.key;
              const count = statusCount[opt.key] ?? 0;
              return (
                <button
                  key={opt.key}
                  onClick={() => setStatusFilter(opt.key)}
                  className="text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: active ? "1px solid var(--tc-primary)" : "1px solid var(--tc-border)",
                    background: active ? "var(--tc-primary)" : "var(--tc-surface)",
                    color: active ? "#fff" : "var(--tc-text-muted)",
                    minHeight: 30,
                  }}
                  aria-pressed={active}
                >
                  {opt.label} {count > 0 ? `· ${count}` : ""}
                </button>
              );
            })}
          </div>
        </>
      )}

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : isEmpty ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="등록된 영상이 없습니다"
          description="우상단 '영상 업로드'를 눌러 첫 영상을 추가해 보세요."
        />
      ) : isFilteredEmpty ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="조건에 맞는 영상이 없습니다"
          description={query ? `'${query}' 검색 결과가 없어요. 검색어 또는 필터를 바꿔 보세요.` : "필터를 '전체'로 바꿔 보세요."}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleVideos.map((v: any) => {
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
                        className="text-[11px] font-semibold px-2 py-1 rounded cursor-pointer"
                        style={{
                          color: "var(--tc-danger)",
                          background: "var(--tc-danger-bg)",
                          border: "none",
                          minHeight: 28,
                        }}
                      >
                        다시 시도
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm("이 영상을 삭제하시겠습니까?")) deleteMut.mutate(v.id); }}
                      className="flex items-center text-[11px] cursor-pointer ml-auto"
                      style={{ background: "none", border: "none", color: "var(--tc-text-muted)", padding: "6px", minWidth: 28, minHeight: 28 }}
                      aria-label="영상 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
