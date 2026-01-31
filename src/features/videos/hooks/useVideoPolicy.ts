// PATH: src/features/videos/hooks/useVideoPolicy.ts
// --------------------------------------------------
// useVideoPolicy
// --------------------------------------------------
// 책임:
// - 영상 시청 정책 상태 관리 (allow_skip / max_speed / show_watermark)
// - dirty 여부 계산
// - 저장(patch) + react-query invalidate
//
// ⚠️ UI / JSX / UX 관여 ❌
// ⚠️ VideoDetailPage 에서만 사용 예정 (A-1)
// --------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

export interface VideoPolicy {
  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;
}

interface Options {
  videoId: number;
  initial?: VideoPolicy | null;
}

export function useVideoPolicy({ videoId, initial }: Options) {
  const qc = useQueryClient();

  // -------------------------------
  // State
  // -------------------------------
  const [policy, setPolicy] = useState<VideoPolicy>({
    allow_skip: false,
    max_speed: 1.0,
    show_watermark: true,
  });

  const [dirty, setDirty] = useState(false);

  // -------------------------------
  // Init from server
  // -------------------------------
  useEffect(() => {
    if (!initial) return;

    setPolicy({
      allow_skip: Boolean(initial.allow_skip),
      max_speed: Number(initial.max_speed ?? 1),
      show_watermark: Boolean(initial.show_watermark),
    });

    setDirty(false);
  }, [initial?.allow_skip, initial?.max_speed, initial?.show_watermark]);

  // -------------------------------
  // Helpers
  // -------------------------------
  const update = <K extends keyof VideoPolicy>(key: K, value: VideoPolicy[K]) => {
    setPolicy((prev) => {
      if (prev[key] === value) return prev;
      return { ...prev, [key]: value };
    });
    setDirty(true);
  };

  // -------------------------------
  // Save
  // -------------------------------
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!videoId) return;

      await api.patch(`/media/videos/${videoId}/`, {
        allow_skip: policy.allow_skip,
        max_speed: policy.max_speed,
        show_watermark: policy.show_watermark,
      });
    },

    onSuccess: async () => {
      setDirty(false);

      await qc.invalidateQueries({ queryKey: ["video-stats", videoId] });
      await qc.invalidateQueries({ queryKey: ["video", videoId, "stats"] });
    },
  });

  // -------------------------------
  // Derived
  // -------------------------------
  const canSave = useMemo(() => dirty && !saveMutation.isPending, [dirty, saveMutation.isPending]);

  return {
    policy,
    dirty,
    canSave,

    // setters
    setAllowSkip: (v: boolean) => update("allow_skip", v),
    setMaxSpeed: (v: number) => update("max_speed", v),
    setShowWatermark: (v: boolean) => update("show_watermark", v),

    // actions
    save: saveMutation.mutate,
    saving: saveMutation.isPending,
  };
}
