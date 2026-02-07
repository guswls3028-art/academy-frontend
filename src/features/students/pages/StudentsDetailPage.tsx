// PATH: src/features/students/pages/StudentsDetailPage.tsx

import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  getStudentDetail,
  getTags,
  attachStudentTag,
  detachStudentTag,
  createMemo,
  deleteStudent,
} from "../api/students";

import StudentFormModal from "../components/EditStudentModal";

import { PageHeader, Section, Panel, EmptyState } from "@/shared/ui/ds";

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
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => navigate(-1)}
      />

      {/* Overlay Card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="w-full max-w-[1100px] max-h-[90vh] overflow-auto rounded-2xl bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-divider)]">
          {/* Header Area (SSOT PageHeader: title string only) */}
          <div className="px-6 pt-6">
            <PageHeader
              title={student.name}
              actions={
                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      student.active
                        ? "border border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]"
                        : "border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-[var(--text-muted)]"
                    }`}
                  >
                    {student.active ? "활성" : "비활성"}
                  </span>

                  <button
                    onClick={() => setEditOpen(true)}
                    className="px-3 py-1.5 text-sm rounded-md
                      border border-[var(--border-divider)]
                      bg-[var(--bg-surface)]
                      text-[var(--text-primary)]
                      hover:bg-[var(--bg-surface-soft)]"
                  >
                    수정
                  </button>

                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-sm rounded-md
                      border border-[var(--color-danger)]
                      text-[var(--color-danger)]
                      hover:bg-[var(--color-danger)]/10"
                  >
                    삭제
                  </button>

                  <button
                    onClick={() => navigate(-1)}
                    className="px-3 py-1.5 text-sm rounded-md
                      border border-[var(--border-divider)]
                      bg-[var(--bg-app)]
                      text-[var(--text-primary)]
                      hover:bg-[var(--bg-surface-soft)]"
                  >
                    닫기
                  </button>
                </div>
              }
            />
          </div>

          <div className="px-6 pb-6">
            <Section>
              {/* ================= Layout ================= */}
              <div className="flex gap-6">
                {/* LEFT */}
                <div className="w-[340px] shrink-0 space-y-4">
                  <Panel>
                    <div
                      className="
                        rounded-2xl border border-[var(--border-divider)]
                        bg-[var(--bg-surface)]
                        overflow-hidden
                      "
                    >
                      <div className="px-4 py-3 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          기본 정보
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          계정 · 연락처 · 학교
                        </div>
                      </div>

                      <div className="p-4 space-y-2 text-sm">
                        <InfoItem
                          label="아이디(PS)"
                          value={student.psNumber}
                          strong
                        />
                        <InfoItem
                          label="학생 전화번호/식별자"
                          value={
                            student.studentPhone &&
                            String(student.studentPhone).length === 8
                              ? `식별자 ${student.studentPhone}`
                              : student.studentPhone
                          }
                          strong
                        />
                        <InfoItem
                          label="학부모 전화번호"
                          value={student.parentPhone}
                          strong
                        />
                        <InfoItem label="성별" value={student.gender} />
                        <InfoItem label="학교" value={student.school} />
                        <InfoItem
                          label="학년"
                          value={student.grade ? `${student.grade}학년` : null}
                        />
                        <InfoItem label="반" value={student.schoolClass} />
                        <InfoItem label="계열" value={student.major} />
                        <InfoItem
                          label="등록일"
                          value={student.registeredAt?.slice(0, 10)}
                        />
                      </div>
                    </div>
                  </Panel>

                  <Panel>
                    <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          태그
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          분류/관리용 라벨
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {student.tags?.length ? (
                            student.tags.map((t: any) => (
                              <div
                                key={t.id}
                                className="group flex items-center gap-1
                            px-2 py-1 rounded-full text-xs font-semibold
                            shadow-sm text-white"
                                style={{ backgroundColor: t.color }}
                              >
                                <span>{t.name}</span>
                                <button
                                  onClick={() => removeTag.mutate(t.id)}
                                  className="hidden group-hover:inline text-white/80 hover:text-white"
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          ) : (
                            <EmptyState title="태그 없음" />
                          )}
                        </div>

                        <select
                          className="w-full rounded-md px-2 py-2 text-sm
                      border border-[var(--border-divider)]
                      bg-[var(--bg-app)]
                      text-[var(--text-primary)]
                      focus:outline-none
                      focus:ring-1
                      focus:ring-[var(--color-primary)]"
                          onChange={(e) => {
                            const tagId = Number(e.target.value);
                            if (tagId) addTag.mutate(tagId);
                          }}
                        >
                          <option value="">태그 목록</option>
                          {tags?.map((tag: any) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </Panel>

                  <Panel>
                    <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          메모
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          포커스 아웃 시 저장
                        </div>
                      </div>

                      <div className="p-4">
                        <textarea
                          className="w-full h-32 rounded-md p-3 text-sm resize-none
                      border border-[var(--border-divider)]
                      bg-[var(--bg-app)]
                      text-[var(--text-primary)]
                      placeholder:text-[var(--text-muted)]
                      focus:outline-none
                      focus:ring-1
                      focus:ring-[var(--color-primary)]"
                          defaultValue={student.memo}
                          placeholder="메모 작성..."
                          onBlur={(e) => updateMemo.mutate(e.target.value)}
                        />
                      </div>
                    </div>
                  </Panel>
                </div>

                {/* RIGHT */}
                <div className="flex-1">
                  <Panel>
                    <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
                      <div className="px-4 pt-4">
                        <div className="relative mb-4">
                          <div className="flex gap-2 border-b border-[var(--border-divider)]">
                            {TABS.map((t) => {
                              const active = tab === t.key;

                              return (
                                <button
                                  key={t.key}
                                  onClick={() => setTab(t.key)}
                                  className={`
                              relative px-4 py-2 text-sm font-semibold rounded-t-md
                              transition-all duration-200
                              ${
                                active
                                  ? `
                                    bg-[var(--bg-surface-soft)]
                                    text-[var(--text-primary)]
                                  `
                                  : `
                                    text-[var(--text-secondary)]
                                    hover:text-[var(--text-primary)]
                                  `
                              }
                            `}
                                >
                                  {t.label}

                                  {active && (
                                    <span
                                      className="
                                  absolute left-0 right-0 -bottom-[1px]
                                  h-[2px]
                                  bg-[var(--color-primary)]
                                  rounded-full
                                "
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div
                            className="
                        h-[3px]
                        w-full
                        bg-gradient-to-r
                        from-[var(--color-primary)]/40
                        via-transparent
                        to-transparent
                      "
                          />
                        </div>
                      </div>

                      <div className="px-4 pb-4">
                        <div className="min-h-[300px]">
                          {tab === "enroll" ? (
                            <EnrollmentsTab
                              enrollments={student.enrollments}
                            />
                          ) : (
                            <EmptyState title="데이터가 없습니다." />
                          )}
                        </div>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <StudentFormModal
          initialValue={student}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false);
            qc.invalidateQueries({ queryKey: ["student", id] });
          }}
        />
      )}
    </>
  );
}

/* ================= sub ================= */

function InfoItem({
  label,
  value,
  strong,
}: {
  label: string;
  value: any;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span
        className={`text-sm text-right ${
          strong
            ? "font-semibold text-[var(--text-primary)]"
            : "text-[var(--text-primary)]"
        }`}
      >
        {value || "-"}
      </span>
    </div>
  );
}

function EnrollmentsTab({ enrollments }: { enrollments: any[] }) {
  if (!enrollments?.length) {
    return <EmptyState title="수강 이력이 없습니다." />;
  }

  return (
    <div className="space-y-2">
      {enrollments.map((en: any) => (
        <div
          key={en.id}
          className="rounded-md px-3 py-2 text-sm cursor-pointer
            border border-[var(--border-divider)]
            bg-[var(--bg-app)]
            text-[var(--text-primary)]
            hover:bg-[var(--bg-surface-soft)]
            hover:border-[var(--color-primary)]/40
            transition"
        >
          {en.lectureName || "-"}
        </div>
      ))}
    </div>
  );
}
