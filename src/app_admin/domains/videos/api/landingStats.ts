// PATH: src/app_admin/domains/videos/api/landingStats.ts
import api from "@/shared/api/axios";
import type { VideoStatus } from "./videos.api";

export type LandingVideoSummary = {
  id: number;
  title: string;
  status: VideoStatus | string;
  session_id: number | null;
  lecture_id: number | null;
  lecture_title: string;
  session_order: number | null;
  created_at: string | null;
  view_count: number;
};

export type VideosLandingStats = {
  total: number;
  ready: number;
  processing: number;
  failed: number;
  uploaded_last_7d: number;
  processing_top: LandingVideoSummary[];
  failed_top: LandingVideoSummary[];
};

export async function fetchVideosLandingStats(): Promise<VideosLandingStats> {
  const res = await api.get<VideosLandingStats>("/media/admin/videos/landing-stats/");
  return res.data;
}
