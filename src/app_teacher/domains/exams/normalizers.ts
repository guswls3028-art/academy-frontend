export type TeacherExamDetail = {
  id: number;
  title: string;
  max_score: number | null;
  session_ids: number[];
};

export type ExamResultRow = {
  id: number | null;
  enrollment_id: number;
  student_name: string;
  exam_score: number | null;
  final_score: number | null;
  total_score: number | null;
  exam_max_score: number | null;
  passed: boolean | null;
  is_pass: boolean | null;
  final_pass: boolean | null;
  achievement: string | null;
  rank: number | null;
};

export type LectureEnrollment = {
  id: number;
  status: string | null;
  student_name: string;
};

export type TeacherSession = {
  lecture_id: number | null;
};

export type TeacherScoreExam = {
  id: number;
  title: string;
  max_score: number | null;
  pass_score: number | null;
};

export type TeacherHomeworkDetail = {
  id: number;
  title: string;
  session_title: string | null;
  due_date: string | null;
  max_score: number | null;
};

export type HomeworkSubmission = {
  id: number;
  student_id: number | null;
  student_name: string;
  student_phone: string | null;
  parent_phone: string | null;
  submitted_at: string | null;
  status: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  return Array.isArray(record.results) ? record.results : [];
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getStudentName(record: Record<string, unknown>): string {
  const student = asRecord(record.student);
  return (
    toStringValue(record.student_name)
    ?? toStringValue(record.enrollment_name)
    ?? toStringValue(student.name)
    ?? toStringValue(record.name)
    ?? "이름 없음"
  );
}

function getStudentId(record: Record<string, unknown>): number | null {
  const student = asRecord(record.student);
  return toNumber(record.student_id ?? record.student ?? student.id);
}

export function normalizeExam(value: unknown): TeacherExamDetail | null {
  const record = asRecord(value);
  const id = toNumber(record.id);
  if (id == null) return null;
  const sessionIds = Array.isArray(record.session_ids)
    ? record.session_ids.map(toNumber).filter((v): v is number => v != null)
    : [];

  return {
    id,
    title: toStringValue(record.title) ?? "시험",
    max_score: toNumber(record.max_score),
    session_ids: sessionIds,
  };
}

function normalizeResultRow(value: unknown): ExamResultRow | null {
  const record = asRecord(value);
  const enrollmentId = toNumber(record.enrollment_id ?? record.enrollment);
  if (enrollmentId == null) return null;

  return {
    id: toNumber(record.id),
    enrollment_id: enrollmentId,
    student_name: getStudentName(record),
    exam_score: toNumber(record.exam_score ?? record.score),
    final_score: toNumber(record.final_score),
    total_score: toNumber(record.total_score),
    exam_max_score: toNumber(record.exam_max_score ?? record.max_score),
    passed: toBoolean(record.passed),
    is_pass: toBoolean(record.is_pass),
    final_pass: toBoolean(record.final_pass),
    achievement: toStringValue(record.achievement),
    rank: toNumber(record.rank),
  };
}

export function normalizeResultRows(value: unknown): ExamResultRow[] {
  return unwrapList(value)
    .map(normalizeResultRow)
    .filter((row): row is ExamResultRow => row != null);
}

function normalizeEnrollment(value: unknown): LectureEnrollment | null {
  const record = asRecord(value);
  const id = toNumber(record.id);
  if (id == null) return null;

  return {
    id,
    status: toStringValue(record.status),
    student_name: getStudentName(record),
  };
}

export function normalizeEnrollments(value: unknown): LectureEnrollment[] {
  return unwrapList(value)
    .map(normalizeEnrollment)
    .filter((row): row is LectureEnrollment => row != null);
}

export function normalizeSession(value: unknown): TeacherSession {
  const record = asRecord(value);
  return {
    lecture_id: toNumber(record.lecture ?? record.lecture_id),
  };
}

function normalizeScoreExam(value: unknown): TeacherScoreExam | null {
  const record = asRecord(value);
  const id = toNumber(record.id);
  if (id == null) return null;

  return {
    id,
    title: toStringValue(record.title) ?? "시험",
    max_score: toNumber(record.max_score),
    pass_score: toNumber(record.pass_score),
  };
}

export function normalizeScoreExams(value: unknown): TeacherScoreExam[] {
  return unwrapList(value)
    .map(normalizeScoreExam)
    .filter((exam): exam is TeacherScoreExam => exam != null);
}

export function normalizeHomework(value: unknown): TeacherHomeworkDetail | null {
  const record = asRecord(value);
  const meta = asRecord(record.meta);
  const id = toNumber(record.id);
  if (id == null) return null;

  return {
    id,
    title: toStringValue(record.title) ?? "과제",
    session_title: toStringValue(record.session_title),
    due_date: toStringValue(record.due_date) ?? toStringValue(meta.due_date),
    max_score: toNumber(record.max_score ?? meta.default_max_score ?? meta.max_score),
  };
}

function normalizeHomeworkSubmission(value: unknown): HomeworkSubmission | null {
  const record = asRecord(value);
  const id = toNumber(record.id);
  if (id == null) return null;

  return {
    id,
    student_id: getStudentId(record),
    student_name: getStudentName(record),
    student_phone: toStringValue(record.student_phone),
    parent_phone: toStringValue(record.parent_phone),
    submitted_at: toStringValue(record.submitted_at),
    status: toStringValue(record.status),
  };
}

export function normalizeHomeworkSubmissions(value: unknown): HomeworkSubmission[] {
  return unwrapList(value)
    .map(normalizeHomeworkSubmission)
    .filter((row): row is HomeworkSubmission => row != null);
}
