// PATH: src/app_admin/domains/students/components/StudentEnrollmentMatrixDrawer.tsx
// 학생 1명 × 강의 세션 시험/과제 enrollment matrix UI (Phase #11/#12, 2026-05-12).
//
// 학원장 시점:
//   학생 A → 강의 선택 → 세션 list × (시험/과제) checkbox grid
//   클릭 1번으로 학생을 특정 시험/과제에 추가/제거
//
// 권한: staff only (학생 detail overlay 안의 탭으로 진입)
/* eslint-disable no-restricted-syntax */

import { useEffect, useState, useCallback } from "react";
import { feedback } from "@/shared/ui/feedback/feedback";
import { Badge } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import {
  fetchStudentEnrollmentMatrix,
  toggleStudentEnrollmentMatrix,
  type StudentEnrollmentMatrix,
  type MatrixToggleTarget,
} from "../api/enrollmentMatrix.api";
import { formatSessionLabel } from "@/shared/product/sessions/sessionOrdering";

type Lecture = { id: number; title: string };

type Props = {
  studentId: number;
  studentName: string;
  /** 학생의 active enrollments에서 fetch한 강의 list (학생이 등록된 강의만) */
  lectures: Lecture[];
};

export default function StudentEnrollmentMatrixDrawer({ studentId, studentName, lectures }: Props) {
  const [selectedLectureId, setSelectedLectureId] = useState<number | null>(lectures[0]?.id ?? null);
  const [matrix, setMatrix] = useState<StudentEnrollmentMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (lectureId: number) => {
    setLoading(true);
    try {
      const data = await fetchStudentEnrollmentMatrix(studentId, lectureId);
      setMatrix(data);
    } catch (e: unknown) {
      feedback.error(getApiErrorMessage(e, "수강 매트릭스 조회 실패"));
      setMatrix(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (selectedLectureId) void load(selectedLectureId);
  }, [selectedLectureId, load]);

  const toggle = async (target_type: MatrixToggleTarget, target_id: number, current: boolean) => {
    if (!selectedLectureId || busy) return;
    const key = `${target_type}-${target_id}`;
    setBusy(key);
    try {
      await toggleStudentEnrollmentMatrix({
        student_id: studentId,
        lecture_id: selectedLectureId,
        target_type, target_id,
        action: current ? "remove" : "add",
      });
      await load(selectedLectureId);
    } catch (e: unknown) {
      feedback.error(getApiErrorMessage(e, "변경 실패"));
    } finally {
      setBusy(null);
    }
  };

  if (lectures.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13.5 }}>
        {studentName} 학생이 등록된 강의가 없습니다.
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 4px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 강의 chip selector */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
          강의 선택
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {lectures.map((l) => {
            const on = l.id === selectedLectureId;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedLectureId(l.id)}
                data-testid={`matrix-lecture-${l.id}`}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: `1px solid ${on ? "var(--color-brand-primary)" : "var(--color-border-divider)"}`,
                  background: on ? "color-mix(in srgb, var(--color-brand-primary) 12%, var(--color-bg-surface))" : "var(--color-bg-surface)",
                  color: on ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
                  fontSize: 12.5,
                  fontWeight: on ? 700 : 600,
                  cursor: "pointer",
                  letterSpacing: "-0.01em",
                }}
              >{l.title}</button>
            );
          })}
        </div>
      </div>

      {/* matrix body */}
      {loading ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>불러오는 중…</div>
      ) : !matrix || matrix.sessions.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
          {matrix?.detail || "세션이 없습니다."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {matrix.sessions.map((s) => {
            const totalItems = s.exams.length + s.homeworks.length;
            return (
              <div
                key={s.id}
                data-testid={`matrix-session-${s.id}`}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-divider)",
                }}
              >
                {/* session header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge variant={s.session_enrolled ? "solid" : "soft"} size="sm" tone={s.session_enrolled ? "success" : "neutral"}>
                      {formatSessionLabel(s)}
                    </Badge>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-text-primary)" }}>
                      {s.title}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                      {totalItems}건
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle("session", s.id, s.session_enrolled)}
                    disabled={busy === `session-${s.id}`}
                    data-testid={`matrix-toggle-session-${s.id}`}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: `1px solid ${s.session_enrolled ? "rgba(239,68,68,0.3)" : "var(--color-border-divider)"}`,
                      background: "transparent",
                      color: s.session_enrolled ? "#ef4444" : "var(--color-text-secondary)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: busy === `session-${s.id}` ? "wait" : "pointer",
                    }}
                  >
                    {s.session_enrolled ? "세션 빼기" : "세션 추가"}
                  </button>
                </div>

                {/* exams + homeworks 2-col grid */}
                {totalItems > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {/* Exams col */}
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#2563EB", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                        시험 ({s.exams.length})
                      </div>
                      {s.exams.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", padding: "6px 8px" }}>—</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {s.exams.map((e) => (
                            <CellRow
                              key={`e-${e.id}`}
                              kind="exam"
                              targetId={e.id}
                              title={e.title}
                              enrolled={e.enrolled}
                              busy={busy === `exam-${e.id}`}
                              onToggle={() => toggle("exam", e.id, e.enrolled)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Homeworks col */}
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#0a8d4d", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                        과제 ({s.homeworks.length})
                      </div>
                      {s.homeworks.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", padding: "6px 8px" }}>—</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {s.homeworks.map((h) => (
                            <CellRow
                              key={`h-${h.id}`}
                              kind="homework"
                              targetId={h.id}
                              title={h.title}
                              enrolled={h.enrolled}
                              busy={busy === `homework-${h.id}`}
                              onToggle={() => toggle("homework", h.id, h.enrolled)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        💡 추가 시 자동으로 해당 세션도 등록됩니다. 제거하면 해당 시험·과제만 빠집니다.
      </p>
    </div>
  );
}

function CellRow({ kind, targetId, title, enrolled, busy, onToggle }: {
  kind: "exam" | "homework"; targetId: number; title: string; enrolled: boolean; busy: boolean; onToggle: () => void;
}) {
  return (
    <label
      data-testid={`matrix-${kind}-${targetId}`}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px",
        borderRadius: 8,
        background: enrolled ? "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-canvas))" : "var(--color-bg-canvas)",
        border: `1px solid ${enrolled ? "color-mix(in srgb, var(--color-brand-primary) 28%, transparent)" : "var(--color-border-divider)"}`,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "background 0.12s, border-color 0.12s",
        minWidth: 0,
      }}
    >
      <input
        type="checkbox"
        checked={enrolled}
        disabled={busy}
        onChange={onToggle}
        style={{ width: 14, height: 14, accentColor: "var(--color-brand-primary)", cursor: busy ? "wait" : "pointer", flexShrink: 0 }}
      />
      <span style={{
        fontSize: 12.5,
        color: enrolled ? "var(--color-text-primary)" : "var(--color-text-secondary)",
        fontWeight: enrolled ? 600 : 500,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        flex: 1, minWidth: 0,
      }}>{title}</span>
    </label>
  );
}
