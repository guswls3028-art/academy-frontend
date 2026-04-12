// src/features/videos/components/VideoInfoCards.tsx

import dayjs from "dayjs";

type Props = {
  video: any;
  stats: any;
  memo: string;
  setMemo: (v: string) => void;
};

export default function VideoInfoCards({ video, stats, memo, setMemo }: Props) {
  const size = video.file_size
    ? (video.file_size / (1024 * 1024)).toFixed(1)
    : "-";

  const avg =
    stats?.avg_progress != null
      ? (stats.avg_progress * 100).toFixed(1) + "%"
      : "-";

  const created = video.created_at
    ? dayjs(video.created_at).format("YYYY-MM-DD HH:mm")
    : "-";

  const allowSkipLabel = video.allow_skip ? "허용" : "금지";
  const maxSpeedLabel = video.max_speed
    ? `${Number(video.max_speed).toFixed(2)}x`
    : "-";
  const watermarkLabel = video.show_watermark ? "표시" : "숨김";

  return (
    <div className="space-y-3 text-sm">
      {/* FILE INFO + STATS (compact) */}
      <div className="grid grid-cols-3 gap-3">
        
        {/* FILE INFO */}
        <div className="rounded border bg-white p-3 space-y-0.5">
          <div className="font-semibold text-xs mb-1">파일 정보</div>
          <div className="truncate">이름: {video.title}</div>
          <div>용량: {size}MB</div>
          <div>업로드: {created}</div>

          <div className="pt-1 text-[11px] text-gray-600 space-y-0.5">
            <div>건너뛰기: {allowSkipLabel}</div>
            <div>최대 배속: {maxSpeedLabel}</div>
            <div>워터마크: {watermarkLabel}</div>
          </div>
        </div>

        {/* STATS */}
        <div className="rounded border bg-white p-3 space-y-0.5">
          <div className="font-semibold text-xs mb-1">통계</div>
          <div>100% 완료: {stats?.completed_100 ?? 0}</div>
          <div>90%+ 완료: {stats?.completed_90 ?? 0}</div>
          <div>평균 진도율: {avg}</div>
        </div>

        {/* MEMO */}
        <div className="rounded border bg-white p-3 flex flex-col">
          <div className="font-semibold text-xs mb-1">메모</div>
          <textarea
            className="w-full border rounded px-2 py-1 text-xs flex-1"
            placeholder="메모..."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
