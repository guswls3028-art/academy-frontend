// PATH: src/features/videos/components/features/video-detail/components/VideoInfoSection.tsx

interface Props {
  video: any;
  memo: string;
  setMemo: (v: string) => void;
}

export default function VideoInfoSection({ video, memo, setMemo }: Props) {
  const formatBytes = (b?: number) =>
    b ? `${(b / 1024 / 1024).toFixed(1)} MB` : "-";

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* FILE INFO */}
      <div className="bg-[var(--bg-surface-soft)] rounded-lg p-4 text-sm space-y-1">
        <div className="font-medium text-[var(--text-primary)]">
          파일 기본 정보
        </div>

        <div className="text-xs text-[var(--text-secondary)]">
          <div>상태: {video.status}</div>
          <div>길이: {video.duration ?? "-"}</div>
          <div>업로드: {video.created_at}</div>
          <div>용량: {formatBytes(video.file_size)}</div>
        </div>
      </div>

      {/* POLICY SNAPSHOT + MEMO */}
      <div className="bg-[var(--bg-surface-soft)] rounded-lg p-4 text-sm space-y-2">
        <div className="font-medium text-[var(--text-primary)]">
          현재 적용 정책
        </div>

        <div className="text-xs text-[var(--text-secondary)]">
          워터마크: {video.show_watermark ? "ON" : "OFF"}
          <br />
          건너뛰기: {video.allow_skip ? "허용" : "차단"}
          <br />
          최대 배속: {Number(video.max_speed).toFixed(2)}x
        </div>

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="h-20 w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] p-2 text-xs"
          placeholder="관리자 메모"
        />
      </div>
    </div>
  );
}
