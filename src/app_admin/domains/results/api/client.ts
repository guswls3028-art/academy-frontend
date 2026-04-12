// src/features/results/api/client.ts
// ------------------------------------------------------------
// Results Domain ApiClient
// - 관리자 / 운영자용 성적·통계·오답 API 전용
// - exams / lectures 도메인 접근 ❌
// ------------------------------------------------------------

import axios, { AxiosInstance } from "axios";

type ClientOptions = {
  baseUrl: string;
  getAccessToken?: () => string | null;
};

export class ApiClient {
  private http: AxiosInstance;

  constructor({ baseUrl, getAccessToken }: ClientOptions) {
    this.http = axios.create({
      baseURL: baseUrl,
    });

    // ✅ access token 자동 주입
    this.http.interceptors.request.use((config) => {
      const token = getAccessToken?.();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /* =====================================================
   * 🔧 [추가]
   * Generic HTTP helpers
   *
   * 목적:
   * - hooks / panels 에서 api.get<T>() 패턴 사용 가능하게
   * - axios 직접 노출 ❌
   * - results 도메인 내부 통신 표준화
   * ===================================================== */

  async get<T = any>(url: string, config?: any): Promise<T> {
    const res = await this.http.get(url, config);
    return res.data as T;
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const res = await this.http.post(url, data, config);
    return res.data as T;
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const res = await this.http.put(url, data, config);
    return res.data as T;
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    const res = await this.http.delete(url, config);
    return res.data as T;
  }

  /* =====================================================
   * Admin Exam Results (도메인 전용 고수준 API)
   * ===================================================== */

  /**
   * 관리자 시험 성적 리스트
   * GET /results/admin/exams/{exam_id}/results/
   */
  async getAdminExamResults(examId: number) {
    const res = await this.http.get(
      `/results/admin/exams/${examId}/results/`
    );
    return res.data;
  }

  /**
   * 관리자 시험 통계 요약
   * GET /results/admin/exams/{exam_id}/summary/
   */
  async getAdminExamSummary(examId: number) {
    const res = await this.http.get(
      `/results/admin/exams/${examId}/summary/`
    );
    return res.data;
  }

  /**
   * 세션 단위 성적 요약
   * GET /results/admin/sessions/{session_id}/score-summary/
   */
  async getSessionScoreSummary(sessionId: number) {
    const res = await this.http.get(
      `/results/admin/sessions/${sessionId}/score-summary/`
    );
    return res.data;
  }

  /* =====================================================
   * Question / Wrong Note
   * ===================================================== */

  /**
   * 문항별 통계
   * GET /results/admin/exams/{exam_id}/questions/
   */
  async getExamQuestionStats(examId: number) {
    const res = await this.http.get(
      `/results/admin/exams/${examId}/questions/`
    );
    return res.data;
  }

  /**
   * 단일 학생 오답 노트
   * GET /results/wrong-notes?exam_id=&enrollment_id=
   */
  async getWrongNotes(params: {
    examId: number;
    enrollmentId: number;
  }) {
    const res = await this.http.get(`/results/wrong-notes`, {
      params: {
        exam_id: params.examId,
        enrollment_id: params.enrollmentId,
      },
    });
    return res.data;
  }
}
