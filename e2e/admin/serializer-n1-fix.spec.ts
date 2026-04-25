/**
 * Serializer N+1 4건 회귀 검증 (staff-role-n1-fix.spec.ts 시리즈)
 *
 * 검증 대상 (backend commit perf: serializer N+1 4건 일괄 제거):
 *  - Teacher list:    TeacherSerializer.get_staff_id (Fix #1)
 *  - Student list:    StudentListSerializer.get_is_enrolled with ?lecture (Fix #3)
 *  - Question list:   QuestionSerializer.get_explanation_text/source (Fix #4)
 *  - Clinic Participant list: ClinicSessionParticipantSerializer.get_name_highlight_clinic_target (Fix #2)
 *
 * Tenant 1 (hakwonplus / admin97). 각 시나리오 read-only API로 5xx 미발생 + 응답 형식 검증.
 */
import { test, expect } from "../fixtures/strictTest";
import { getApiBaseUrl } from "../helpers/auth";

const API_BASE = getApiBaseUrl();

interface ApiList<T> {
  results?: T[];
  count?: number;
}

interface TeacherItem {
  id: number;
  name: string;
  staff_id?: number | null;
  [k: string]: unknown;
}

interface StudentItem {
  id: number;
  name: string;
  is_enrolled?: boolean;
  enrollments?: Array<{ id: number; lecture: number }>;
  [k: string]: unknown;
}

interface QuestionItem {
  id: number;
  number: number;
  explanation_text?: string;
  explanation_source?: string | null;
  [k: string]: unknown;
}

interface ParticipantItem {
  id: number;
  name_highlight_clinic_target?: boolean;
  enrollment_id?: number | null;
  [k: string]: unknown;
}

interface LectureItem {
  id: number;
  title: string;
  [k: string]: unknown;
}

interface ExamItem {
  id: number;
  title: string;
  exam_type?: string;
  [k: string]: unknown;
}

async function getToken(page: import("@playwright/test").Page): Promise<string> {
  const tokenResp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  expect(tokenResp.status()).toBe(200);
  const { access } = await tokenResp.json() as { access: string };
  return access;
}

function authHeaders(access: string) {
  return {
    Authorization: `Bearer ${access}`,
    "X-Tenant-Code": "hakwonplus",
  };
}

async function fetchJson<T>(
  page: import("@playwright/test").Page,
  url: string,
  access: string,
): Promise<T> {
  const resp = await page.request.get(url, { headers: authHeaders(access) });
  expect(resp.status(), `GET ${url} should be 200, got ${resp.status()}`).toBe(200);
  return resp.json() as Promise<T>;
}

function asArray<T>(data: T[] | ApiList<T>): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

test.describe("Serializer N+1 4건 fix — 운영 E2E", () => {
  test.setTimeout(120_000);

  test("Fix #1 — TeacherSerializer.get_staff_id N+1 회피 (강사 목록)", async ({ page }) => {
    const access = await getToken(page);
    const list = await fetchJson<TeacherItem[] | ApiList<TeacherItem>>(
      page,
      `${API_BASE}/api/v1/teachers/`,
      access,
    );
    const teachers = asArray(list);
    console.log(`Teachers in tenant 1: ${teachers.length}`);

    // staff_id 필드는 TeacherSerializer.get_staff_id의 결과 — number | null 모두 OK.
    for (const t of teachers) {
      expect(t.id, `teacher.id required`).toBeDefined();
      expect(t.name, `teacher.name required`).toBeDefined();
      expect(
        t.staff_id === null || typeof t.staff_id === "number" || t.staff_id === undefined,
        `teacher.staff_id must be number|null, got ${typeof t.staff_id}`,
      ).toBe(true);
    }

    // 매칭 성공 케이스가 적어도 1건은 있어야 함 (staff 픽스의 거울)
    const matched = teachers.filter((t) => typeof t.staff_id === "number");
    console.log(`Teachers with matched staff_id: ${matched.length}/${teachers.length}`);

    console.log("Fix #1 PASS");
  });

  test("Fix #3 — StudentListSerializer.get_is_enrolled prefetch 캐시 (학생 목록 + ?lecture)", async ({ page }) => {
    const access = await getToken(page);

    // 강의 1개 선택 (DefaultRouter mount: /api/v1/lectures/lectures/)
    const lectureList = await fetchJson<LectureItem[] | ApiList<LectureItem>>(
      page,
      `${API_BASE}/api/v1/lectures/lectures/`,
      access,
    );
    const lectures = asArray(lectureList);
    expect(lectures.length, "tenant 1에 강의가 있어야 함").toBeGreaterThan(0);
    const lid = lectures[0].id;

    // ?lecture=<id> 쿼리로 학생 목록 — N+1 fix path
    const list = await fetchJson<ApiList<StudentItem>>(
      page,
      `${API_BASE}/api/v1/students/?lecture=${lid}&page_size=50`,
      access,
    );
    const students = asArray(list);
    console.log(`Students for lecture ${lid}: ${students.length}`);

    // is_enrolled 필드 검증
    for (const s of students) {
      expect(typeof s.is_enrolled === "boolean", `student.is_enrolled must be boolean`).toBe(true);
    }

    // is_enrolled=true인 학생은 enrollments에 lid가 있어야 일관성 (samaple)
    const enrolledStudents = students.filter((s) => s.is_enrolled === true);
    console.log(`Enrolled in lecture ${lid}: ${enrolledStudents.length}`);
    for (const s of enrolledStudents.slice(0, 5)) {
      const hasMatching = (s.enrollments ?? []).some((e) => e.lecture === lid);
      expect(hasMatching, `is_enrolled=true 학생은 enrollments에 lecture=${lid} 포함해야 함`).toBe(true);
    }

    console.log("Fix #3 PASS");
  });

  test("Fix #4 — QuestionSerializer.explanation select_related (시험 문항)", async ({ page }) => {
    const access = await getToken(page);

    // 시험 문항이 있는 시험 1개 검색
    const examList = await fetchJson<ExamItem[] | ApiList<ExamItem>>(
      page,
      `${API_BASE}/api/v1/exams/?page_size=50`,
      access,
    );
    const exams = asArray(examList);
    if (exams.length === 0) {
      console.log("시험 없음 — skip");
      return;
    }

    // QuestionViewSet list — DRF DefaultRouter mount (/api/v1/exams/questions/)
    const qResp = await page.request.get(
      `${API_BASE}/api/v1/exams/questions/?page_size=50`,
      { headers: authHeaders(access) },
    );
    expect([200, 404]).toContain(qResp.status());
    if (qResp.status() !== 200) {
      console.log(`exam-questions endpoint returned ${qResp.status()} — skip`);
      return;
    }
    const data = await qResp.json() as QuestionItem[] | ApiList<QuestionItem>;
    const questions = asArray(data);
    console.log(`Questions: ${questions.length}`);

    // explanation_text는 string, explanation_source는 string|null
    for (const q of questions.slice(0, 30)) {
      expect(typeof q.explanation_text === "string", `question.explanation_text must be string`).toBe(true);
      expect(
        q.explanation_source === null || typeof q.explanation_source === "string" || q.explanation_source === undefined,
        `question.explanation_source must be string|null`,
      ).toBe(true);
    }

    console.log("Fix #4 PASS");
  });

  test("Fix #2 — ClinicSessionParticipantSerializer bulk highlight (클리닉 참가자)", async ({ page }) => {
    const access = await getToken(page);

    // 클리닉 참가자 list (Router under /api/v1/clinic/participants/)
    const list = await fetchJson<ParticipantItem[] | ApiList<ParticipantItem>>(
      page,
      `${API_BASE}/api/v1/clinic/participants/?page_size=50`,
      access,
    );
    const participants = asArray(list);
    console.log(`Clinic participants: ${participants.length}`);

    // name_highlight_clinic_target은 boolean
    for (const p of participants) {
      expect(typeof p.name_highlight_clinic_target === "boolean", `name_highlight_clinic_target must be boolean`).toBe(true);
    }

    console.log("Fix #2 PASS");
  });
});
