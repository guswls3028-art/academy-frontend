// PATH: src/features/students/overlays/StudentsDetailOverlay.tsx
// 학생 상세 오버레이 — 고급 SaaS 스타일, 기능·구성 동일

import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import api from "@/shared/api/axios";

import {
  getStudentDetail,
  getTags,
  attachStudentTag,
  detachStudentTag,
  createMemo,
  toggleStudentActive,
} from "../api/students";

import StudentFormModal from "../components/EditStudentModal";
import TagCreateModal from "../components/TagCreateModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { EmptyState, Button, CloseButton } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { formatPhone, formatStudentPhoneDisplay, formatOmrCode, formatGenderDisplay } from "@/shared/utils/formatPhone";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import StudentStorageExplorer from "@/features/storage/components/StudentStorageExplorer";

const TABS = [
  { key: "enroll", label: "수강" },
  { key: "score", label: "시험 성적" },
  { key: "homework", label: "과제" },
  { key: "clinic", label: "클리닉" },
  { key: "question", label: "질문" },
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
  const { openSendMessageModal } = useSendMessageModal();

  const [tab, setTab] = useState("enroll");
  const [editOpen, setEditOpen] = useState(false);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Escape 키로 오버레이 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
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

  // 공유 데이터: 대시보드 + 탭에서 중복 호출 제거
  const { data: gradesData } = useQuery({
    queryKey: ["student", id, "grades"],
    queryFn: async () => {
      const res = await api.get("/results/admin/student-grades/", { params: { student_id: id } });
      return res.data as { exams: any[]; homeworks: any[] };
    },
    enabled: id > 0,
  });
  const examGrades = gradesData?.exams ?? [];
  const homeworkGrades = gradesData?.homeworks ?? [];

  const { data: clinicData } = useQuery({
    queryKey: ["student", id, "clinic"],
    queryFn: async () => {
      const res = await api.get("/clinic/participants/", { params: { student: id, page_size: 50 } });
      return Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
    },
    enabled: id > 0,
  });
  const { data: questionsData } = useQuery({
    queryKey: ["student", id, "questions"],
    queryFn: async () => {
      const res = await api.get("/community/posts/", { params: { author_student: id, page_size: 50 } });
      return Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
    },
    enabled: id > 0,
  });

  const addTag = useMutation({
    mutationFn: (tagId: number) => attachStudentTag(id, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", id] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: () => { feedback.error("처리에 실패했습니다."); },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: number) => detachStudentTag(id, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
    onError: () => { feedback.error("처리에 실패했습니다."); },
  });

  const updateMemo = useMutation({
    mutationFn: (memo: string) => createMemo(id, memo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
    onError: () => { feedback.error("처리에 실패했습니다."); },
  });

  const toggleActive = useMutation({
    mutationFn: (nextActive: boolean) => toggleStudentActive(id, nextActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", id] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => { feedback.error("처리에 실패했습니다."); },
  });

  // 로딩 스켈레톤
  if (isLoading || !student) {
    return (
      <>
        <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />
        <div className="ds-overlay-wrap">
          <div className="ds-overlay-panel ds-overlay-panel--student-detail" onClick={(e) => e.stopPropagation()}>
            <CloseButton className="ds-overlay-panel__close" onClick={onClose} />
            <header className="ds-overlay-header">
              <div className="ds-overlay-header__inner">
                <div className="ds-overlay-header__left">
                  <div className="ds-overlay-header__avatar-wrap" aria-hidden>
                    <span className="ds-overlay-header__avatar" style={{ background: "var(--color-bg-surface-soft)", animation: "pulse 1.5s ease-in-out infinite" }}>
                      &nbsp;
                    </span>
                  </div>
                  <div className="ds-overlay-header__title-block">
                    <div style={{ width: 120, height: 20, borderRadius: 6, background: "var(--color-bg-surface-soft)", animation: "pulse 1.5s ease-in-out infinite" }} />
                    <div style={{ width: 80, height: 14, borderRadius: 4, marginTop: 6, background: "var(--color-bg-surface-soft)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  </div>
                </div>
              </div>
            </header>
            <div className="ds-overlay-body" style={{ padding: 24 }}>
              <EmptyState scope="panel" tone="loading" title="학생 정보를 불러오는 중..." />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />

      <div className="ds-overlay-wrap">
        <div className="ds-overlay-panel ds-overlay-panel--student-detail" onClick={(e) => e.stopPropagation()}>
          <CloseButton
            className="ds-overlay-panel__close"
            onClick={onClose}
          />
          <header className="ds-overlay-header">
            <div className="ds-overlay-header__inner">
              <div className="ds-overlay-header__left">
                <div className="ds-overlay-header__avatar-wrap" aria-hidden>
                  <span className="ds-overlay-header__avatar">
                    {student.profilePhotoUrl ? (
                      <img src={student.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (student.name || "?")[0]
                    )}
                  </span>
                </div>
                <div className="ds-overlay-header__title-block">
                  <h1 className="ds-overlay-header__title">
                    <StudentNameWithLectureChip
                      name={student.name ?? ""}
                      avatarSize={0}
                      chipSize={36}
                      lectures={
                        Array.isArray(student.enrollments) && student.enrollments.length > 0
                          ? student.enrollments.map((en: { lectureName?: string | null; lectureColor?: string | null; lectureChipLabel?: string | null }) => ({
                              lectureName: en.lectureName ?? "—",
                              color: en.lectureColor ?? undefined,
                              chipLabel: en.lectureChipLabel ?? undefined,
                            }))
                          : undefined
                      }
                    />
                  </h1>
                  <div className="ds-overlay-header__pills">
                    <span className="ds-badge ds-overlay-header__badge-id" title="아이디">
                      {student.psNumber ?? "—"}
                    </span>
                    <span className="ds-badge ds-overlay-header__badge-code" title="시험 식별코드">
                      {formatOmrCode(student.omrCode)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="ds-overlay-header__right">
                <div className="ds-overlay-header__actions">
                  <button
                    type="button"
                    onClick={() => toggleActive.mutate(!student.active)}
                    disabled={toggleActive.isPending}
                    className="ds-status-badge ds-status-badge--action"
                    data-status={student.active ? "active" : "inactive"}
                  >
                    {toggleActive.isPending ? "…" : student.active ? "활성" : "비활성"}
                  </button>
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    onClick={() => openSendMessageModal({
                      studentIds: [id],
                      recipientLabel: student.name,
                      blockCategory: "student",
                    })}
                  >
                    메시지
                  </Button>
                  <Button type="button" intent="primary" size="sm" onClick={() => setEditOpen(true)}>
                    수정
                  </Button>
                  <Button type="button" intent="danger" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
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
                    copyable
                  />
                  <InfoRow label="학부모 전화" value={formatPhone(student.parentPhone)} copyable />
                  <InfoRow
                    label="학생 전화"
                    value={formatStudentPhoneDisplay(student.studentPhone)}
                    copyable
                  />
                  <InfoRow label="성별" value={formatGenderDisplay(student.gender)} />
                  <InfoRow label="학교" value={student.school} />
                  {student.schoolType === "HIGH" && (
                    <InfoRow label="출신중학교" value={student.originMiddleSchool} />
                  )}
                  <InfoRow
                    label="학년"
                    value={student.grade ? `${student.grade}학년` : "-"}
                  />
                  <InfoRow label="반" value={student.schoolClass} />
                  <InfoRow label="계열" value={student.major} />
                  <InfoRow label="등록일" value={student.registeredAt?.slice(0, 10)} />
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
                    {(tags?.filter((t: any) => !student.tags?.some((st: any) => st.id === t.id)).length ?? 0) > 0 && (
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
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "var(--color-text-muted)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      메모
                    </span>
                    {updateMemo.isPending && (
                      <span style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 600 }}>저장 중...</span>
                    )}
                    {updateMemo.isSuccess && !updateMemo.isPending && (
                      <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 600 }}>저장됨</span>
                    )}
                  </div>
                  <textarea
                    className="ds-textarea w-full"
                    rows={4}
                    defaultValue={student.memo ?? ""}
                    placeholder="메모를 입력하면 포커스 해제 시 자동 저장됩니다."
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
                {/* 한눈에 요약 */}
                <StudentSummaryDashboard
                  enrollments={student.enrollments}
                  examGrades={examGrades}
                  homeworkGrades={homeworkGrades}
                  clinicData={clinicData ?? []}
                  questionsData={questionsData ?? []}
                />

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
                  {tab === "enroll" && <EnrollmentsTab enrollments={student.enrollments} onNavigate={(path) => { onClose(); navigate(path); }} />}
                  {tab === "score" && <ScoreTab data={examGrades} onNavigate={(path) => { onClose(); navigate(path); }} />}
                  {tab === "homework" && <HomeworkTab data={homeworkGrades} onNavigate={(path) => { onClose(); navigate(path); }} />}
                  {tab === "clinic" && <ClinicTab data={clinicData ?? []} onNavigate={(path) => { onClose(); navigate(path); }} />}
                  {tab === "question" && <QuestionTab data={questionsData ?? []} onNavigate={(path) => { onClose(); navigate(path); }} />}
                </div>
              </div>
            </div>
          </div>

          {/* 우하단 인벤토리 트리거 — 아이콘만 큼지막하게, 클릭 시 좌측 패널 */}
          <div className="ds-overlay-inventory-wrap">
            <button
              type="button"
              className="ds-inventory-trigger-btn"
              onClick={() => setInventoryOpen(true)}
              title="인벤토리"
              aria-label="인벤토리 열기"
            >
              📁
            </button>
          </div>
        </div>
      </div>

      {inventoryOpen &&
        createPortal(
          <>
            <div className="ds-inventory-backdrop" onClick={() => setInventoryOpen(false)} aria-hidden />
            <div
              className="ds-inventory-panel"
              role="dialog"
              aria-label="학생 인벤토리"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ds-inventory-panel__header">
                <span className="ds-inventory-panel__title">인벤토리 — {student.name}</span>
                <div className="ds-inventory-panel__header-actions">
                  <CloseButton onClick={() => setInventoryOpen(false)} />
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <StudentStorageExplorer studentPs={student.psNumber} />
              </div>
            </div>
          </>,
          document.body
        )}

      {editOpen &&
        createPortal(
          <StudentFormModal
            open={true}
            initialValue={student}
            onClose={() => setEditOpen(false)}
            onSuccess={() => {
              setEditOpen(false);
              qc.invalidateQueries({ queryKey: ["student", id] });
              qc.invalidateQueries({ queryKey: ["students"] });
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

      {deleteConfirmOpen && (
        <DeleteConfirmModal
          open={true}
          id={id}
          onClose={() => setDeleteConfirmOpen(false)}
          onSuccess={() => {
            setDeleteConfirmOpen(false);
            qc.invalidateQueries({ queryKey: ["students"] });
            feedback.success("학생이 삭제되었습니다. 30일간 보관 후 자동 삭제됩니다.");
            onClose();
          }}
        />
      )}
    </>
  );
}

function InfoRow({
  label,
  value,
  accent,
  copyable,
}: {
  label: string;
  value: any;
  accent?: boolean;
  copyable?: boolean;
}) {
  const displayValue = value || "-";
  const canCopy = copyable && value && value !== "-";

  const handleCopy = () => {
    if (!canCopy) return;
    const text = String(value).replace(/[^0-9a-zA-Z가-힣\-]/g, "").trim() || String(value);
    navigator.clipboard.writeText(text).then(
      () => feedback.success(`${label} 복사됨`),
      () => {}
    );
  };

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
        cursor: canCopy ? "pointer" : undefined,
        transition: "background 0.15s",
      }}
      onClick={canCopy ? handleCopy : undefined}
      title={canCopy ? "클릭하여 복사" : undefined}
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
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {displayValue}
        {canCopy && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </span>
    </div>
  );
}

/** 한눈에 보는 학생 요약 대시보드 */
function StudentSummaryDashboard({
  enrollments,
  examGrades,
  homeworkGrades,
  clinicData,
  questionsData,
}: {
  enrollments: any[];
  examGrades: any[];
  homeworkGrades: any[];
  clinicData: any[];
  questionsData: any[];
}) {
  const examPassCount = examGrades.filter((e: any) => e.is_pass === true).length;
  const examFailCount = examGrades.filter((e: any) => e.is_pass === false).length;
  const examJudged = examPassCount + examFailCount;
  const avgScore = examGrades.length > 0
    ? Math.round(examGrades.reduce((s: number, e: any) => s + (e.total_score ?? 0), 0) / examGrades.length)
    : null;

  const hwPassCount = homeworkGrades.filter((h: any) => h.passed === true).length;
  const hwTotal = homeworkGrades.length;

  const clinicCount = (clinicData ?? []).length;
  const clinicAttended = (clinicData ?? []).filter((c: any) => c.status === "ATTENDED" || c.status === "attended").length;
  const questionCount = (questionsData ?? []).length;

  const activeEnrollments = (enrollments ?? []).filter((en: any) => (en.status ?? "ACTIVE") === "ACTIVE").length;

  const cards: { label: string; value: string; sub?: string; tone?: string }[] = [
    {
      label: "수강",
      value: `${activeEnrollments}`,
      sub: enrollments?.length !== activeEnrollments ? `전체 ${enrollments?.length ?? 0}` : "강의",
    },
    {
      label: "시험",
      value: `${examGrades.length}건`,
      sub: avgScore != null ? `평균 ${avgScore}점` : undefined,
    },
    {
      label: "합격률",
      value: examJudged > 0 ? `${Math.round((examPassCount / examJudged) * 100)}%` : "-",
      sub: examJudged > 0 ? `합 ${examPassCount} · 불 ${examFailCount}` : undefined,
      tone: examJudged > 0 ? (examPassCount >= examFailCount ? "success" : "danger") : undefined,
    },
    {
      label: "과제",
      value: `${hwTotal}건`,
      sub: hwTotal > 0 ? `완료 ${hwPassCount}건` : undefined,
    },
    {
      label: "클리닉",
      value: `${clinicCount}건`,
      sub: clinicAttended > 0 ? `출석 ${clinicAttended}건` : undefined,
    },
    {
      label: "질문",
      value: `${questionCount}건`,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cards.length, 6)}, 1fr)`, gap: 8, marginBottom: 12 }}>
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            borderRadius: 10,
            padding: "10px 8px",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4 }}>{c.label}</div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              lineHeight: 1.2,
              color: c.tone === "success" ? "var(--color-success)" : c.tone === "danger" ? "var(--color-error)" : "var(--color-text-primary)",
            }}
          >
            {c.value}
          </div>
          {c.sub && (
            <div style={{ fontSize: 10, fontWeight: 500, color: "var(--color-text-muted)", marginTop: 2 }}>{c.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/** 2글자 강의 딱지 — chipLabel > 강의명 앞 2자 */
function LectureChip({ name, color, chipLabel }: { name: string; color?: string; chipLabel?: string | null }) {
  const label = (chipLabel && chipLabel.length >= 1 ? chipLabel : (name || "").replace(/\s/g, "")).slice(0, 2) || "강의";
  return (
    <span
      className="inline-flex items-center justify-center rounded text-[10px] font-bold text-white select-none shrink-0"
      style={{ width: 28, height: 20, background: color || "var(--color-brand-primary)", lineHeight: 1 }}
    >
      {label}
    </span>
  );
}

function EnrollmentsTab({ enrollments, onNavigate }: { enrollments: any[]; onNavigate: (path: string) => void }) {
  if (!enrollments?.length) return <EmptyState scope="panel" tone="empty" title="수강 이력이 없습니다." />;

  const statusLabel: Record<string, string> = { ACTIVE: "수강중", DROPPED: "탈퇴", COMPLETED: "수료" };
  const statusTone: Record<string, string> = { ACTIVE: "success", DROPPED: "muted", COMPLETED: "info" };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {enrollments.map((en: any) => {
        const status = en.status ?? "ACTIVE";
        const isActive = status === "ACTIVE";
        const lectureId = en.lectureId;
        const canNav = !!lectureId;
        return (
          <div
            key={en.id}
            className="flex items-center gap-2.5 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] px-4 py-3 hover:border-[var(--color-brand-primary)] hover:shadow-sm transition-all"
            style={{ opacity: isActive ? 1 : 0.6, cursor: canNav ? "pointer" : "default" }}
            onClick={canNav ? () => onNavigate(`/admin/lectures/${lectureId}`) : undefined}
          >
            <LectureChip name={en.lectureName || ""} color={en.lectureColor} chipLabel={en.lectureChipLabel} />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{en.lectureName || "-"}</span>
              {en.enrolledAt && (
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {en.enrolledAt?.slice(0, 10)} 등록
                </span>
              )}
            </div>
            <span className="ds-status-badge text-[11px]" data-tone={statusTone[status] || "muted"}>
              {statusLabel[status] || status}
            </span>
            {canNav && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 클리닉/상담 이력 탭 */
function ClinicTab({ data, onNavigate }: { data: any[]; onNavigate: (path: string) => void }) {
  if (!data?.length) return <EmptyState scope="panel" tone="empty" title="클리닉/상담 이력이 없습니다." />;

  // 백엔드 ParticipantSerializer: status는 소문자 (booked, attended, no_show, cancelled, pending)
  const normalize = (s: string) => (s || "").toUpperCase();
  const statusLabel: Record<string, string> = { BOOKED: "예약", ATTENDED: "출석", NO_SHOW: "결석", CANCELLED: "취소", PENDING: "대기" };
  const statusTone: Record<string, string> = { BOOKED: "info", ATTENDED: "success", NO_SHOW: "danger", CANCELLED: "muted", PENDING: "warning" };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.map((p: any) => {
        const st = normalize(p.status);
        const lectureName = p.lecture_title;
        const lectureColor = p.lecture_color;
        const lectureChip = p.lecture_chip_label;
        return (
          <div
            key={p.id}
            className="flex items-center gap-2.5 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] px-4 py-3 hover:border-[var(--color-brand-primary)] hover:shadow-sm transition-all cursor-pointer"
            onClick={() => onNavigate("/admin/clinic/operations")}
          >
            {lectureName && <LectureChip name={lectureName} color={lectureColor} chipLabel={lectureChip} />}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                {p.student_name ? `${p.student_name} 클리닉` : "클리닉"}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                {p.session_date && <span>{p.session_date}</span>}
                {p.session_start_time && <span>{String(p.session_start_time).slice(0, 5)}</span>}
                {p.session_location && <span>· {p.session_location}</span>}
              </div>
              {p.clinic_reason && (
                <span className="text-[11px] text-[var(--color-text-muted)] truncate">{p.clinic_reason}</span>
              )}
            </div>
            <span className="ds-status-badge text-xs" data-tone={statusTone[st] || "muted"}>
              {statusLabel[st] || p.status}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/** 질문 이력 탭 */
function QuestionTab({ data, onNavigate }: { data: any[]; onNavigate: (path: string) => void }) {
  if (!data?.length) return <EmptyState scope="panel" tone="empty" title="질문 이력이 없습니다." />;

  const typeLabel: Record<string, string> = { qna: "질문", board: "게시글", notice: "공지", counsel: "상담", materials: "자료" };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.map((post: any) => {
        const repliesCount = post.replies_count ?? post.reply_count ?? 0;
        const postType = post.post_type || "qna";
        // 질문 → QnA 인박스, 그 외 → 게시판
        const navPath = postType === "qna"
          ? `/admin/community/qna?id=${post.id}`
          : `/admin/community/board`;
        return (
          <div
            key={post.id}
            className="rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] px-4 py-3 hover:border-[var(--color-brand-primary)] hover:shadow-sm transition-all cursor-pointer"
            onClick={() => onNavigate(navPath)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="ds-badge text-[10px] shrink-0" style={{ padding: "2px 6px" }}>
                  {typeLabel[postType] || postType}
                </span>
                <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{post.title || "(제목 없음)"}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {repliesCount > 0 && (
                  <span className="text-xs text-[var(--color-brand-primary)] font-semibold">
                    답변 {repliesCount}
                  </span>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-1 block">
              {post.created_at ? new Date(post.created_at).toLocaleDateString("ko-KR") : ""}
              {post.created_by_display ? ` · ${post.created_by_display}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 시험 성적 탭 — admin/student-grades API 기반 */
function ScoreTab({ data, onNavigate }: { data: any[]; onNavigate: (path: string) => void }) {
  if (!data?.length) return <EmptyState scope="panel" tone="empty" title="시험 성적이 없습니다." />;

  const achievementLabel: Record<string, string> = { PASS: "합격", FAIL: "불합격", REMEDIATED: "보강합격" };
  const achievementTone: Record<string, string> = { PASS: "success", FAIL: "danger", REMEDIATED: "warning" };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.map((exam: any, i: number) => {
        const lectureId = exam.lecture_id;
        const sessionId = exam.session_id;
        const canNav = !!lectureId && !!sessionId;
        const navPath = canNav ? `/admin/lectures/${lectureId}/sessions/${sessionId}/scores` : "";
        return (
          <div
            key={exam.exam_id ?? i}
            className="flex items-center gap-2.5 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] px-4 py-3 hover:border-[var(--color-brand-primary)] hover:shadow-sm transition-all"
            style={{ cursor: canNav ? "pointer" : "default" }}
            onClick={canNav ? () => onNavigate(navPath) : undefined}
          >
            {exam.lecture_title && (
              <LectureChip name={exam.lecture_title} color={exam.lecture_color} chipLabel={exam.lecture_chip_label} />
            )}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{exam.title}</span>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                {exam.session_title && <span>{exam.session_title}</span>}
                {exam.retake_count > 1 && <span>· 재시도 {exam.retake_count - 1}회</span>}
                {exam.submitted_at && <span>· {exam.submitted_at.slice(0, 10)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {exam.total_score != null && (
                <span className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                  {Math.round(exam.total_score)}<span className="text-xs font-normal text-[var(--color-text-muted)]">/{exam.max_score ?? 100}</span>
                </span>
              )}
              {exam.achievement && (
                <span className="ds-status-badge text-[11px]" data-tone={achievementTone[exam.achievement] || "muted"}>
                  {achievementLabel[exam.achievement] || exam.achievement}
                </span>
              )}
              {exam.is_pass != null && !exam.achievement && (
                <span className="ds-scores-pass-fail-badge" data-tone={exam.is_pass ? "success" : "danger"}>
                  {exam.is_pass ? "합" : "불"}
                </span>
              )}
              {canNav && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 과제 탭 — admin/student-grades API 기반 */
function HomeworkTab({ data, onNavigate }: { data: any[]; onNavigate: (path: string) => void }) {
  if (!data?.length) return <EmptyState scope="panel" tone="empty" title="과제 성적이 없습니다." />;

  const achievementLabel: Record<string, string> = { PASS: "완료", FAIL: "미완료", REMEDIATED: "보강완료" };
  const achievementTone: Record<string, string> = { PASS: "success", FAIL: "danger", REMEDIATED: "warning" };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.map((hw: any, i: number) => {
        const lectureId = hw.lecture_id;
        const sessionId = hw.session_id;
        const canNav = !!lectureId && !!sessionId;
        const navPath = canNav ? `/admin/lectures/${lectureId}/sessions/${sessionId}/scores` : "";
        return (
          <div
            key={`${hw.homework_id}-${hw.enrollment_id}-${i}`}
            className="flex items-center gap-2.5 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] px-4 py-3 hover:border-[var(--color-brand-primary)] hover:shadow-sm transition-all"
            style={{ cursor: canNav ? "pointer" : "default" }}
            onClick={canNav ? () => onNavigate(navPath) : undefined}
          >
            {hw.lecture_title && (
              <LectureChip name={hw.lecture_title} color={hw.lecture_color} chipLabel={hw.lecture_chip_label} />
            )}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{hw.title}</span>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                {hw.session_title && <span>{hw.session_title}</span>}
                {hw.retake_count > 1 && <span>· 재시도 {hw.retake_count - 1}회</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hw.score != null && (
                <span className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                  {Math.round(hw.score)}<span className="text-xs font-normal text-[var(--color-text-muted)]">/{hw.max_score ?? 100}</span>
                </span>
              )}
              {hw.achievement && (
                <span className="ds-status-badge text-[11px]" data-tone={achievementTone[hw.achievement] || "muted"}>
                  {achievementLabel[hw.achievement] || hw.achievement}
                </span>
              )}
              {canNav && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
