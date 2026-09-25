import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { AxiosHeaders } from "axios";

import ExamResultsViewerPanel from "@/app_admin/domains/exams/panels/ExamResultsViewerPanel";
import ExamLectureAssignmentsPanel from "@/app_admin/domains/exams/panels/setup/ExamLectureAssignmentsPanel";
import api from "@/shared/api/axios";
import "@/index.css";

const visualMode = new URLSearchParams(window.location.search).get("visual");
const wrongCompletionOnly = new URLSearchParams(window.location.search)
  .get("assessmentStatusDisplay") === "wrong_completion";

if (visualMode === "shared" || visualMode === "assignments") {
  const attached: Array<{ lectureId: number; sessionId: number; passScore: number }> = [];
  let failOnceSessionId = Number(new URLSearchParams(window.location.search).get("failOnce"));
  const sharedRows = [
    {
      enrollment_id: 901,
      student_name: "A학생",
      final_score: 65,
      exam_max_score: 100,
      ranking_score: 65,
      result_status: "DONE",
      passed: true,
      remediated: false,
      final_pass: true,
      achievement: "PASS",
      rank: 1,
      cohort_size: 2,
      lecture_id: 101,
      lecture_title: "A학교 강의",
      lecture_color: "#2563eb",
      pass_score: 60,
    },
    {
      enrollment_id: 902,
      student_name: "B학생",
      final_score: 65,
      exam_max_score: 100,
      ranking_score: 65,
      result_status: "DONE",
      passed: false,
      remediated: false,
      final_pass: false,
      achievement: "FAIL",
      rank: 1,
      cohort_size: 2,
      lecture_id: 202,
      lecture_title: "B학교 강의",
      lecture_color: "#dc2626",
      pass_score: 70,
    },
  ];
  api.defaults.adapter = async (config) => {
    const path = String(config.url ?? "").replace(/^\/api\/v1/, "");
    const lectureId = Number((config.params as { lecture_id?: number } | undefined)?.lecture_id);
    const method = String(config.method ?? "get").toLowerCase();
    if (path === "/exams/77/lecture-assignments/" && method === "post") {
      const payload = JSON.parse(String(config.data)) as { session_id: number; pass_score: number };
      if (payload.session_id === failOnceSessionId) {
        failOnceSessionId = 0;
        throw new Error("연결 일시 실패");
      }
      attached.push({ lectureId: payload.session_id === 4001 ? 404 : 303, sessionId: payload.session_id, passScore: payload.pass_score });
    }
    let data: unknown = [];
    if (path === "/exams/77/") {
      data = {
        id: 77,
        title: "학교 공동 8월 진단평가",
        exam_type: "regular",
        is_active: true,
        grading_mode: "choice",
        manual_grading_method: "correctness",
        max_score: 100,
        pass_score: 60,
      };
    } else if (path === "/exams/77/lecture-assignments/") {
      data = {
        exam_id: 77,
        default_pass_score: 60,
        total_roster_count: 2 + attached.length,
        total_selected_count: 2 + attached.length,
        assignments: [
          {
            lecture_id: 101,
            lecture_title: "A학교 강의",
            lecture_color: "#2563eb",
            lecture_chip_label: "A",
            pass_score: 60,
            uses_default_pass_score: true,
            roster_count: 1,
            selected_count: 1,
            sessions: [{ session_id: 1001, session_title: "중간고사", session_label: "1회차" }],
          },
          {
            lecture_id: 202,
            lecture_title: "B학교 강의",
            lecture_color: "#dc2626",
            lecture_chip_label: "B",
            pass_score: 70,
            uses_default_pass_score: false,
            roster_count: 1,
            selected_count: 1,
            sessions: [{ session_id: 2001, session_title: "중간고사", session_label: "1회차" }],
          },
          ...attached.map((item) => ({
            lecture_id: item.lectureId,
            lecture_title: item.lectureId === 404 ? "D학교 강의" : "C학교 강의",
            pass_score: item.passScore,
            uses_default_pass_score: false,
            roster_count: 1,
            selected_count: 1,
            sessions: [{ session_id: item.sessionId, session_title: "8월 진단평가", session_label: "1회차" }],
          })),
        ],
      };
    } else if (path === "/results/admin/exams/77/results/") {
      data = lectureId > 0
        ? sharedRows.filter((row) => row.lecture_id === lectureId).map((row) => ({ ...row, cohort_size: 1 }))
        : sharedRows;
    } else if (path === "/results/admin/exams/77/questions/") {
      data = [
        { question_id: 1001, question_number: 1, attempts: lectureId > 0 ? 1 : 2, correct: 1, accuracy: 0.5, avg_score: 2.5, max_score: 5 },
        { question_id: 1002, question_number: 2, attempts: lectureId > 0 ? 1 : 2, correct: 0, accuracy: 0, avg_score: 0, max_score: 5 },
      ];
    } else if (path === "/lectures/lectures/") {
      data = [
        { id: 101, title: "A학교 강의", name: "A학교 강의", subject: "MATH", is_active: true, tenant: 1, created_at: "", updated_at: "" },
        { id: 202, title: "B학교 강의", name: "B학교 강의", subject: "MATH", is_active: true, tenant: 1, created_at: "", updated_at: "" },
        { id: 303, title: "C학교 강의", name: "C학교 강의", subject: "MATH", is_active: true, tenant: 1, created_at: "", updated_at: "" },
        { id: 404, title: "D학교 강의", name: "D학교 강의", subject: "MATH", is_active: true, tenant: 1, created_at: "", updated_at: "" },
      ];
    } else if (path.startsWith("/lectures/sessions/")) {
      const requestedLectureId = Number(
        (config.params as { lecture?: number } | undefined)?.lecture
        ?? new URL(path, window.location.origin).searchParams.get("lecture")
        ?? 303,
      );
      const sessionId = requestedLectureId === 101
        ? 1001
        : requestedLectureId === 202
          ? 2001
          : requestedLectureId === 404 ? 4001 : 3001;
      data = [{
        id: sessionId,
        lecture: requestedLectureId,
        order: 1,
        display_label: "1회차",
        title: "8월 진단평가",
        created_at: "",
        updated_at: "",
      }];
    }
    return {
      data,
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    };
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <main className="mx-auto max-w-6xl p-4">
          {visualMode === "assignments"
            ? <ExamLectureAssignmentsPanel examId={77} maxScore={100} />
            : <ExamResultsViewerPanel examId={77} wrongCompletionOnly={wrongCompletionOnly} />}
        </main>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
