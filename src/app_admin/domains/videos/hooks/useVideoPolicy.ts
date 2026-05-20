// PATH: src/app_admin/domains/videos/hooks/useVideoPolicy.ts
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

const DEFAULT_POLICY: VideoPolicy = {
  allow_skip: false,
  max_speed: 1.0,
  show_watermark: true,
};

interface Options {
  videoId: number;
  initial?: VideoPolicy | null;
}

export function useVideoPolicy({ videoId, initial }: Options) {
  const qc = useQueryClient();
  const hasInitialPolicy = initial != null;
  const initialAllowSkip = initial?.allow_skip;
  const initialMaxSpeed = initial?.max_speed;
  const initialShowWatermark = initial?.show_watermark;

  // -------------------------------
  // State
  // -------------------------------
  const [policy, setPolicy] = useState<VideoPolicy>(DEFAULT_POLICY);

  const [dirty, setDirty] = useState(false);

  // -------------------------------
  // Init from server
  // -------------------------------
  useEffect(() => {
    if (!hasInitialPolicy) {
      setPolicy(DEFAULT_POLICY);
      setDirty(false);
      return;
    }

    setPolicy({
      allow_skip: Boolean(initialAllowSkip),
      max_speed: Number(initialMaxSpeed ?? 1),
      show_watermark: Boolean(initialShowWatermark),
    });

    setDirty(false);
  }, [hasInitialPolicy, initialAllowSkip, initialMaxSpeed, initialShowWatermark]);

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
