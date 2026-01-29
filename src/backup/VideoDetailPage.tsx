// src/features/videos/pages/VideoDetailPage.tsx

import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";

// ❌ Page / PageHeader 제거 (SessionLayout이 Page 단일 진실)
// import { Page, PageHeader } from "@/shared/ui/page";
import api from "@/shared/api/axios";

import StudentWatchPanel from "@/features/videos/components/StudentWatchPanel";
import PermissionModal from "@/features/videos/components/PermissionModal";
import ToggleSwitch from "@/features/videos/components/ToggleSwitch";
import { useVideoPolicy } from "@/features/videos/hooks/useVideoPolicy";

/* -------------------------------------------------- */
/* utils (unchanged) */
/* -------------------------------------------------- */
function formatBytes(bytes?: number | null) {
  if (bytes == null || Number.isNaN(Number(bytes))) return "-";
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "-";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}분 ${r}초` : `${r}초`;
}

function formatDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

/* -------------------------------------------------- */
/* Admin HLS Preview (unchanged) */
/* -------------------------------------------------- */
function AdminHlsPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    video.src = src;
  }, [src]);

  return (
    <div className="rounded-lg overflow-hidden bg-black shadow">
      <video
        ref={ref}
        controls
        autoPlay
        muted
        playsInline
        className="w-full max-h-[520px] object-contain"
        controlsList="nodownload noremoteplayback"
      />
    </div>
  );
}

type PreviewMode = "admin" | "student";

export default function VideoDetailPage() {
  const params = useParams();
  const lectureId = Number(params.lectureId);
  const sessionId = Number(params.sessionId);
  const videoId = Number(params.videoId);

  const [previewMode, setPreviewMode] = useState<PreviewMode>("admin");
  const [openPermission, setOpenPermission] = useState(false);
  const [memo, setMemo] = useState("");

  /* ---------------- Fetch ---------------- */
  const { data, isLoading } = useQuery({
    queryKey: ["video-stats", videoId],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/stats/`);
      return res.data;
    },
    enabled: !!videoId,
  });

  const video = data?.video;
  const students = data?.students ?? [];
  const hlsSrc = video?.hls_url ?? null;

  /* ---------------- Policy (A-2 핵심) ---------------- */
  const {
    policy,
    dirty,
    canSave,
    setAllowSkip,
    setMaxSpeed,
    setShowWatermark,
    save,
  } = useVideoPolicy({
    videoId,
    initial: video
      ? {
          allow_skip: video.allow_skip,
          max_speed: video.max_speed,
          show_watermark: video.show_watermark,
        }
      : null,
  });

  // ❌ Page 제거 → SessionLayout에서 로딩/가드 담당
  if (isLoading || !video) return <div className="text-sm">로딩중…</div>;

  return (
    <>
      {/* ================= Header ================= */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{video.title}</h2>

        {/* ✅ admin prefix 보정 (Session Hub 기준) */}
        <Link
          to={`/admin/lectures/${lectureId}/sessions/${sessionId}`}
          className="rounded border px-3 py-1.5 text-sm"
        >
          출석 화면으로
        </Link>
      </div>

      <div className="mt-6 flex gap-6">
        {/* LEFT */}
        <div className="w-[720px] space-y-4">
          {/* Preview Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode("admin")}
              className={`rounded border px-3 py-1 text-xs ${
                previewMode === "admin"
                  ? "bg-white font-semibold"
                  : "bg-gray-100"
              }`}
            >
              관리자 미리보기
            </button>
            <button
              onClick={() => setPreviewMode("student")}
              className={`rounded border px-3 py-1 text-xs ${
                previewMode === "student"
                  ? "bg-white font-semibold"
                  : "bg-gray-100"
              }`}
            >
              학생 페이지로 보기
            </button>
          </div>

          {/* Player */}
          {previewMode === "admin" && hlsSrc ? (
            <AdminHlsPreview src={hlsSrc} />
          ) : (
            <div className="border p-4 text-sm">HLS 없음</div>
          )}

          {/* Policy Editor */}
          <div className="space-y-3 rounded border bg-white p-4">
            <div className="text-sm font-semibold">
              학생 시청 정책{" "}
              <span className="text-gray-400">(저장 후 반영)</span>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <label className="flex items-center gap-2">
                워터마크
                <ToggleSwitch
                  checked={policy.show_watermark}
                  onChange={setShowWatermark}
                />
              </label>

              <label className="flex items-center gap-2">
                건너뛰기
                <ToggleSwitch
                  checked={policy.allow_skip}
                  onChange={setAllowSkip}
                />
              </label>

              <label className="flex items-center gap-2">
                최대 배속
                <input
                  type="number"
                  step={0.25}
                  min={0.25}
                  max={5}
                  value={policy.max_speed}
                  onChange={(e) =>
                    setMaxSpeed(Number(e.target.value))
                  }
                  className="w-20 rounded border px-2 py-1"
                />
                {policy.max_speed.toFixed(2)}x
              </label>

              <button
                onClick={() => save()}
                disabled={!canSave}
                className="ml-auto rounded bg-blue-600 px-4 py-1.5 text-xs text-white disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>

          {/* Info Cards (unchanged) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 rounded border bg-white p-3 text-sm">
              <div className="font-semibold">파일 기본 정보</div>
              <div className="text-xs">
                <div>상태: {video.status}</div>
                <div>길이: {formatDuration(video.duration)}</div>
                <div>업로드: {formatDateTime(video.created_at)}</div>
                <div>용량: {formatBytes((video as any)?.size_bytes)}</div>
              </div>
            </div>

            <div className="space-y-2 rounded border bg-white p-3 text-sm">
              <div className="font-semibold">현재 적용 정책</div>
              <div className="text-xs">
                워터마크: {video.show_watermark ? "ON" : "OFF"}
                <br />
                건너뛰기: {video.allow_skip ? "허용" : "차단"}
                <br />
                최대 배속: {Number(video.max_speed).toFixed(2)}x
              </div>

              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="h-20 w-full rounded border p-2 text-xs"
                placeholder="관리자 메모"
              />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <StudentWatchPanel
          students={students}
          selectedEnrollmentId={null}
          onSelectPreviewStudent={() => {}}
          onOpenPermission={() => setOpenPermission(true)}
        />
      </div>

      <PermissionModal
        open={openPermission}
        onClose={() => setOpenPermission(false)}
        videoId={videoId}
      />
    </>
  );
}
