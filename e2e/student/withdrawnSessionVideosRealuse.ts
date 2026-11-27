import type { APIRequestContext } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { expectApi, QA_API, QA_TENANT } from "../helpers/qaStudentParentScenario";

export type SessionVideoFixture = { sessionId: number; videoId?: number };

type Case = {
  lectureId: number;
  enrollmentId: number;
  studentId: number;
  first: { sessionId: number; attendanceId: number; videoId: number };
  admin: string;
  student: string;
  parent: string;
  date: string;
  cleanup: { additionalSessions: SessionVideoFixture[]; attendanceIds: number[]; sessionEnrollmentIds: number[] };
};

// Run after the ordinary learning flow, using its existing first session and enrollment.
export async function verifyWithdrawnSessionVideos(request: APIRequestContext, c: Case) {
  const sessions = [c.first];
  for (const order of [2, 3]) {
    const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", c.admin, {
      lecture: c.lectureId, title: `QA 수강 복구 ${order}차시`, date: c.date, order,
    });
    const fixture: SessionVideoFixture = { sessionId: session.id };
    c.cleanup.additionalSessions.push(fixture);
    const members = await expectApi<Array<{ id: number }>>(request, "POST", "/enrollments/session-enrollments/bulk_create/",
      c.admin, { session: session.id, enrollments: [c.enrollmentId] });
    c.cleanup.sessionEnrollmentIds.push(...members.map(row => row.id));
    const rows = await expectApi<Array<{ id: number }>>(request, "POST", "/lectures/attendance/bulk_create/",
      c.admin, { session: session.id, students: [c.studentId] });
    expect(rows).toHaveLength(1);
    c.cleanup.attendanceIds.push(rows[0].id);
    const { video } = await expectApi<{ video: { id: number } }>(request, "POST", "/media/videos/youtube/", c.admin, {
      session: session.id, title: `QA 수강 영상 ${order}`, url: "https://youtu.be/VnqgmOJaMGc",
      show_watermark: false, allow_skip: true, max_speed: 1,
    });
    fixture.videoId = video.id;
    sessions.push({ sessionId: session.id, attendanceId: rows[0].id, videoId: video.id });
  }
  const attendance = (index: number) => `/lectures/attendance/${sessions[index].attendanceId}/`;
  const ledger = () => Promise.all(["invoices", "payments"].map(resource =>
    expectApi(request, "GET", `/student/fees/${resource}/`, c.student)));
  const before = await ledger();
  await expectApi(request, "PATCH", attendance(0), c.admin, {
    status: "SECESSION", confirm_secession: true, secession_scope: "session",
  });
  await expectApi(request, "PATCH", attendance(1), c.admin, {
    status: "SECESSION", confirm_secession: true, secession_scope: "lecture",
  });
  for (let retry = 0; retry < 2; retry++) {
    await expectApi(request, "PATCH", attendance(2), c.admin, { status: "ONLINE", restore_scope: "lecture" });
  }
  for (const [index, s] of sessions.entries()) {
    const row = await expectApi(request, "GET", attendance(index), c.admin);
    expect(row).toMatchObject({ id: s.attendanceId, enrollment_id: c.enrollmentId,
      session: s.sessionId, status: index === 2 ? "ONLINE" : "SECESSION" });
  }
  const members = await expectApi<Array<{ id: number; enrollment: number }>>(request, "GET",
    `/enrollments/session-enrollments/?session=${sessions[2].sessionId}`, c.admin);
  expect(members.map(row => row.enrollment)).toEqual([c.enrollmentId]);
  c.cleanup.sessionEnrollmentIds.push(...members.map(row => row.id));
  for (const role of ["student", "parent"] as const) {
    const headers = { Authorization: `Bearer ${c[role]}`, "X-Tenant-Code": QA_TENANT,
      ...(role === "parent" ? { "X-Student-Id": String(c.studentId) } : {}) };
    const get = (path: string) => request.get(`${QA_API}/api/v1${path}`, { headers });
    const overview = await get("/student/video/me/");
    expect(overview.status()).toBe(200);
    const { lectures } = await overview.json() as { lectures: Array<{
      id: number; sessions: Array<{ id: number }>; video_count: number;
    }> };
    const lecture = lectures.find(item => item.id === c.lectureId);
    expect(lecture?.sessions.map(s => s.id)).toEqual([sessions[2].sessionId]);
    expect(lecture?.video_count).toBe(1);
    for (const [index, s] of sessions.entries()) {
      const list = await get(`/student/video/sessions/${s.sessionId}/videos/?enrollment=${c.enrollmentId}`);
      const access = await get(`/student/video/videos/${s.videoId}/playback/?access_check=1&enrollment=${c.enrollmentId}`);
      const expected = index === 2 ? 200 : 403;
      expect([list.status(), access.status()], `${role} session ${index + 1}`).toEqual([expected, expected]);
      if (index === 2) expect((await list.json()).items).toEqual([expect.objectContaining({ id: s.videoId })]);
    }
  }
  expect(await ledger()).toEqual(before);
}
