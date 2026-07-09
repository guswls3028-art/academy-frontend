/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/videos/pages/VideoListPage.tsx
// 영상 목록 — 검색·상태필터·정렬 + 인코딩 상태/시청 현황
import { useState, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { Link2, Upload, Trash2, Youtube } from "@teacher/shared/ui/Icons";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import { extractYouTubeVideoId, isYouTubeSource, youtubeThumbnailUrl } from "@/shared/media/video/youtube";
import { fetchVideos, retryVideo, uploadInit, uploadComplete, deleteVideo, fetchPublicSession, createYoutubeVideo } from "../api";
import { teacherVideoQueryKeys } from "../queryKeys";
import { VIDEO_STATUS_LABEL, type VideoStatus } from "@/shared/api/contracts/videos";

type StatusFilter = "all" | VideoStatus;
type SortKey = "recent" | "title" | "views";

const STATUS_COLOR: Record<VideoStatus, { color: string; bg: string }> = {
  READY: { color: "var(--tc-success)", bg: "var(--tc-success-bg)" },
  PROCESSING: { color: "var(--tc-warn)", bg: "var(--tc-warn-bg)" },
  PENDING: { color: "var(--tc-text-muted)", bg: "var(--tc-surface-soft)" },
  UPLOADED: { color: "var(--tc-text-muted)", bg: "var(--tc-surface-soft)" },
  FAILED: { color: "var(--tc-danger)", bg: "var(--tc-danger-bg)" },
};

const STATUS_FILTER_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "PROCESSING", label: "처리 중" },
  { key: "READY", label: "시청 가능" },
  { key: "FAILED", label: "실패" },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "recent", label: "최신순" },
  { key: "title", label: "제목순" },
  { key: "views", label: "조회순" },
];

function isValidStatusFilter(v: string | null): v is StatusFilter {
  if (v == null) return false;
  // URL param 호환: 소문자 alias 도 허용 (이전 deep link 보존). 단 내부 상태는 uppercase로 통일.
  const upper = v.toUpperCase();
  return v === "all" || upper === "PENDING" || upper === "UPLOADED" || upper === "PROCESSING" || upper === "READY" || upper === "FAILED";
}

function normalizeStatusFilter(v: string | null): StatusFilter {
  if (!v) return "all";
  if (v === "all") return "all";
  const upper = v.toUpperCase();
  if (upper === "PENDING" || upper === "UPLOADED" || upper === "PROCESSING" || upper === "READY" || upper === "FAILED") {
    return upper as StatusFilter;
  }
  // 과거 소문자 alias 매핑: completed → READY
  if (v === "completed") return "READY";
  return "all";
}

export default function VideoListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const initialStatus = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    isValidStatusFilter(initialStatus) ? normalizeStatusFilter(initialStatus) : "all"
  );
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const { data: videos, isLoading } = useQuery({
    queryKey: teacherVideoQueryKeys.list,
    queryFn: () => fetchVideos(),
    staleTime: 30_000,
  });

  const retryMut = useMutation({
    mutationFn: retryVideo,
    onSuccess: () => { qc.invalidateQueries({ queryKey: teacherVideoQueryKeys.list }); teacherToast.success("다시 시도 요청을 보냈습니다."); },
    onError: (e) => teacherToast.error(extractApiError(e, "재시도 요청에 실패했습니다.")),
  });

  const deleteMut = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => { qc.invalidateQueries({ queryKey: teacherVideoQueryKeys.list }); teacherToast.info("영상이 삭제되었습니다."); },
    onError: (e) => teacherToast.error(extractApiError(e, "영상을 삭제하지 못했습니다.")),
  });

  const youtubeMut = useMutation({
    mutationFn: async () => {
      const title = youtubeTitle.trim();
      const url = youtubeUrl.trim();
      if (!title || !extractYouTubeVideoId(url)) {
        throw new Error("YouTube 링크와 제목을 확인해 주세요.");
      }
      const pub = await fetchPublicSession();
      if (!pub) throw new Error("링크를 등록할 기본 영상 세션을 찾을 수 없습니다.");
      return createYoutubeVideo({
        session: pub.session_id,
        title,
        url,
        allow_skip: false,
        max_speed: 1,
        show_watermark: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherVideoQueryKeys.list });
      setYoutubeOpen(false);
      setYoutubeTitle("");
      setYoutubeUrl("");
      teacherToast.success("YouTube 링크 영상을 추가했습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "YouTube 링크 추가에 실패했습니다.")),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const pub = await fetchPublicSession();
      if (!pub) { teacherToast.error("업로드 세션을 찾을 수 없습니다."); return; }
      const init = await uploadInit({ session: pub.session_id, title: file.name.replace(/\.[^.]+$/, ""), filename: file.name, content_type: file.type || "video/mp4" });
      const put = await fetch(init.upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "video/mp4" } });
      if (!put.ok) throw new Error(`video_upload_put_failed_${put.status}`);
      await uploadComplete(init.id);
      qc.invalidateQueries({ queryKey: teacherVideoQueryKeys.list });
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
      if (statusFilter !== "all" && (v.status ?? "PENDING") !== statusFilter) return false;
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
    const c: Record<StatusFilter, number> = { all: 0, PENDING: 0, UPLOADED: 0, PROCESSING: 0, READY: 0, FAILED: 0 };
    (videos || []).forEach((v: any) => {
      const raw = (v.status ?? "PENDING") as string;
      const s = (VIDEO_STATUS_LABEL[raw as VideoStatus] ? raw : "PENDING") as VideoStatus;
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-[17px] font-bold py-1" style={{ color: "var(--tc-text)" }}>영상</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setYoutubeOpen(true)}
            disabled={youtubeMut.isPending}
            className="flex items-center gap-1 text-xs font-bold cursor-pointer whitespace-nowrap"
            style={{ padding: "8px 11px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text)", opacity: youtubeMut.isPending ? 0.5 : 1, minHeight: 36 }}
          >
            <Youtube size={ICON.xs} /> 링크 추가
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1 text-xs font-bold cursor-pointer whitespace-nowrap"
            style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: uploading ? 0.5 : 1, minHeight: 36 }}>
            <Upload size={ICON.xs} /> {uploading ? "업로드 중…" : "영상 업로드"}
          </button>
        </div>
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
          description="YouTube 링크를 붙이거나 파일을 업로드해 첫 영상을 추가하세요."
          actions={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <EmptyActionButton onClick={() => setYoutubeOpen(true)}>
                링크 추가
              </EmptyActionButton>
              <EmptyActionButton variant="secondary" onClick={() => fileRef.current?.click()}>
                영상 업로드
              </EmptyActionButton>
            </div>
          }
        />
      ) : isFilteredEmpty ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="조건에 맞는 영상이 없습니다"
          description={query ? `'${query}' 검색 결과가 없어요. 검색어 또는 필터를 바꿔 보세요.` : "필터를 '전체'로 바꿔 보세요."}
          actions={
            <EmptyActionButton
              variant="secondary"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
            >
              조건 초기화
            </EmptyActionButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleVideos.map((v: any) => {
            const rawStatus = (v.status ?? "PENDING") as string;
            const status: VideoStatus = (VIDEO_STATUS_LABEL[rawStatus as VideoStatus] ? rawStatus : "PENDING") as VideoStatus;
            const st = { label: VIDEO_STATUS_LABEL[status], ...STATUS_COLOR[status] };
            const isYoutube = isYouTubeSource(v.source_type);
            const youtubeId = v.youtube_video_id || extractYouTubeVideoId(v.youtube_url);
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
                    overflow: "hidden",
                  }}
                >
                  {isYoutube && youtubeId ? (
                    <img src={youtubeThumbnailUrl(youtubeId)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <VideoIcon />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <button
                    onClick={() => status === "READY" && navigate(`/teacher/videos/${v.id}`)}
                    className="ds-text-name font-semibold text-left truncate cursor-pointer"
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
                    {isYoutube && <span>YouTube 링크</span>}
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
                    {v.view_count != null && status === "READY" && (
                      <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                        {v.view_count}명 시청
                      </span>
                    )}
                    {status === "FAILED" && (
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
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirm({ title: "영상 삭제", message: "이 영상을 삭제하시겠습니까? 학생 시청 기록과 진도 데이터도 함께 삭제됩니다.", confirmText: "삭제", danger: true });
                        if (ok) deleteMut.mutate(v.id);
                      }}
                      className="flex items-center text-[11px] cursor-pointer ml-auto"
                      style={{ background: "none", border: "none", color: "var(--tc-text-muted)", padding: "6px", minWidth: 28, minHeight: 28 }}
                      aria-label="영상 삭제"
                    >
                      <Trash2 size={ICON.xs} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <YoutubeLinkSheet
        open={youtubeOpen}
        title={youtubeTitle}
        url={youtubeUrl}
        submitting={youtubeMut.isPending}
        onTitleChange={setYoutubeTitle}
        onUrlChange={setYoutubeUrl}
        onClose={() => {
          if (!youtubeMut.isPending) setYoutubeOpen(false);
        }}
        onSubmit={() => youtubeMut.mutate()}
      />
    </div>
  );
}

function YoutubeLinkSheet({
  open,
  title,
  url,
  submitting,
  onTitleChange,
  onUrlChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  url: string;
  submitting: boolean;
  onTitleChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const youtubeId = useMemo(() => extractYouTubeVideoId(url), [url]);
  const canSubmit = title.trim().length > 0 && !!youtubeId && !submitting;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: "rgba(15,23,42,0.42)" }} onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-youtube-link-title"
        className="w-full"
        style={{ maxWidth: 520, background: "var(--tc-surface)", borderRadius: "18px 18px 0 0", border: "1px solid var(--tc-border)", padding: 18, boxShadow: "0 -14px 40px rgba(15,23,42,0.2)" }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Youtube size={ICON.sm} />
          <div id="teacher-youtube-link-title" className="text-[16px] font-bold" style={{ color: "var(--tc-text)" }}>
            YouTube 링크 추가
          </div>
        </div>

        <label className="block mb-3">
          <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--tc-text-muted)" }}>영상 제목</span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="예: 오늘 수업 해설 영상"
            className="w-full text-sm"
            style={{ padding: "10px 12px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text)" }}
            autoFocus
          />
        </label>

        <label className="block mb-3">
          <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--tc-text-muted)" }}>YouTube URL</span>
          <div className="flex items-center gap-2" style={{ padding: "0 10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)" }}>
            <Link2 size={ICON.xs} style={{ color: "var(--tc-text-muted)" }} />
            <input
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://youtu.be/..."
              className="flex-1 text-sm"
              style={{ padding: "10px 0", border: "none", outline: "none", background: "transparent", color: "var(--tc-text)" }}
            />
          </div>
        </label>

        {youtubeId ? (
          <div className="flex items-center gap-3 mb-4 rounded-lg" style={{ padding: 10, background: "var(--tc-surface-soft)", border: "1px solid var(--tc-border)" }}>
            <img src={youtubeThumbnailUrl(youtubeId)} alt="" style={{ width: 92, height: 52, objectFit: "cover", borderRadius: 8 }} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>링크 확인됨</div>
              <div className="text-[11px] truncate" style={{ color: "var(--tc-text-muted)" }}>{youtubeId}</div>
            </div>
          </div>
        ) : url.trim() ? (
          <div className="text-[12px] mb-4" style={{ color: "var(--tc-danger)" }}>
            올바른 YouTube 영상 링크를 입력해 주세요.
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm font-semibold cursor-pointer"
            style={{ padding: "9px 13px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-muted)", minHeight: 38 }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="text-sm font-bold cursor-pointer"
            style={{ padding: "9px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: canSubmit ? 1 : 0.5, minHeight: 38 }}
          >
            {submitting ? "추가 중…" : "링크 추가"}
          </button>
        </div>
      </form>
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
