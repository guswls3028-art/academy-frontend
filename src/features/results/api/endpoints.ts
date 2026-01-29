export const resultsEndpoints = {
  // 1) Results
  myExamResult: (examId: number) => `/results/me/exams/${examId}/`,
  adminExamResults: (examId: number) => `/results/admin/exams/${examId}/results/`,
  adminExamResultDetail: (examId: number, enrollmentId: number) =>
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/`,

  // 2) Analytics
  adminExamSummary: (examId: number) => `/results/admin/exams/${examId}/summary/`,
  sessionScoreSummary: (sessionId: number) => `/results/admin/sessions/${sessionId}/score-summary/`,
  questionStats: (examId: number) => `/results/admin/exams/${examId}/questions/`,
  topWrongQuestions: (examId: number, n = 5) => `/results/admin/exams/${examId}/questions/top-wrong/?n=${n}`,

  // 3) Wrong notes
  wrongNotes: (params: {
    enrollment_id: number;
    exam_id?: number;
    lecture_id?: number;
    from_session_order?: number;
    offset?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    q.set("enrollment_id", String(params.enrollment_id));
    if (params.exam_id != null) q.set("exam_id", String(params.exam_id));
    if (params.lecture_id != null) q.set("lecture_id", String(params.lecture_id));
    if (params.from_session_order != null) q.set("from_session_order", String(params.from_session_order));
    if (params.offset != null) q.set("offset", String(params.offset));
    if (params.limit != null) q.set("limit", String(params.limit));
    return `/results/wrong-notes?${q.toString()}`;
  },

  wrongNotePdfCreate: `/results/wrong-notes/pdf/`,
  wrongNotePdfStatus: (jobId: number) => `/results/wrong-notes/pdf/${jobId}/`,
};
