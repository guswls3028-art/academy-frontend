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
import { EmptyState, Button, CloseButton } from "@/shared/ui/ds";
import { formatPhone, formatStudentPhoneDisplay, formatOmrCode } from "@/shared/utils/formatPhone";

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
  const [inventoryOpen, setInventoryOpen] = useState(false);

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
      <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />

      <div className="ds-overlay-wrap">
        <div className="ds-overlay-panel" onClick={(e) => e.stopPropagation()}>
          {/* 우상단 닫기 X — 전역 SSOT */}
          <CloseButton
            className="ds-overlay-panel__close"
            onClick={onClose}
          />
          {/* 헤더 — 좌: 아바타 이름 강의딱지 | 우: 아이디블럭 / 식별자블럭 + 액션 */}
          <header className="ds-overlay-header">
            <div className="ds-overlay-header__inner">
              <div className="ds-overlay-header__left">
                <div className="ds-overlay-header__accent" aria-hidden />
                <div className="ds-overlay-header__title-block">
                  <h1 className="ds-overlay-header__title">
                    <StudentNameWithLectureChip
                      name={student.name ?? ""}
                      profilePhotoUrl={student.profilePhotoUrl}
                      avatarSize={40}
                      lectures={
                        Array.isArray(student.enrollments) && student.enrollments.length > 0
                          ? student.enrollments.map((en: { lectureName?: string | null; lectureColor?: string | null }) => ({
                              lectureName: en.lectureName ?? "—",
                              color: en.lectureColor ?? undefined,
                            }))
                          : undefined
                      }
                    />
                  </h1>
                </div>
              </div>
              <div className="ds-overlay-header__right">
                <span className="ds-overlay-header__id-block" title="아이디">
                  {student.psNumber ?? "—"}
                </span>
                <span className="ds-overlay-header__code-block" title="시험 식별코드">
                  {formatOmrCode(student.omrCode)}
                </span>
                <div className="ds-overlay-header__actions">
                  <button
                    type="button"
                    onClick={() => toggleActive.mutate(!student.active)}
                    disabled={toggleActive.isPending}
                    className="ds-status-badge"
                    data-status={student.active ? "active" : "inactive"}
                  >
                    {toggleActive.isPending ? "…" : student.active ? "활성" : "비활성"}
                  </button>
                  <Button type="button" intent="primary" size="sm" onClick={() => setEditOpen(true)}>
                    수정
                  </Button>
                  <Button type="button" intent="danger" size="sm" onClick={handleDelete}>
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <div className="ds-overlay-body">
            <div className="ds-overlay-body__grid">
              {/* Left panel — 정보·태그·메모 */}
              <div
                style={{
                  borderRadius: 12,
                  padding: 16,
                  background: "var(--bg-surface-soft)",
                  border: "1px solid var(--color-border-divider)",
                }}
              >
                <div className="ds-overlay-info-rows">
                  <InfoRow
                    label="식별코드"
                    value={formatOmrCode(student.omrCode)}
                    accent
                  />
                  <InfoRow label="학부모 전화" value={formatPhone(student.parentPhone)} />
                  <InfoRow
                    label="학생 전화"
                    value={formatStudentPhoneDisplay(student.studentPhone)}
                  />
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

              {/* Right panel — 탭 + 콘텐츠 (페이지형 플랫탭) */}
              <div
                style={{
                  borderRadius: 12,
                  padding: 16,
                  background: "color-mix(in srgb, var(--color-brand-primary) 4%, var(--bg-surface-soft))",
                  border: "1px solid var(--color-border-divider)",
                }}
              >
                <div className="ds-overlay-tabs">
                  <div className="ds-tabs ds-tabs--flat">
                    {TABS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`ds-tab ${tab === t.key ? "is-active" : ""}`}
                        onClick={() => setTab(t.key)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ minHeight: 260, marginTop: 16 }}>
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
      className="ds-overlay-info-row"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 8,
        background: accent
          ? "color-mix(in srgb, var(--color-brand-primary) 10%, var(--color-bg-surface))"
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
