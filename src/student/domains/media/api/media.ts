// PATH: C:\academyfront\src\student\domains\media\api\media.ts
import api from "@/student/shared/api/studentApi";

export type StudentVideoRule = "free" | "once" | "blocked";

export type StudentVideoListItem = {
  id: number;
  session_id: number;
  title: string;
  status: string;
  thumbnail_url?: string | null;

  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;
  effective_rule: StudentVideoRule;
};

export type StudentSessionVideosResponse = {
  items: StudentVideoListItem[];
};

export type StudentVideoPlayback = {
  video: StudentVideoListItem;
  hls_url?: string | null;
  mp4_url?: string | null;
  policy: {
    allow_skip: boolean;
    max_speed: number;
    show_watermark: boolean;
    effective_rule: StudentVideoRule;
  };
};

export async function fetchStudentSessionVideos(
  sessionId: number,
  enrollmentId?: number | null
): Promise<StudentSessionVideosResponse> {
  const res = await api.get(`/student/media/sessions/${sessionId}/videos/`, {
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
  const res = await api.get(`/student/media/videos/${videoId}/playback/`, {
    params: enrollmentId ? { enrollment: enrollmentId } : undefined,
  });
  return res.data as StudentVideoPlayback;
}
