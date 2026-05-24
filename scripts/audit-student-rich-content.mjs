import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.STUDENT_AUDIT_BASE_URL || "http://127.0.0.1:5193";
const stamp = process.env.STUDENT_AUDIT_STAMP || new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
const outDir = process.env.STUDENT_AUDIT_OUT || path.resolve(process.cwd(), "..", "_artifacts", "frontend-structure-audit", `student-rich-content-${stamp}`);

const now = new Date();
const today = ymd(now);
const tomorrow = addDays(1);
const dayAfter = addDays(2);
const lastWeek = addDays(-7);

const student = {
  id: 9201,
  username: "S20260524",
  ps_number: "S20260524",
  name: "김서연",
  phone: "01012345678",
  parent_phone: "01087654321",
  gender: "F",
  address: "서울시 강남구 테스트로 24",
  school_type: "HIGH",
  high_school: "하나고등학교",
  grade: 2,
  high_school_class: "3반",
  major: "이과",
  memo: "내신 집중 관리반",
  profile_photo_url: inlineSvgAvatar("김"),
};

const sessions = [
  { id: 1101, title: "고2 수학II 14차시 - 도함수 활용", date: today, status: "진행 예정", type: "session", start_time: "18:30:00", exam_ids: [8101] },
  { id: 1102, title: "영어 독해 실전 9차시", date: today, status: "예약됨", type: "session", start_time: "20:10:00", exam_ids: [] },
  { id: -3301, title: "클리닉 함수 그래프 보강", date: today, status: "예약됨", type: "clinic", start_time: "21:30:00", exam_ids: [] },
  { id: 1103, title: "고2 수학II 15차시 - 적분 기본", date: tomorrow, status: "예정", type: "session", start_time: "18:30:00", exam_ids: [8102] },
  { id: 1104, title: "물리I 역학 문제풀이", date: dayAfter, status: "예정", type: "session", start_time: "17:00:00", exam_ids: [] },
  { id: 1098, title: "고2 수학II 13차시 - 미분계수", date: lastWeek, status: "완료", type: "session", start_time: "18:30:00", exam_ids: [8103] },
  { id: -3290, title: "클리닉 내신 오답 보강", date: addDays(-3), status: "완료", type: "clinic", start_time: "19:00:00", exam_ids: [] },
];

const exams = [
  { id: 8101, title: "도함수 활용 단원평가", description: "수업 직후 온라인 응시", open_at: isoHours(-2), close_at: isoHours(7), allow_retake: true, max_attempts: 2, pass_score: 70, max_score: 100, session_id: 1101, has_result: false, attempt_count: 0 },
  { id: 8102, title: "적분 기본 예습 확인", description: "다음 차시 전까지 제출", open_at: isoHours(-1), close_at: isoHours(48), allow_retake: false, max_attempts: 1, pass_score: 60, max_score: 100, session_id: 1103, has_result: false, attempt_count: 0 },
  { id: 8103, title: "미분계수 복습 테스트", description: "채점 완료", open_at: isoHours(-220), close_at: isoHours(-190), allow_retake: true, max_attempts: 2, pass_score: 70, max_score: 100, session_id: 1098, has_result: true, attempt_count: 1 },
];

const grades = {
  exams: [
    { exam_id: 8103, enrollment_id: 6101, title: "미분계수 복습 테스트", total_score: 86, max_score: 100, is_pass: true, achievement: "PASS", meta_status: null, retake_count: 1, session_title: "13차시 - 미분계수", lecture_title: "고2 수학II 심화", submitted_at: isoHours(-186), rank: 3, percentile: 82, cohort_size: 18, cohort_avg: 74.2 },
    { exam_id: 8104, enrollment_id: 6102, title: "영어 독해 모의고사", total_score: 58, max_score: 100, is_pass: false, achievement: "REMEDIATED", meta_status: null, retake_count: 2, session_title: "8차시 - 빈칸 추론", lecture_title: "영어 독해 실전", submitted_at: isoHours(-96), rank: 11, percentile: 39, cohort_size: 21, cohort_avg: 66.5 },
    { exam_id: 8105, enrollment_id: 6101, title: "적분 개념 체크", total_score: null, max_score: 100, is_pass: null, achievement: "NOT_SUBMITTED", meta_status: "NOT_SUBMITTED", retake_count: 0, session_title: "15차시 - 적분 기본", lecture_title: "고2 수학II 심화", submitted_at: null, rank: null, percentile: null, cohort_size: null, cohort_avg: null },
  ],
  homeworks: [
    { homework_id: 9101, enrollment_id: 6101, title: "도함수 활용 30문항", score: 18, max_score: 20, passed: true, achievement: "PASS", retake_count: 1, session_title: "14차시 - 도함수 활용", lecture_title: "고2 수학II 심화" },
    { homework_id: 9102, enrollment_id: 6102, title: "영어 독해 지문 요약", score: null, max_score: 10, passed: false, achievement: "NOT_SUBMITTED", retake_count: 0, session_title: "9차시 - 장문 독해", lecture_title: "영어 독해 실전" },
  ],
  labels: { pass: "", fail: "" },
};

const videoMe = {
  public: { session_id: 7771, lecture_id: 7770, video_count: 3, total_duration: 6320, thumbnail_url: inlineSvgThumb("공개 특강") },
  lectures: [
    {
      id: 7101,
      title: "고2 수학II 심화",
      enrollment_id: 6101,
      video_count: 7,
      total_duration: 15840,
      thumbnail_url: inlineSvgThumb("수학II"),
      sessions: [
        { id: 1101, title: "14차시 - 도함수 활용", order: 14, date: today },
        { id: 1098, title: "13차시 - 미분계수", order: 13, date: lastWeek },
      ],
    },
    {
      id: 7102,
      title: "영어 독해 실전",
      enrollment_id: 6102,
      video_count: 4,
      total_duration: 9340,
      thumbnail_url: inlineSvgThumb("영어 독해"),
      sessions: [
        { id: 1102, title: "9차시 - 장문 독해", order: 9, date: today },
      ],
    },
  ],
};

const videosBySession = {
  7771: [
    videoItem(7001, 7771, "공개 특강 - 시험 전 풀이 루틴", 0, 1830, 74, false),
    videoItem(7002, 7771, "오답노트 쓰는 법", 1, 1260, 100, true),
    videoItem(7003, 7771, "상위권 시간 배분", 2, 920, 35, false),
  ],
  1101: [
    videoItem(7201, 1101, "도함수 활용 개념 정리", 0, 2460, 68, false),
    videoItem(7202, 1101, "접선과 증가 감소 실전 풀이", 1, 3180, 22, false),
    videoItem(7203, 1101, "내신 빈출 12문제", 2, 1840, 100, true),
  ],
  1098: [
    videoItem(7198, 1098, "미분계수 복습", 0, 2280, 100, true),
  ],
  1102: [
    videoItem(7301, 1102, "장문 독해 구조 잡기", 0, 2320, 41, false),
  ],
};

const posts = {
  notice: [
    post(501, "notice", "[긴급] 오늘 수업 교실 변경", "오늘 수학II 수업은 3층 302호에서 진행됩니다.", { urgent: true, pinned: true }),
    post(502, "notice", "6월 내신 대비 주간 일정", "보강과 모의 테스트 일정이 업데이트되었습니다.", { pinned: true }),
    post(503, "notice", "클리닉 예약 마감 안내", "당일 클리닉은 수업 2시간 전까지 예약할 수 있습니다."),
  ],
  board: [
    post(601, "board", "수학II 질문 전 정리하면 좋은 포인트", "그래프 해석 문제는 증가/감소표를 먼저 정리해보세요.", { author: "박민수 선생님", replies: 2 }),
    post(602, "board", "이번 주 우수 질문 공유", "좋은 질문 사례를 모았습니다.", { author: "관리자", replies: 1 }),
  ],
  materials: [
    post(701, "materials", "도함수 활용 실전 프린트", "프린트 PDF와 해설 파일입니다.", { attachments: true }),
    post(702, "materials", "영어 독해 어휘 리스트", "이번 주 지문 핵심 어휘입니다.", { attachments: true }),
  ],
  qna: [
    post(801, "qna", "도함수 부호가 바뀌는 지점 질문", "극대/극소를 판정할 때 헷갈립니다.", { author: student.name, replies: 1, category: "수학" }),
    post(802, "qna", "영어 빈칸 추론 질문", "문장 삽입과 빈칸 중 먼저 봐야 할 단서가 궁금합니다.", { author: student.name, category: "영어" }),
  ],
  counsel: [
    post(901, "counsel", "6월 학습 계획 상담 요청", "수학과 영어 시간을 어떻게 나누면 좋을지 상담 부탁드립니다.", { author: student.name, replies: 1, category: "학습계획" }),
  ],
};

const clinicSessions = [
  { id: 3301, title: "함수 그래프 보강", date: today, start_time: "21:30:00", end_time: "22:20:00", location: "302호", target_grade: 2, participant_count: 5, booked_count: 5, max_participants: 8, is_full: false },
  { id: 3302, title: "도함수 오답 풀이", date: tomorrow, start_time: "17:40:00", end_time: "18:30:00", location: "상담실 A", target_grade: 2, participant_count: 8, booked_count: 8, max_participants: 8, is_full: true },
  { id: 3303, title: "영어 독해 미니 클리닉", date: dayAfter, start_time: "19:00:00", end_time: "19:50:00", location: "201호", target_grade: null, participant_count: 2, booked_count: 2, max_participants: 6, is_full: false },
];

let clinicParticipants = [
  { id: 4301, session: 3301, session_date: today, session_start_time: "21:30:00", session_location: "302호", status: "booked", memo: "도함수 그래프", created_at: isoHours(-12), updated_at: isoHours(-8), status_changed_at: isoHours(-8) },
  { id: 4302, session: 3303, session_date: dayAfter, session_start_time: "19:00:00", session_location: "201호", status: "pending", memo: "영어 장문 독해", created_at: isoHours(-2), updated_at: isoHours(-2), status_changed_at: null },
];

const inventory = {
  folders: [
    { id: "f-math", name: "수학II", parentId: null },
    { id: "f-eng", name: "영어 독해", parentId: null },
  ],
  files: [
    file("file-1", "도함수_오답노트.pdf", "도함수 오답노트", "틀린 문항 정리", "file-text", "f-math", 1240000, "application/pdf"),
    file("file-2", "그래프_풀이사진.jpg", "그래프 풀이 사진", "클리닉 질문용", "image", "f-math", 680000, "image/jpeg"),
    file("file-3", "영어_어휘정리.xlsx", "영어 어휘 정리", "9차시 지문", "file-text", "f-eng", 86000, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  ],
};

const consoleMessages = [];
const apiMisses = [];

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

await context.addInitScript(() => {
  const futureExp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const payload = btoa(JSON.stringify({ exp: futureExp, user_id: 9201 })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  localStorage.setItem("access", `eyJhbGciOiJub25lIn0.${payload}.sig`);
  localStorage.setItem("refresh", `eyJhbGciOiJub25lIn0.${payload}.refresh`);
  sessionStorage.setItem("tenantCode", "hakwonplus");
});

const page = await context.newPage();
page.on("console", (msg) => {
  const type = msg.type();
  if (type === "error" || type === "warning") consoleMessages.push({ type, text: msg.text() });
});

await page.route("**/api/v1/**", routeApi);
await page.route("**/*.mp4", async (route) => route.continue());

const snapshots = [];
await visit("/student/dashboard", "01-dashboard");
await tapBottom("영상");
await snapshot("02-video-home");
await clickFirst("button:has-text('통계')", "02b-video-stats");
await visit("/student/video/courses/7101", "03-video-course");
await visit("/student/video/sessions/1101?enrollment=6101", "04-video-session");
await visit("/student/video/play?video=7201&enrollment=6101&session=1101", "05-video-player");
await visit("/student/dashboard", "05b-dashboard-before-sessions-tab");
await tapBottom("일정");
await snapshot("06-sessions-calendar");
await clickFirst("button:has-text('예약')", "06b-sessions-upcoming");
await clickFirst("button:has-text('지난 일정')", "06c-sessions-past");
await visit("/student/sessions/1101", "07-session-detail");
await visit("/student/exams", "08-exams-home");
await visit("/student/exams/8101", "09-exam-detail");
await visit("/student/exams/8101/submit", "10-exam-submit");
await visit("/student/exams/8103/result", "11-exam-result");
await visit("/student/grades", "12-grades-home");
await clickFirst("button:has-text('추이 분석')", "12b-grades-stats");
await visit("/student/clinic", "13-clinic");
await visit("/student/community", "14-community");
await clickFirst("button:has-text('QnA')", "14b-community-qna");
await clickFirst("button:has-text('질문하기')", "14c-community-write");
await fillCommunityDraft();
await visit("/student/inventory", "15-inventory");
await clickFirst("button:has-text('용량 분석')", "15b-inventory-stats");
await tapBottom("알림");
await snapshot("16-notifications");
await visit("/student/profile", "17-profile");
await simulateProfilePhoto();

const report = {
  ok: true,
  baseUrl,
  outDir,
  snapshots,
  consoleMessages,
  apiMisses,
};
await fs.writeFile(path.join(outDir, "student-rich-content-report.json"), JSON.stringify(report, null, 2), "utf8");
await browser.close();
console.log(JSON.stringify(report, null, 2));

async function visit(pathname, label) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await settle();
  await snapshot(label);
}

async function tapBottom(label) {
  const link = page.locator(".student-tabbar a, nav a").filter({ hasText: label }).first();
  await link.click({ timeout: 10_000 });
  await settle();
}

async function clickFirst(selector, label) {
  const loc = page.locator(selector).first();
  await loc.click({ timeout: 10_000 }).catch(async () => {
    await page.locator(`text=${selector.replace(/^text=/, "")}`).first().click({ timeout: 10_000 });
  });
  await settle();
  await snapshot(label);
}

async function fillCommunityDraft() {
  await page.locator("input[placeholder*='제목']").first().fill("극대/극소 판정 질문");
  const editor = page.locator("[contenteditable='true'], textarea, [role='textbox']").first();
  const editorReady = await editor.waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (editorReady) {
    await editor.click();
    await page.keyboard.type("도함수 부호표에서 0이 되는 지점을 어떻게 분류하면 좋을까요?");
  } else {
    apiMisses.push({ method: "UI", pathname: "community-editor", error: "RichTextEditor contenteditable did not appear" });
  }
  await settle();
  await snapshot("14d-community-write-filled");
}

async function simulateProfilePhoto() {
  const input = page.locator("input[type='file']").first();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATUlEQVR4nO3PQQ3AIADAQMD/P2M6QZyCwW2TzVnbe0bANc0H4HIAFyCXA7gAuRyAFyCXA7gAuRyAFyCXA7gAuRyAFyCXA7gAuRyAFyCXA7j8AXfJAjYv7pAzAAAAAElFTkSuQmCC",
    "base64",
  );
  await input.setInputFiles({ name: "student-profile.png", mimeType: "image/png", buffer: png });
  await settle();
  await snapshot("17b-profile-photo-changed");
}

async function snapshot(label) {
  const hasStudentApp = await page.waitForSelector("[data-app='student']", { state: "attached", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  await settle();
  const screenshot = path.join(outDir, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const metrics = hasStudentApp ? await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    };
    const visible = [...document.querySelectorAll("body *")].filter(isVisible);
    const headings = [...document.querySelectorAll("h1,h2,h3")].filter(isVisible).map((el) => {
      const cs = getComputedStyle(el);
      return { text: (el.textContent || "").trim().slice(0, 40), size: Number.parseFloat(cs.fontSize), weight: cs.fontWeight };
    });
    const surfaces = [...document.querySelectorAll(".stu-section,.stu-card,.stu-panel,.student-card,[class*='Card'],[class*='card'],[class*='Row'],[class*='row']")]
      .filter(isVisible)
      .slice(0, 90)
      .map((el) => {
        const cs = getComputedStyle(el);
        return {
          cls: String(el.className).slice(0, 100),
          bg: cs.backgroundColor,
          border: cs.borderTopColor,
          radius: cs.borderTopLeftRadius,
          shadow: cs.boxShadow !== "none",
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
        };
      });
    return {
      url: location.pathname + location.search,
      visibleCount: visible.length,
      headingMaxSize: headings.reduce((m, h) => Math.max(m, h.size), 0),
      headings,
      surfaceCount: surfaces.length,
      shadowedSurfaceCount: surfaces.filter((s) => s.shadow).length,
      uniqueRadii: [...new Set(surfaces.map((s) => s.radius))].slice(0, 12),
      blueBorderOrBgCount: surfaces.filter((s) => /59, 130, 246|37, 99, 235|30, 58, 138/.test(`${s.bg} ${s.border}`)).length,
    };
  }) : { url: await page.url(), missingStudentApp: true };
  snapshots.push({ label, screenshot, metrics });
}

async function settle() {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 2_500 }).catch(() => undefined);
  await page.waitForFunction(
    () => (document.body.textContent || "").trim() !== "불러오는 중...",
    { timeout: 8_000 },
  ).catch(() => undefined);
  await page.waitForTimeout(150);
}

async function routeApi(route) {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname.replace(/^\/api\/v1/, "");
  const method = request.method();

  try {
    if (pathname === "/core/me/") return json(route, userPayload());
    if (pathname === "/core/program/") return json(route, programPayload());
    if (pathname === "/community/notifications/unread-count/") return json(route, { count: 7 });
    if (pathname.startsWith("/media/playback/")) return json(route, { ok: true });

    if (pathname === "/student/me/") {
      if (method === "PATCH") {
        student.profile_photo_url = inlineSvgAvatar("새");
      }
      return json(route, student);
    }
    if (pathname === "/student/dashboard/") return json(route, dashboardPayload());
    if (pathname === "/student/sessions/me/") return json(route, sessions);
    if (pathname === "/student/sessions/clear-past/" || pathname === "/student/sessions/hide/" || pathname === "/student/sessions/unhide/") {
      return json(route, { hidden_before: today, hidden_ids: [] });
    }
    {
      const m = pathname.match(/^\/student\/sessions\/(\d+)\/$/);
      if (m) return json(route, sessionDetail(Number(m[1])));
    }
    if (pathname === "/student/attendance/summary/") return json(route, attendancePayload());

    if (pathname === "/student/exams/") return json(route, { items: exams });
    {
      const m = pathname.match(/^\/student\/exams\/(\d+)\/$/);
      if (m) return json(route, examById(Number(m[1])));
    }
    {
      const m = pathname.match(/^\/student\/exams\/(\d+)\/questions\/$/);
      if (m) return json(route, examQuestions(Number(m[1])));
    }
    {
      const m = pathname.match(/^\/student\/exams\/(\d+)\/submit\/$/);
      if (m) return json(route, { submission_id: 9901, status: "done" }, 201);
    }
    if (pathname === "/student/grades/") return json(route, grades);
    {
      const m = pathname.match(/^\/student\/results\/me\/exams\/(\d+)\/$/);
      if (m) return json(route, examResult(Number(m[1])));
    }
    {
      const m = pathname.match(/^\/student\/results\/me\/exams\/(\d+)\/items\/$/);
      if (m) return json(route, { items: examResultItems(Number(m[1])) });
    }

    if (pathname === "/student/video/me/") return json(route, videoMe);
    if (pathname === "/student/video/me/stats/") return json(route, videoStatsPayload());
    {
      const m = pathname.match(/^\/student\/video\/sessions\/(\d+)\/videos\/$/);
      if (m) return json(route, { items: videosBySession[Number(m[1])] || [] });
    }
    {
      const m = pathname.match(/^\/student\/video\/videos\/(\d+)\/playback\/$/);
      if (m) return json(route, videoPlayback(Number(m[1])));
    }
    {
      const m = pathname.match(/^\/student\/video\/videos\/(\d+)\/(progress|like)\/$/);
      if (m) return json(route, { id: 1, video_id: Number(m[1]), enrollment_id: 6101, progress: 77, progress_percent: 77, completed: false, last_position: 1220, liked: true, like_count: 13 });
    }
    {
      const m = pathname.match(/^\/student\/video\/videos\/(\d+)\/comments\/$/);
      if (m) return json(route, videoComments(Number(m[1])));
    }
    {
      const m = pathname.match(/^\/student\/video\/comments\/(\d+)\/$/);
      if (m) return json(route, { id: Number(m[1]), content: "수정된 댓글", is_edited: true, deleted: method === "DELETE" });
    }

    if (pathname === "/clinic/sessions/") return json(route, { results: clinicSessions, count: clinicSessions.length });
    if (pathname === "/clinic/participants/") {
      if (method === "POST") {
        const body = readJsonBody(request);
        const session = clinicSessions.find((s) => s.id === Number(body.session)) || clinicSessions[0];
        const created = { id: 4400 + clinicParticipants.length, session: session.id, session_date: session.date, session_start_time: session.start_time, session_location: session.location, status: "pending", memo: body.memo || "", created_at: isoHours(0), updated_at: isoHours(0), status_changed_at: null };
        clinicParticipants = [created, ...clinicParticipants];
        return json(route, created, 201);
      }
      return json(route, { results: clinicParticipants, count: clinicParticipants.length });
    }
    {
      const m = pathname.match(/^\/clinic\/participants\/(\d+)\/(set_status|change-booking)\/$/);
      if (m) return json(route, clinicParticipants[0]);
    }
    if (pathname === "/clinic/idcard/") return json(route, { student, clinic_count: 4, issued_at: isoHours(0) });

    if (pathname === "/community/posts/my-activity/") return json(route, { is_student: true, days: 30, post_count: 3, reply_count: 5, received_likes: 12, score: 91, rank: 4, total_active_students: 128, lifetime: { post_count: 17, reply_count: 33, received_likes: 48 }, badges: [{ key: "sharp", label: "질문왕" }, { key: "steady", label: "꾸준함" }] });
    if (pathname === "/community/posts/notices/") return json(route, { results: posts.notice, count: posts.notice.length });
    if (pathname === "/community/posts/board/") return json(route, { results: posts.board, count: posts.board.length });
    if (pathname === "/community/posts/materials/") return json(route, { results: posts.materials, count: posts.materials.length });
    if (pathname === "/community/posts/") {
      if (method === "POST") {
        const body = readJsonBody(request);
        const created = post(9500 + posts.qna.length, body.post_type || "qna", body.title || "새 질문", body.content || "", { author: student.name, category: body.category_label || null });
        posts[created.post_type].unshift(created);
        return json(route, created, 201);
      }
      const type = url.searchParams.get("post_type") || "board";
      return json(route, { results: posts[type] || [], count: (posts[type] || []).length });
    }
    {
      const replies = pathname.match(/^\/community\/posts\/(\d+)\/replies\/$/);
      if (replies) return json(route, { results: repliesFor(Number(replies[1])), count: repliesFor(Number(replies[1])).length });
      const postMatch = pathname.match(/^\/community\/posts\/(\d+)\/$/);
      if (postMatch) return json(route, findPost(Number(postMatch[1])) || posts.notice[0]);
    }

    if (pathname === "/storage/inventory/") return json(route, inventory);
    if (pathname === "/storage/inventory/upload/") {
      const created = file(`file-${Date.now()}`, "uploaded.png", "업로드한 풀이 사진", "방금 올린 파일", "image", null, 12345, "image/png");
      inventory.files.unshift(created);
      return json(route, created, 201);
    }
    if (pathname === "/storage/inventory/folders/") {
      const created = { id: `f-${Date.now()}`, name: "새 폴더", parentId: null };
      inventory.folders.unshift(created);
      return json(route, created, 201);
    }
    if (pathname === "/storage/inventory/presign/") return json(route, { url: inlineSvgThumb("파일") });
    if (pathname.startsWith("/storage/inventory/files/") || pathname.startsWith("/storage/inventory/folders/")) return json(route, { ok: true });
    if (pathname === "/storage/quota/") return json(route, { usedBytes: 1_986_000, limitBytes: 10_000_000_000, plan: "pro" });

    if (pathname === "/student/fees/invoices/") return json(route, feeInvoices());
    if (pathname.match(/^\/student\/fees\/invoices\/\d+\/$/)) return json(route, feeInvoices()[0]);
    if (pathname === "/student/fees/payments/") return json(route, feePayments());

    apiMisses.push({ method, pathname });
    return json(route, {});
  } catch (error) {
    apiMisses.push({ method, pathname, error: String(error) });
    return json(route, { detail: String(error) }, 500);
  }
}

function json(route, data, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(data),
  });
}

function readJsonBody(request) {
  try {
    return request.postDataJSON();
  } catch {
    return {};
  }
}

function userPayload() {
  return {
    id: student.id,
    username: student.username,
    name: student.name,
    phone: student.phone,
    is_staff: false,
    is_superuser: false,
    tenantRole: "student",
    must_change_password: false,
  };
}

function programPayload() {
  return {
    tenantCode: "hakwonplus",
    display_name: "학원플러스",
    ui_config: {
      login_title: "학원플러스",
      window_title: "학원플러스",
      primary_color: "#2563eb",
    },
    feature_flags: { student_fees: true, fees: true },
    is_active: true,
  };
}

function dashboardPayload() {
  return {
    notices: posts.notice.map(({ id, title, created_at, is_urgent }) => ({ id, title, created_at, is_urgent })),
    today_sessions: sessions.filter((s) => s.date === today),
    badges: { clinic_upcoming: true, counseling_upcoming: true },
    tenant_info: {
      name: "학원플러스 본원",
      phone: "02-1234-5678",
      headquarters_phone: "02-0000-1111",
      academies: [
        { name: "대치관", phone: "02-2222-3333" },
        { name: "목동관", phone: "02-4444-5555" },
      ],
    },
  };
}

function sessionDetail(id) {
  return sessions.find((s) => s.id === id) || sessions[0];
}

function examById(id) {
  return exams.find((e) => e.id === id) || exams[0];
}

function examQuestions() {
  return Array.from({ length: 12 }, (_, i) => ({ id: 9000 + i + 1, number: i + 1, score: i < 8 ? 5 : 10 }));
}

function examResult(id) {
  const isRemediated = id === 8104;
  return {
    exam_id: id,
    attempt_id: 991,
    total_score: id === 8103 ? 86 : 58,
    max_score: 100,
    is_pass: id === 8103,
    final_pass: id === 8103 || isRemediated,
    remediated: isRemediated,
    clinic_retake: isRemediated ? { score: 82, pass_score: 70, attempt_id: 992, resolved_at: isoHours(-12) } : null,
    clinic_required: id !== 8103 && !isRemediated,
    is_provisional: false,
    meta_status: null,
    submitted_at: isoHours(-185),
    can_retake: true,
    answer_visibility: "always",
    answers_visible: true,
    rank: 3,
    percentile: 82,
    cohort_size: 18,
    cohort_avg: 74.2,
  };
}

function examResultItems() {
  return Array.from({ length: 12 }, (_, i) => ({
    question_id: 9000 + i + 1,
    question_number: i + 1,
    student_answer: String((i % 5) + 1),
    correct_answer: String(((i + (i % 4 === 0 ? 1 : 0)) % 5) + 1),
    score: i % 4 === 0 ? 0 : i < 8 ? 5 : 10,
    max_score: i < 8 ? 5 : 10,
    is_correct: i % 4 !== 0,
  }));
}

function videoPlayback(videoId) {
  return {
    video: Object.values(videosBySession).flat().find((v) => v.id === videoId) || videosBySession[1101][0],
    mp4_url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    hls_url: null,
    play_url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    playback_token: "audit-token",
    playback_session_id: "audit-session",
    playback_expires_at: Math.floor(Date.now() / 1000) + 3600,
    policy: {
      allow_seek: true,
      monitoring_enabled: true,
      playback_rate: { max: 1.5, ui_control: true },
      watermark: { enabled: true, mode: "overlay", fields: ["name", "ps_number"] },
      access_mode: "enrolled",
    },
  };
}

function videoStatsPayload() {
  return {
    total_videos: 14,
    completed_videos: 5,
    completion_rate: 36,
    total_watch_duration: 18420,
    total_content_duration: 31500,
    lectures: [
      { lecture_id: 7101, title: "고2 수학II 심화", video_count: 7, completed_count: 3, total_duration: 15840, progress_pct: 54 },
      { lecture_id: 7102, title: "영어 독해 실전", video_count: 4, completed_count: 1, total_duration: 9340, progress_pct: 29 },
      { lecture_id: 7770, title: "공개 특강", video_count: 3, completed_count: 1, total_duration: 6320, progress_pct: 44 },
    ],
  };
}

function videoComments(videoId) {
  return {
    total: 2,
    comments: [
      { id: 1, content: "12분 30초 예제에서 부호가 바뀌는 기준이 궁금합니다.", author_type: "student", author_name: student.name, author_photo_url: student.profile_photo_url, is_edited: false, is_deleted: false, is_mine: true, created_at: isoHours(-3), reply_count: 1, replies: [{ id: 2, content: "해당 지점 전후의 도함수 부호를 먼저 비교해보면 됩니다.", author_type: "teacher", author_name: "박민수", author_photo_url: null, is_edited: false, is_deleted: false, is_mine: false, created_at: isoHours(-2), reply_count: 0, replies: [] }] },
    ],
  };
}

function attendancePayload() {
  return {
    summary: { total: 24, present: 21, late: 2, absent: 1, rate: 87.5 },
    recent: [
      { session_id: 1101, title: "도함수 활용", date: today, status: "present" },
      { session_id: 1098, title: "미분계수", date: lastWeek, status: "late" },
    ],
  };
}

function repliesFor(postId) {
  if ([801, 901].includes(postId)) {
    return [
      { id: postId + 100, question: postId, content: "좋은 질문입니다. 수업 시간에 쓴 부호표를 기준으로 다시 설명해둘게요.", created_at: isoHours(-5), created_by_display: "박민수 선생님", author_role: "teacher" },
    ];
  }
  return [];
}

function findPost(id) {
  return Object.values(posts).flat().find((p) => p.id === id) || null;
}

function feeInvoices() {
  return [
    { id: 1, title: "6월 수강료", amount: 420000, due_date: tomorrow, status: "unpaid", line_items: [{ label: "고2 수학II 심화", amount: 260000 }, { label: "영어 독해 실전", amount: 160000 }] },
    { id: 2, title: "5월 수강료", amount: 420000, due_date: addDays(-21), status: "paid", line_items: [] },
  ];
}

function feePayments() {
  return [
    { id: 10, invoice: 2, amount: 420000, paid_at: isoHours(-24 * 21), method: "card" },
  ];
}

function post(id, post_type, title, content, opts = {}) {
  const created = opts.created || isoHours(-id % 48);
  return {
    id,
    post_type,
    title,
    content,
    created_by: post_type === "qna" || post_type === "counsel" ? student.id : null,
    created_by_display: opts.author || (post_type === "qna" || post_type === "counsel" ? student.name : "학원플러스"),
    author_role: post_type === "qna" || post_type === "counsel" ? "student" : "staff",
    created_at: created,
    updated_at: created,
    replies_count: opts.replies || 0,
    like_count: 3,
    is_liked: false,
    is_urgent: Boolean(opts.urgent),
    is_pinned: Boolean(opts.pinned),
    category_label: opts.category || null,
    status: "published",
    published_at: created,
    mappings: [
      { id: id + 2000, post: id, node: 1, node_detail: { id: 1, level: "COURSE", lecture: 7101, session: null, lecture_title: "고2 수학II 심화", session_title: null }, created_at: created },
    ],
    attachments: opts.attachments ? [{ id: id + 1, original_name: `${title}.pdf`, size_bytes: 240000, content_type: "application/pdf", created_at: created }] : [],
  };
}

function videoItem(id, session_id, title, order, duration, progress, completed) {
  return {
    id,
    session_id,
    title,
    status: "READY",
    thumbnail_url: inlineSvgThumb(title.slice(0, 8)),
    duration,
    progress,
    completed,
    last_position: Math.round(duration * progress / 100),
    allow_skip: true,
    max_speed: 1.5,
    show_watermark: true,
    access_mode: session_id === 7771 ? "public" : "enrolled",
    order,
    view_count: 48 + order,
    like_count: 12 + order,
    comment_count: order + 1,
    is_liked: order === 1,
    created_at: isoHours(-24 * (order + 1)),
    updated_at: isoHours(-order),
  };
}

function file(id, name, displayName, description, icon, folderId, sizeBytes, contentType) {
  return {
    id,
    name,
    displayName,
    description,
    icon,
    folderId,
    sizeBytes,
    r2Key: `audit/${id}/${name}`,
    contentType,
    createdAt: isoHours(-24),
  };
}

function addDays(delta) {
  const d = new Date(now);
  d.setDate(d.getDate() + delta);
  return ymd(d);
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoHours(deltaHours) {
  const d = new Date(now.getTime() + deltaHours * 3600 * 1000);
  return d.toISOString();
}

function inlineSvgAvatar(label) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="24" fill="#1d4ed8"/><circle cx="118" cy="38" r="22" fill="#60a5fa"/><text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="64" font-weight="800" fill="white">${label}</text></svg>`)}`;
}

function inlineSvgThumb(label) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><rect x="42" y="42" width="556" height="276" rx="20" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.24)"/><circle cx="320" cy="180" r="48" fill="rgba(255,255,255,.88)"/><path d="M306 154v52l44-26z" fill="#1d4ed8"/><text x="56" y="304" font-family="Arial" font-size="34" font-weight="800" fill="#fff">${label}</text></svg>`)}`;
}
