// PATH: C:\academyfront\src\student\domains\video\api\video.ts
import api from "@/student/shared/api/studentApi";
import type { AccessMode } from "@/features/videos/types/access-mode";

/** GET /student/video/me/ 응답 — 영상 탭용 */
export type StudentVideoMeSession = {
  id: number;
  title: string;
  order: number;
  date: string | null;
};

export type StudentVideoMeLecture = {
  id: number;
  title: string;
  sessions: StudentVideoMeSession[];
  enrollment_id?: number | null;
};

export type StudentVideoMePublic = {
  session_id: number;
  lecture_id: number;
} | null;

export type StudentVideoMeResponse = {
  public: StudentVideoMePublic;
  lectures: StudentVideoMeLecture[];
};

export async function fetchVideoMe(): Promise<StudentVideoMeResponse> {
  const res = await api.get<StudentVideoMeResponse>("/student/video/me/");
  const d = res.data;
  return {
    public: d?.public ?? null,
    lectures: Array.isArray(d?.lectures) ? d.lectures : [],
  };
}

export type StudentVideoListItem = {
  id: number;
  session_id: number;
  title: string;
  status: string;
  thumbnail_url?: string | null;
  duration?: number | null;
  progress?: number; // 0-100
  completed?: boolean;
  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;
  access_mode?: AccessMode;
};

export type StudentSessionVideosResponse = {
  items: StudentVideoListItem[];
};

export type StudentVideoPlayback = {
  video: StudentVideoListItem;
  hls_url?: string | null;
  mp4_url?: string | null;
  play_url?: string | null; // 백엔드에서 제공하는 재생 URL
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
    access_mode?: AccessMode;
  };
};

export async function fetchStudentSessionVideos(
  sessionId: number,
  enrollmentId?: number | null
): Promise<StudentSessionVideosResponse> {
  if (Number.isNaN(Number(sessionId)) || sessionId < 1) {
    throw new Error("유효한 차시가 아닙니다.");
  }
  const res = await api.get(`/student/video/sessions/${sessionId}/videos/`, {
    params: enrollmentId ? { enrollment: enrollmentId } : undefined,
  });
  const d = res?.data;
  return {
    items: Array.isArray(d?.items) ? d.items : [],
  };
}

/**
 * 학생 앱 전용: 비디오 재생 정보 가져오기
 * 백엔드: GET /student/video/videos/{videoId}/playback/
 * - 비디오 정보와 재생 URL, 정책을 함께 반환
 */
export async function fetchStudentVideoPlayback(
  videoId: number,
  enrollmentId?: number | null
): Promise<StudentVideoPlayback> {
  const params: Record<string, string> = {};
  if (enrollmentId) {
    params.enrollment = String(enrollmentId);
  }
  if (Number.isNaN(Number(videoId)) || videoId < 1) {
    throw new Error("유효한 영상이 아닙니다.");
  }
  const res = await api.get(`/student/video/videos/${videoId}/playback/`, {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  const data = res?.data;
  if (data == null || typeof data !== "object") {
    throw new Error("재생 정보를 받지 못했습니다.");
  }
  return data as StudentVideoPlayback;
}

/**
 * 비디오 진행률 업데이트
 * POST /student/video/videos/{videoId}/progress/
 */
export async function updateVideoProgress(
  videoId: number,
  data: {
    progress?: number; // 0-100 또는 0-1
    completed?: boolean;
    last_position?: number; // seconds
  }
): Promise<{
  id: number;
  video_id: number;
  enrollment_id: number;
  progress: number;
  progress_percent: number;
  completed: boolean;
  last_position: number;
}> {
  if (Number.isNaN(Number(videoId)) || videoId < 1) {
    throw new Error("유효한 영상이 아닙니다.");
  }
  const res = await api.post(`/student/video/videos/${videoId}/progress/`, data);
  const out = res?.data;
  if (out == null || typeof out !== "object") {
    throw new Error("진행률 저장 응답이 없습니다.");
  }
  return out as {
    id: number;
    video_id: number;
    enrollment_id: number;
    progress: number;
    progress_percent: number;
    completed: boolean;
    last_position: number;
  };
}
