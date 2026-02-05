// PATH: src/student/domains/clinic-idcard/api/idcard.ts

import api from "@/student/shared/api/studentApi";
import { ClinicIdCardData } from "../pages/ClinicIDCardPage";

/**
 * ✅ Clinic ID Card API
 * - Read-only
 * - 판단 로직 ❌
 */
export async function fetchClinicIdCard(): Promise<ClinicIdCardData> {
  const res = await api.get("/clinic/idcard/");
  const data = res.data;

  return {
    studentName: data.student_name,
    currentResult: data.current_result, // SUCCESS | FAIL
    histories: (data.histories || []).slice(0, 9),
  };
}
