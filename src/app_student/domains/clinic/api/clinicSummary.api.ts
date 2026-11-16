import api from "@student/shared/api/student.api";
import { decodeClinicVerdict, type ClinicIdcardResult } from "@student/shared/api/clinicVerdict";
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
  source_id?: number | null;
  source_title?: string | null;
  source_scope?: string | null;
  can_submit_homework_files?: boolean;
  created_at?: string | null;
};

export type StudentClinicSummary = {
  current_targets: ClinicCurrentTarget[];
  current_result: ClinicIdcardResult;
};

/**
 * 학생 클리닉 대상 요약.
 *
 * 패스카드와 같은 서버 판정을 검증하고 대상 요약에 필요한 값만 노출한다.
 */
export async function fetchStudentClinicSummary(): Promise<StudentClinicSummary> {
  const response = await api.get("/clinic/idcard/");
  const data = response.data as Partial<StudentClinicSummary>;
  const { current_result } = decodeClinicVerdict(data);

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
          source_title: target.source_title == null
            ? target.source_title
            : richHtmlToPlainText(target.source_title),
          source_scope: target.source_scope == null
            ? target.source_scope
            : richHtmlToPlainText(target.source_scope),
        }))
      : [],
    current_result,
  };
}
