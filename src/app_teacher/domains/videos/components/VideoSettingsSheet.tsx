// PATH: src/app_teacher/domains/videos/components/VideoSettingsSheet.tsx
// 영상 설정 시트 — 건너뛰기/배속/워터마크
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateVideo } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  video: any;
}

export default function VideoSettingsSheet({ open, onClose, video }: Props) {
  const qc = useQueryClient();
  const [allowSkip, setAllowSkip] = useState(video?.allow_skip ?? true);
  const [maxSpeed, setMaxSpeed] = useState(String(video?.max_speed ?? 2));
  const [showWatermark, setShowWatermark] = useState(video?.show_watermark ?? false);

  useEffect(() => {
    if (open && video) {
      setAllowSkip(video.allow_skip ?? true);
      setMaxSpeed(String(video.max_speed ?? 2));
      setShowWatermark(video.show_watermark ?? false);
    }
  }, [open, video]);

  const mutation = useMutation({
    mutationFn: () => updateVideo(video.id, {
      allow_skip: allowSkip,
      max_speed: Number(maxSpeed) || 2,
      show_watermark: showWatermark,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-video", video.id] });
      onClose();
    },
  });

  return (
    <BottomSheet open={open} onClose={onClose} title="영상 설정">
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
        <Toggle label="건너뛰기 허용" desc="학생이 영상을 건너뛸 수 있습니다" value={allowSkip} onChange={setAllowSkip} />
        <Toggle label="워터마크 표시" desc="학생 이름이 영상 위에 표시됩니다" value={showWatermark} onChange={setShowWatermark} />

        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>최대 배속</label>
          <div className="flex gap-2">
            {["1", "1.5", "2", "3"].map((s) => (
              <button key={s} type="button" onClick={() => setMaxSpeed(s)}
                className="flex-1 text-[12px] font-semibold cursor-pointer text-center"
                style={{
                  padding: "7px", borderRadius: "var(--tc-radius)",
                  border: maxSpeed === s ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
                  background: maxSpeed === s ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: maxSpeed === s ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                }}>
                {s}x
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          {mutation.isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </BottomSheet>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} type="button"
      className="flex items-center justify-between w-full text-left cursor-pointer"
      style={{ padding: "8px 0", background: "none", border: "none" }}>
      <div>
        <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{label}</div>
        <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{desc}</div>
      </div>
      <div className="w-10 h-5 rounded-full relative shrink-0"
        style={{ background: value ? "var(--tc-primary)" : "var(--tc-border-strong)", transition: "background 150ms" }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
          style={{ left: value ? 20 : 2, transition: "left 150ms" }} />
      </div>
    </button>
  );
}
