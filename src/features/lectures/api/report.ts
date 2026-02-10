// PATH: src/features/lectures/api/report.ts
import api from "@/shared/api/axios";

export interface LectureReportStudent {
  enrollment: number;
  student_id: number;
  student_name: string;
  avg_progress: number;
  completed_videos: number;
  total_videos: number;
  last_attendance_status: string | null;
}

export interface LectureReportSummary {
  total_students: number;
  total_sessions: number;
  total_videos: number;
  avg_video_progress: number;
  completed_students: number;
}

export interface LectureReportResponse {
  lecture: {
    id: number;
    title: string;
    name: string;
    subject: string;
  };
  summary: LectureReportSummary;
  attendance_by_status: Record<string, number>;
  students: LectureReportStudent[];
}

/**
 * ✅ FIX
 * ❌ /lectures/{id}/report/
 * ✅ /lectures/lectures/{id}/report/
 */
export async function fetchLectureReport(
  lectureId: number
): Promise<LectureReportResponse> {
  const res = await api.get(`/lectures/lectures/${lectureId}/report/`);
  return res.data;
}
