export const remediationWorkbenchTargets = [
  {
    enrollment_id: 910,
    student_id: 310,
    student_name: "작업대 학생",
    session_id: 710,
    session_title: "7차시",
    lecture_id: 510,
    lecture_title: "여름 화학특강",
    lecture_chip_label: "화학",
    clinic_link_id: 880,
    source_type: "exam",
    source_id: 810,
    exam_id: 810,
    source_title: "기체 법칙 단원평가",
    reason: "score",
    exam_score: 20,
    cutline_score: 80,
    max_score: 100,
    latest_attempt_index: 1,
    attempt_history: [{ attempt_index: 1, score: 20, max_score: 100, passed: false, at: "2026-08-29T20:00:00+09:00" }],
    created_at: "2026-08-29T20:00:00+09:00",
  },
  {
    enrollment_id: 910,
    student_id: 310,
    student_name: "작업대 학생",
    session_id: 710,
    session_title: "7차시",
    lecture_id: 510,
    lecture_title: "여름 화학특강",
    lecture_chip_label: "화학",
    clinic_link_id: 881,
    source_type: "homework",
    source_id: 811,
    source_title: "평형의 이동 복습",
    reason: "score",
    homework_score: 5,
    homework_cutline: 8,
    max_score: 10,
    latest_attempt_index: 1,
    attempt_history: [{ attempt_index: 1, score: 5, max_score: 10, passed: false, at: "2026-08-29T20:10:00+09:00" }],
    resolution_evidence: { score: 5, pass_score: 8 },
    resolution_history: [{
      at: "2026-08-29T20:15:00+09:00",
      action: "unresolve",
      resolution_type: "HOMEWORK_PASS",
      evidence: { score: 5 },
    }],
    linked_bookings: [{
      plan_item_id: 9901,
      participant_id: 9902,
      session_id: 9903,
      session_date: "2026-08-29",
      session_start_time: "14:30:00",
      session_end_time: "16:00:00",
      location: "본관 302호",
      participant_status: "booked",
      preferred_start_time: "15:00:00",
      preferred_end_time: "16:00:00",
      student_request_memo: "학원 셔틀 뒤에 도착해요",
      staff_memo: "도착하면 3번 좌석 안내",
      linked_at: "2026-08-29T09:30:00+09:00",
      linked_by_id: 12,
      linkage_source: "participant_plan",
    }],
    created_at: "2026-08-29T20:10:00+09:00",
  },
];

function participant(id: number, student: number, studentName: string, sessionDate: string) {
  return {
    id,
    session: 7301,
    student,
    student_name: studentName,
    enrollment_id: id + 1000,
    session_date: sessionDate,
    session_title: "오늘 자동 갱신 클리닉",
    session_start_time: "17:00:00",
    session_end_time: "18:00:00",
    session_location: "본관 201호",
    status: "booked",
    checked_in_at: null,
    checked_out_at: null,
  };
}

export function currentClinicCountDates(now = new Date()) {
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrow = [
    tomorrowDate.getFullYear(),
    String(tomorrowDate.getMonth() + 1).padStart(2, "0"),
    String(tomorrowDate.getDate()).padStart(2, "0"),
  ].join("-");
  return { today, tomorrow };
}

export function createClinicCountFreshnessRouteData(today: string, tomorrow: string) {
  let otherDeviceBookingVisible = false;
  let participantRequests = 0;
  let treeRequests = 0;
  const participantQueries: string[] = [];

  return {
    revealOtherDeviceBooking() {
      otherDeviceBookingVisible = true;
    },
    response(path: string, method: string, search: string): unknown {
      if (path === "/core/program/") {
        return { tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true };
      }
      if (path === "/core/me/") {
        return { id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false };
      }
      if (path === "/clinic/sessions/tree/" && method === "GET") {
        treeRequests += 1;
        const visibleCount = otherDeviceBookingVisible ? 2 : 1;
        return [{
          id: 7301,
          title: "오늘 자동 갱신 클리닉",
          date: today,
          start_time: "17:00:00",
          duration_minutes: 60,
          location: "본관 201호",
          max_participants: 10,
          participant_count: visibleCount,
          booked_count: visibleCount,
          pending_count: 0,
          booked_confirmed_count: visibleCount,
          no_show_count: 0,
        }];
      }
      if (path === "/clinic/participants/" && method === "GET") {
        participantRequests += 1;
        participantQueries.push(search);
        const rows = [participant(8301, 4301, "먼저 예약한 학생", today)];
        if (otherDeviceBookingVisible) rows.push(participant(8302, 4302, "다른 기기 예약 학생", today));
        // The API owns date filtering. A future reservation exists conceptually,
        // but must never enter today's response or count.
        void participant(8303, 4303, "내일 예약 학생", tomorrow);
        return { count: rows.length, next: null, previous: null, results: rows };
      }
      if (path === "/results/admin/clinic-targets/" && method === "GET") return [];
      if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return [];
      if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return { count: 0, results: [] };
      return { count: 0, next: null, previous: null, results: [] };
    },
    get participantRequests() {
      return participantRequests;
    },
    get treeRequests() {
      return treeRequests;
    },
    get participantQueries() {
      return participantQueries;
    },
  };
}
