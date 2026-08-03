import api from "@student/shared/api/student.api";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";

export type ClinicCurrentTarget = {
  clinic_link_id: number;
  enrollment_id: number;
  lecture_id: number;
  lecture_title: string;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  session_id: number;
  session_order: number;
  session_title?: string;
  source_type?: "exam" | "homework" | null;
};

export type StudentClinicSummary = {
  current_targets: ClinicCurrentTarget[];
  current_result: "SUCCESS" | "FAIL";
};

/**
 * 학생 클리닉 대상 요약.
 *
 * 백엔드의 기존 `/clinic/idcard/` 읽기 계약은 구버전 앱 호환을 위해
 * 유지되지만, 현재 학생 앱은 패스카드 필드를 소비하지 않는다.
 */
export async function fetchStudentClinicSummary(): Promise<StudentClinicSummary> {
  const response = await api.get("/clinic/idcard/");
  const data = response.data as Partial<StudentClinicSummary>;

  return {
    current_targets: Array.isArray(data.current_targets)
      ? data.current_targets.map((target) => ({
          ...target,
          lecture_title: richHtmlToPlainText(target.lecture_title),
          lecture_chip_label: target.lecture_chip_label == null
            ? target.lecture_chip_label
            : richHtmlToPlainText(target.lecture_chip_label),
          session_title: target.session_title == null
            ? target.session_title
            : richHtmlToPlainText(target.session_title),
        }))
      : [],
    current_result: data.current_result === "FAIL" ? "FAIL" : "SUCCESS",
  };
}
