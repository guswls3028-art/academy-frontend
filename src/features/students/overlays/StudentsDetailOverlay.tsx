// PATH: src/features/students/overlays/StudentsDetailOverlay.tsx
// 학생 상세 오버레이 — 고급 SaaS 스타일, 기능·구성 동일

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
  toggleStudentActive,
} from "../api/students";

import StudentFormModal from "../components/EditStudentModal";
import TagCreateModal from "../components/TagCreateModal";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { EmptyState, Button } from "@/shared/ui/ds";
import { formatPhone, formatStudentPhoneDisplay, formatOmrCode } from "@/shared/utils/formatPhone";
import { STATUS_ACTIVE_COLOR, STATUS_INACTIVE_COLOR } from "@/shared/ui/domain";

const TABS = [
  { key: "enroll", label: "수강 이력" },
  { key: "clinic", label: "클리닉/상담 이력" },
  { key: "question", label: "질문 이력" },
  { key: "score", label: "성적 이력" },
  { key: "schoolScore", label: "학교 성적" },
];

type StudentsDetailOverlayProps = {
  /** 라우트가 아닌 곳(예: 모달)에서 띄울 때 전달. 있으면 onClose로만 닫고 라우트 변경 없음 */
  studentId?: number;
  onClose?: () => void;
};

export default function StudentsDetailOverlay(props?: StudentsDetailOverlayProps) {
  const routeParams = useParams();
  const navigate = useNavigate();
  const id = props?.studentId ?? Number(routeParams.studentId);
  const onClose = props?.onClose ?? (() => navigate(-1));
  const qc = useQueryClient();

  const [tab, setTab] = useState("enroll");
  const [editOpen, setEditOpen] = useState(false);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", id] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: number) => detachStudentTag(id, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
  });

  const updateMemo = useMutation({
    mutationFn: (memo: string) => createMemo(id, memo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
  });

  const toggleActive = useMutation({
    mutationFn: (nextActive: boolean) => toggleStudentActive(id, nextActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", id] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  async function handleDelete() {
    if (!confirm("이 학생을 삭제하시겠습니까?")) return;
    await deleteStudent(id);
    qc.invalidateQueries({ queryKey: ["students"] });
    onClose();
  }

  if (isLoading || !student) return null;

  return (
    <>
      {/* Backdrop — 부드러운 블러 + 딤 */}
      <div
        className="fixed inset-0 z-[60]"
        style={{
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "opacity 0.2s ease",
        }}
        onClick={onClose}
        aria-hidden
      />

      {/* Overlay panel */}
      <div
        className="fixed inset-0 z-[70] flex justify-center overflow-auto"
        style={{
          paddingTop: "calc(var(--panel-header, 64px) + 16px)",
          paddingBottom: 16,
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        <div
          className="w-full max-w-[1100px]"
          style={{
            borderRadius: 24,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.04), 0 12px 24px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — 프리미엄 인스펙트 스타일, 유리 질감 */}
          <header
            className="relative overflow-hidden"
            style={{
              background:
                "linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface)) 0%, color-mix(in srgb, var(--color-primary) 3%, var(--color-bg-surface)) 50%, var(--color-bg-surface) 100%)",
              borderBottom: "1px solid color-mix(in srgb, var(--color-primary) 12%, var(--color-border-divider))",
              padding: "28px 32px 24px",
              boxShadow:
                "0 1px 0 0 color-mix(in srgb, var(--color-primary) 6%, transparent)",
            }}
          >
            {/* 유리 반사 (gloss) — 상단 흰줄 없이 은은하게 */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
                pointerEvents: "none",
              }}
            />
            {/* 질감 (노이즈) */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.04,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                pointerEvents: "none",
              }}
            />
            <div className="relative flex items-start justify-between gap-6 flex-wrap">
              {/* Left: 아바타 + 타이틀 블록 */}
              <div className="flex items-center gap-4 min-w-0">
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background:
                      "linear-gradient(145deg, color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-surface)), color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface)))",
                    border: "1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border-divider))",
                    boxShadow:
                      "0 2px 8px color-mix(in srgb, var(--color-primary) 12%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.5)",
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "var(--color-primary)",
                  }}
                >
                  {student.name?.[0] ?? "?"}
                </div>
                <div className="min-w-0">
                  <h1
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.2,
                      color: "var(--color-text-primary)",
                      margin: 0,
                    }}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <StudentNameWithLectureChip
                        name={student.name ?? ""}
                        lectures={
                          Array.isArray(student.enrollments) && student.enrollments.length > 0
                            ? student.enrollments.slice(0, 5).map((en: { lecture_name?: string; lecture_color?: string }) => ({
                                lectureName: en.lecture_name ?? "??",
                                color: en.lecture_color ?? undefined,
                              }))
                            : undefined
                        }
                        chipSize={20}
                        className="[&_.truncate]:!text-[22px] [&_.truncate]:!font-extrabold"
                      />
                    </span>
                  </h1>
                  <p
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--color-text-muted)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <span style={{ opacity: 0.85 }}>아이디</span> · {student.psNumber ?? "—"}
                    <span style={{ marginLeft: 16, opacity: 0.85 }}>시험 식별코드</span>
                    <span
                      style={{
                        marginLeft: 6,
                        fontFamily: "ui-monospace, monospace",
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {formatOmrCode(student.omrCode)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Right: 액션 영역 */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(!student.active)}
                  disabled={toggleActive.isPending}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 10,
                    letterSpacing: "-0.01em",
                    cursor: toggleActive.isPending ? "wait" : "pointer",
                    color: "#fff",
                    backgroundColor: student.active ? STATUS_ACTIVE_COLOR : STATUS_INACTIVE_COLOR,
                    border: "none",
                    transition: "all 0.15s ease",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
                  className="hover:opacity-90 disabled:opacity-60"
                >
                  {toggleActive.isPending ? "…" : student.active ? "활성" : "비활성"}
                </button>
                <span
                  style={{
                    width: 1,
                    height: 20,
                    background: "var(--color-border-divider)",
                    opacity: 0.7,
                  }}
                  aria-hidden
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    수정
                  </Button>
                  <Button type="button" intent="danger" size="sm" onClick={handleDelete}>
                    삭제
                  </Button>
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    onClick={onClose}
                  >
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Body */}
          <div style={{ padding: "28px 28px 32px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "300px 1fr",
                gap: 24,
                alignItems: "start",
              }}
            >
              {/* Left panel — 정보·태그·메모 */}
              <div
                style={{
                  borderRadius: 16,
                  padding: 20,
                  background: "var(--bg-surface-soft)",
                  border: "1px solid var(--color-border-divider)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <InfoRow
                    label="학생 전화"
                    value={formatStudentPhoneDisplay(student.studentPhone)}
                  />
                  <InfoRow
                    label="시험 식별코드"
                    value={formatOmrCode(student.omrCode)}
                    accent
                  />
                  <InfoRow label="학부모 전화" value={formatPhone(student.parentPhone)} />
                  <InfoRow label="성별" value={student.gender} />
                  <InfoRow label="학교" value={student.school} />
                  <InfoRow
                    label="학년"
                    value={student.grade ? `${student.grade}학년` : "-"}
                  />
                  <InfoRow label="반" value={student.schoolClass} />
                  <InfoRow label="계열" value={student.major} />
                </div>

                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      marginBottom: 8,
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    태그
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {student.tags?.length ? (
                      student.tags.map((t: any) => {
                        const c = String(t.color || "").toLowerCase();
                        const lightColors = ["#eab308", "#06b6d4"];
                        const isLight = lightColors.some((x) => c === x);
                        return (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1 group cursor-default"
                          style={{
                            padding: "6px 10px 6px 12px",
                            borderRadius: "6px 6px 6px 2px",
                            fontSize: 12,
                            fontWeight: 700,
                            background: t.color,
                            color: isLight ? "#1a1a1a" : "#fff",
                            border: "none",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                            textShadow: isLight ? "none" : "0 0 1px rgba(0,0,0,0.2)",
                          }}
                        >
                          {t.name}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTag.mutate(t.id);
                            }}
                            disabled={removeTag.isPending}
                            aria-label={`${t.name} 태그 제거`}
                            style={{
                              marginLeft: 4,
                              padding: 0,
                              width: 16,
                              height: 16,
                              borderRadius: 999,
                              border: "none",
                              background: "rgba(0,0,0,0.2)",
                              color: "#fff",
                              fontSize: 12,
                              cursor: removeTag.isPending ? "wait" : "pointer",
                              display: "grid",
                              placeItems: "center",
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                        );
                      })
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        태그 없음
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      intent="primary"
                      size="sm"
                      onClick={() => setTagCreateOpen(true)}
                    >
                      + 태그 추가
                    </Button>
                    {tags?.filter((t: any) => !student.tags?.some((st: any) => st.id === t.id)).length > 0 && (
                      <select
                        className="ds-input"
                        style={{ fontSize: 13, minWidth: 140 }}
                        onChange={(e) => {
                          const tagId = Number(e.target.value);
                          if (tagId) addTag.mutate(tagId);
                          e.currentTarget.value = "";
                        }}
                      >
                        <option value="">기존 태그 선택…</option>
                        {tags
                          ?.filter((t: any) => !student.tags?.some((st: any) => st.id === t.id))
                          .map((tag: any) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      marginBottom: 8,
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    메모
                  </div>
                  <textarea
                    className="ds-textarea w-full"
                    rows={4}
                    defaultValue={student.memo}
                    placeholder="메모..."
                    onBlur={(e) => updateMemo.mutate(e.target.value)}
                    style={{
                      fontSize: 13,
                      borderRadius: 12,
                      border: "1px solid var(--color-border-divider)",
                    }}
                  />
                </div>
              </div>

              {/* Right panel — 탭 + 콘텐츠 */}
              <div
                style={{
                  borderRadius: 16,
                  padding: 20,
                  background: "color-mix(in srgb, var(--color-primary) 4%, var(--bg-surface-soft))",
                  border: "1px solid var(--color-border-divider)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    padding: 6,
                    marginBottom: 16,
                    borderRadius: 12,
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-divider)",
                  }}
                >
                  {TABS.map((t) => {
                    const active = tab === t.key;
                    return (
                      <Button
                        key={t.key}
                        type="button"
                        intent={active ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => setTab(t.key)}
                      >
                        {t.label}
                      </Button>
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
          </div>
        </div>
      </div>

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

      {tagCreateOpen &&
        createPortal(
          <TagCreateModal
            open={true}
            onClose={() => setTagCreateOpen(false)}
            onSuccess={(tag) => {
              addTag.mutate(tag.id);
              setTagCreateOpen(false);
            }}
            usedColors={tags?.map((t: any) => t.color).filter(Boolean) ?? []}
          />,
          document.body
        )}
    </>
  );
}

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
        padding: "10px 12px",
        borderRadius: 10,
        background: accent
          ? "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))"
          : "var(--color-bg-surface)",
        border: "1px solid var(--color-border-divider)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontWeight: 600,
          color: "var(--color-text-muted)",
          fontSize: 12,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontWeight: 700,
          color: "var(--color-text-primary)",
          textAlign: "right",
        }}
      >
        {value || "-"}
      </span>
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
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            fontSize: 13,
            fontWeight: 700,
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          className="hover:border-[var(--color-primary)]/30 hover:shadow-sm"
        >
          {en.lectureName || "-"}
        </div>
      ))}
    </div>
  );
}
