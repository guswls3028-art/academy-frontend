import api from "@/shared/api/axios";

export type StudentVideo = {
  id: number;
  session_id: number;
  title: string;
  file_key: string | null;
  duration: number | null;
  order: number;
  status?: string;

  allow_skip?: boolean;
  max_speed?: number;
  show_watermark?: boolean;

  source_type: "s3" | "file" | "youtube" | "external" | "unknown";

  can_play: boolean;
  reason: string | null;

  created_at: string;
  updated_at: string;
};

export type PlayFacadeResponse = {
  token: string;
  session_id: string;
  expires_at: number;
  policy: any;
  play_url: string;
};

// ✅ 학생 세션 영상 목록
export async function fetchStudentSessionVideos(
  sessionId: number
): Promise<StudentVideo[]> {
  const res = await api.get(
    "/media/videos/student/",
    {
      params: { session: sessionId },
      withCredentials: true, // ⭐ 추가
    }
  );
  return res.data;
}

// ✅ 학생 영상 재생 (facade)
export async function playVideoFacade(
  videoId: number,
  device_id: string
): Promise<PlayFacadeResponse> {
  const res = await api.post(
    `/media/videos/${videoId}/play/facade/`,
    { device_id },
    {
      withCredentials: true, // ⭐ 이거 없으면 쿠키 안 붙음
    }
  );
  return res.data;
}
