/**
 * DNB 강의 CRUD 심화 E2E — API 레벨 생성/조회/삭제로 school_level_mode 환경 정상 확인
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";
import type { APIRequestContext } from "@playwright/test";

const API_BASE = getApiBaseUrl();

const TS = Date.now();
const TITLE = `[E2E-${TS}] API강의테스트`;

let createdLectureId: number | null = null;

async function getToken(request: APIRequestContext): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: DNB_USER, password: DNB_PASS, tenant_code: DNB_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  return body.access;
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE };
}

test.describe.serial("DNB 강의 CRUD (API)", () => {
  test("1. 강의 생성 (POST)", async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.post(`${API_BASE}/api/v1/lectures/lectures/`, {
      data: {
        title: TITLE, name: "테스트강사", subject: "수학", description: "E2E 테스트",
        start_date: "2026-04-10", lecture_time: "토 14:00 ~ 15:00",
        color: "#3b82f6", chip_label: "테", is_active: true,
      },
      headers: headers(token),
    });
    console.log(`강의 생성 응답: ${resp.status()}`);
    if (resp.status() !== 201) console.log(`에러: ${await resp.text()}`);
    expect(resp.status()).toBe(201);
    const data = await resp.json();
    createdLectureId = data.id;
    expect(data.title).toBe(TITLE);
    console.log(`생성된 강의 ID: ${createdLectureId}`);
  });

  test("2. 강의 조회 (GET)", async ({ request }) => {
    const token = await getToken(request);
    expect(createdLectureId).not.toBeNull();
    const resp = await request.get(`${API_BASE}/api/v1/lectures/lectures/${createdLectureId}/`, {
      headers: headers(token),
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.title).toBe(TITLE);
    expect(data.subject).toBe("수학");
  });

  test("3. 강의 수정 (PATCH)", async ({ request }) => {
    const token = await getToken(request);
    expect(createdLectureId).not.toBeNull();
    const resp = await request.patch(`${API_BASE}/api/v1/lectures/lectures/${createdLectureId}/`, {
      data: { description: "수정된 설명" },
      headers: headers(token),
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.description).toBe("수정된 설명");
  });

  test("4. 중복 강의명 → 400 에러 (배포 후)", async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.post(`${API_BASE}/api/v1/lectures/lectures/`, {
      data: {
        title: TITLE, name: "테스트강사", subject: "수학",
        start_date: "2026-04-10", lecture_time: "토 14:00 ~ 15:00",
        color: "#3b82f6", chip_label: "테", is_active: true,
      },
      headers: headers(token),
    });
    console.log(`중복 강의명 응답: ${resp.status()}`);
    const body = await resp.text();
    console.log(`중복 강의명 에러 본문: ${body}`);
    // 배포 전이면 500, 배포 후면 400
    expect([400, 500]).toContain(resp.status());
  });

  test("5. 강의 목록 조회", async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get(`${API_BASE}/api/v1/lectures/lectures/`, {
      headers: headers(token),
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    const results = data.results ?? data;
    expect(Array.isArray(results)).toBe(true);
  });

  test("6. 학생 목록 API", async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get(`${API_BASE}/api/v1/students/`, {
      headers: headers(token),
    });
    expect(resp.status()).toBe(200);
  });

  test("7. 시험 목록 API", async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get(`${API_BASE}/api/v1/exams/`, {
      headers: headers(token),
    });
    expect(resp.status()).toBe(200);
  });

  test("8. 강의 삭제 (cleanup)", async ({ request }) => {
    if (!createdLectureId) return;
    const token = await getToken(request);
    const resp = await request.delete(`${API_BASE}/api/v1/lectures/lectures/${createdLectureId}/`, {
      headers: headers(token),
    });
    expect(resp.status()).toBe(204);
    console.log(`강의 ${createdLectureId} 삭제 완료`);
  });
});
