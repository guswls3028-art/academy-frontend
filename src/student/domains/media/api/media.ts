// PATH: C:\academyfront\src\student\domains\media\api\media.ts
import api from "@/student/shared/api/studentApi";
import type { AccessMode, VideoRule } from "@/features/videos/types/access-mode";

export type StudentVideoRule = VideoRule; // Legacy type

export type StudentVideoListItem = {
  id: number;
  session_id: number;
  title: string;
  status: string;
  thumbnail_url?: string | null;

  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;
  effective_rule: StudentVideoRule; // Legacy field
  access_mode?: AccessMode; // New field
};

export type StudentSessionVideosResponse = {
  items: StudentVideoListItem[];
};

export type StudentVideoPlayback = {
  video: StudentVideoListItem;
  hls_url?: string | null;
  mp4_url?: string | null;
  policy: {
    allow_seek?: boolean;
    seek?: {
      mode?: "free" | "blocked" | "bounded_forward";
      forward_limit?: "max_watched" | null;
      grace_seconds?: number;
    };
    playback_rate?: {
      max?: number;
      ui_control?: boolean;
    };
    watermark?: {
      enabled?: boolean;
      mode?: "overlay";
      fields?: string[];
    };
    concurrency?: {
      max_sessions?: number;
      max_devices?: number;
    };
    access_mode?: AccessMode; // New field
  };
};

export async function fetchStudentSessionVideos(
  sessionId: number,
  enrollmentId?: number | null
): Promise<StudentSessionVideosResponse> {
  const res = await api.get(`/student/video/sessions/${sessionId}/videos/`, {
    params: enrollmentId ? { enrollment: enrollmentId } : undefined,
  });
  const d = res.data;
  return {
    items: Array.isArray(d?.items) ? d.items : [],
  };
}

export async function fetchStudentVideoPlayback(
  videoId: number,
  enrollmentId?: number | null
): Promise<StudentVideoPlayback> {
  const res = await api.get(`/student/video/videos/${videoId}/playback/`, {
    params: enrollmentId ? { enrollment: enrollmentId } : undefined,
  });
  return res.data as StudentVideoPlayback;
}
