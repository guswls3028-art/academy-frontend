// PATH: src/features/students/pages/StudentsDetailPage.tsx

import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";

import {
  getStudentDetail,
  getTags,
  attachStudentTag,
  detachStudentTag,
  createMemo,
  deleteStudent,
} from "../api/students";

import StudentFormModal from "../components/EditStudentModal";
import { PageHeader, Section, EmptyState, Button } from "@/shared/ui/ds";

/* ================= constants ================= */

const TABS = [
  { key: "enroll", label: "수강 이력" },
  { key: "clinic", label: "클리닉/상담 이력" },
  { key: "question", label: "질문 이력" },
  { key: "score", label: "성적 이력" },
  { key: "schoolScore", label: "학교 성적" },
];

/* ================= page ================= */

export default function StudentsDetailPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const id = Number(studentId);
  const qc = useQueryClient();

  const [tab, setTab] = useState("enroll");
  const [editOpen, setEditOpen] = useState(false);

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: () => getStudentDetail(id),
    enabled: !!id,
  });

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
  });

  const addTag = useMutation({
    mutationFn: (tagId: number) => attachStudentTag(id, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
  });

  const removeTag = useMutation({
    mutationFn: (tagId: number) => detachStudentTag(id, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
  });

  const updateMemo = useMutation({
    mutationFn: (memo: string) => createMemo(id, memo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
  });

  async function handleDelete() {
    if (!confirm("이 학생을 삭제하시겠습니까?")) return;
    await deleteStudent(id);
    qc.invalidateQueries({ queryKey: ["students"] });
    navigate(-1);
  }

  if (isLoading || !student) return null;

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={() => navigate(-1)} />

      {/* overlay wrapper */}
      <div
        className="fixed inset-0 z-50 flex justify-center overflow-auto"
        style={{
          paddingTop: "calc(var(--panel-header, 64px) + 24px)",
          paddingBottom: 32,
        }}
      >
        <div
          className="w-full max-w-[1120px]"
          style={{
            borderRadius: 22,
            background: "var(--layout-page-bg)",
            border: "1px solid var(--color-border-divider)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
          }}
        >
          {/* HEADER (GRADIENT) */}
          <div
            style={{
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              background:
                "linear-gradient(135deg, var(--color-brand-primary), var(--scale-Primary700))",
              color: "white",
            }}
          >
            <PageHeader
              title={
                <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: "-0.3px" }}>
                  {student.name}
                </div>
              }
              description={<span style={{ opacity: 0.85 }}>아이디 · {student.psNumber}</span>}
              actions={
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 900,
                      borderRadius: 999,
                      color: "white",
                      backgroundColor: student.active ? "#22c55e" : "#ef4444", // 초록/빨강
                    }}
                  >
                    {student.active ? "활성" : "비활성"}
                  </span>
                  <Button intent="secondary" size="sm" onClick={() => setEditOpen(true)}>
                    수정
                  </Button>
                  <Button intent="danger" size="sm" onClick={handleDelete}>
                    삭제
                  </Button>
                  <Button intent="ghost" size="sm" onClick={() => navigate(-1)}>
                    닫기
                  </Button>
                </div>
              }
            />
          </div>

          {/* BODY */}
          <div className="px-6 py-6">
            <Section>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "300px 1fr",
                  gap: 20,
                }}
              >
                {/* LEFT PANEL */}
                <div
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    background:
                      "linear-gradient(180deg, var(--color-bg-surface-soft), var(--color-bg-surface))",
                    border: "1px solid var(--color-border-divider)",
                  }}
                >
                  <div style={{ display: "grid", gap: 8 }}>
                    <InfoRow label="학생 전화/식별자" value={student.studentPhone} accent />
                    <InfoRow label="학부모 전화" value={student.parentPhone} />
                    <InfoRow label="성별" value={student.gender} />
                    <InfoRow label="학교" value={student.school} />
                    <InfoRow
                      label="학년"
                      value={student.grade ? `${student.grade}학년` : "-"}
                    />
                    <InfoRow label="반" value={student.schoolClass} />
                    <InfoRow label="계열" value={student.major} />
                  </div>

                  {/* TAG */}
                  <div style={{ marginTop: 18 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        marginBottom: 6,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      태그
                    </div>

                    <div className="flex flex-wrap gap-2 mb-2">
                      {student.tags?.length ? (
                        student.tags.map((t: any) => (
                          <span
                            key={t.id}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 900,
                              background: `color-mix(in srgb, ${t.color} 22%, var(--color-bg-surface))`,
                              color: t.color,
                              border: `1px solid ${t.color}`,
                            }}
                          >
                            {t.name}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                          태그 없음
                        </span>
                      )}
                    </div>

                    <select
                      className="ds-input"
                      onChange={(e) => {
                        const tagId = Number(e.target.value);
                        if (tagId) addTag.mutate(tagId);
                        e.currentTarget.value = "";
                      }}
                    >
                      <option value="">태그 추가…</option>
                      {tags?.map((tag: any) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* MEMO */}
                  <div style={{ marginTop: 18 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        marginBottom: 6,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      메모
                    </div>
                    <textarea
                      className="ds-textarea"
                      rows={4}
                      defaultValue={student.memo}
                      placeholder="메모..."
                      onBlur={(e) => updateMemo.mutate(e.target.value)}
                    />
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface)), var(--color-bg-surface))",
                    border: "1px solid var(--color-border-divider)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      padding: 6,
                      marginBottom: 14,
                      borderRadius: 14,
                      background: "var(--color-bg-surface-soft)",
                      border: "1px solid var(--color-border-divider)",
                    }}
                  >
                    {TABS.map((t) => {
                      const active = tab === t.key;
                      return (
                        <button
                          key={t.key}
                          onClick={() => setTab(t.key)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 12,
                            fontSize: 13,
                            fontWeight: 900,
                            color: active ? "white" : "var(--color-text-secondary)",
                            background: active
                              ? "linear-gradient(135deg, var(--color-brand-primary), var(--scale-Primary600))"
                              : "transparent",
                            boxShadow: active ? "0 6px 18px rgba(0,0,0,0.35)" : "none",
                          }}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ minHeight: 260 }}>
                    {tab === "enroll" ? (
                      <EnrollmentsTab enrollments={student.enrollments} />
                    ) : (
                      <EmptyState title="데이터가 없습니다." />
                    )}
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>

      {/* 🔧 수정 버튼 모달 포탈 */}
      {editOpen &&
        createPortal(
          <StudentFormModal
            open={true}
            initialValue={student}
            onClose={() => setEditOpen(false)}
            onSuccess={() => {
              setEditOpen(false);
              qc.invalidateQueries({ queryKey: ["student", id] });
            }}
          />,
          document.body
        )}
    </>
  );
}

/* ================= sub ================= */

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: any;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 12,
        background: accent
          ? "color-mix(in srgb, var(--color-brand-primary) 10%, var(--color-bg-surface))"
          : "var(--color-bg-surface)",
        border: "1px solid var(--color-border-divider)",
        fontSize: 12,
      }}
    >
      <span style={{ fontWeight: 800, color: "var(--color-text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 950, color: "var(--color-text-primary)" }}>{value || "-"}</span>
    </div>
  );
}

function EnrollmentsTab({ enrollments }: { enrollments: any[] }) {
  if (!enrollments?.length) return <EmptyState title="수강 이력이 없습니다." />;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {enrollments.map((en: any) => (
        <div
          key={en.id}
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          {en.lectureName || "-"}
        </div>
      ))}
    </div>
  );
}
