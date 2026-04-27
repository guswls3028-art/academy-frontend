// PATH: src/app_admin/domains/students/overlays/StudentsDetailOverlay.tsx
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
} from "../api/students.api";

import StudentFormModal from "../components/EditStudentModal";
import TagCreateModal from "../components/TagCreateModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { EmptyState, Button, CloseButton, Badge, type BadgeTone } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { formatPhone, formatStudentPhoneDisplay, formatOmrCode, formatGenderDisplay } from "@/shared/utils/formatPhone";
import { useSendMessageModal } from "@admin/domains/messages/context/SendMessageModalContext";
import StudentStorageExplorer from "@admin/domains/storage/components/StudentStorageExplorer";

const STAT_TAB_KEYS = ["enroll", "score", "homework", "clinic", "question"] as const;
type StatTabKey = (typeof STAT_TAB_KEYS)[number];

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

  const [tab, setTab] = useState<StatTabKey>("enroll");
  const [editOpen, setEditOpen] = useState(false);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // 학생 전환 시 탭 초기화
  useEffect(() => { setTab("enroll"); }, [id]);

  // Escape 키로 오버레이 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const { data: student, isLoading, isError } = useQuery({
    queryKey: ["student", id],
    queryFn: () => getStudentDetail(id),
    enabled: !!id,
  });

  const { data: tags } = useQuery({
    queryKey: ["students", "tags"],
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
      qc.invalidateQueries({ queryKey: ["students", "tags"] });
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

  // 에러 상태 (존재하지 않는 학생 ID 등)
  if (isError || (!isLoading && !student && !!id)) {
    return (
      <>
        <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />
        <div className="ds-overlay-wrap">
          <div className="ds-overlay-panel ds-overlay-panel--student-detail" onClick={(e) => e.stopPropagation()}>
            <CloseButton className="ds-overlay-panel__close" onClick={onClose} />
            <div className="ds-overlay-body" style={{ padding: 24 }}>
              <EmptyState scope="panel" tone="error" title="학생 정보를 찾을 수 없습니다" description="삭제되었거나 잘못된 학생 ID입니다." />
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <Button intent="secondary" size="sm" onClick={onClose}>닫기</Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

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
                    <Badge className="ds-overlay-header__badge-id" title="아이디">
                      {student.psNumber ?? "—"}
                    </Badge>
                    <Badge className="ds-overlay-header__badge-code" title="시험 식별코드">
                      {formatOmrCode(student.omrCode)}
                    </Badge>
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
              {/* Left panel — 단일 카드, 섹션 구분선 */}
              <div className="ds-overlay-sidebar">
                <div className="ds-overlay-sidebar-card">
                  {/* 연락처 */}
                  <div className="ds-overlay-sidebar-section">
                    <div className="ds-overlay-sidebar-section__title">연락처</div>
                    <div className="ds-overlay-info-rows">
                      {student.psNumber && <InfoRow label="아이디" value={student.psNumber} accent copyable />}
                      {student.omrCode && <InfoRow label="식별코드" value={formatOmrCode(student.omrCode)} accent copyable />}
                      <InfoRow label="학부모 전화" value={formatPhone(student.parentPhone)} copyable />
                      <InfoRow label="학생 전화" value={formatStudentPhoneDisplay(student.studentPhone)} copyable />
                      {student.gender && <InfoRow label="성별" value={formatGenderDisplay(student.gender)} />}
                      <InfoRow label="등록일" value={student.registeredAt?.slice(0, 10)} />
                      {student.address && <InfoRow label="주소" value={student.address} />}
                    </div>
                  </div>

                  {/* 학교 정보 */}
                  {(student.school || student.grade != null || student.schoolClass != null || student.major || (student.schoolType === "HIGH" && student.originMiddleSchool)) && (
                  <div className="ds-overlay-sidebar-section">
                    <div className="ds-overlay-sidebar-section__title">학교</div>
                    <div className="ds-overlay-info-rows">
                      {student.school && <InfoRow label="학교" value={student.school} />}
                      {student.schoolType === "HIGH" && student.originMiddleSchool && (
                        <InfoRow label="출신중학교" value={student.originMiddleSchool} />
                      )}
                      {student.grade != null && <InfoRow label="학년" value={`${student.grade}학년`} />}
                      {student.schoolClass != null && student.schoolClass !== "" && <InfoRow label="반" value={student.schoolClass} />}
                      {student.major && <InfoRow label="계열" value={student.major} />}
                    </div>
                  </div>
                  )}

                  {/* 태그 */}
                  <div className="ds-overlay-sidebar-section">
                    <div className="ds-overlay-sidebar-section__title">
                      태그
                      {student.tags?.length > 0 && <span className="ds-overlay-sidebar-section__count">{student.tags.length}</span>}
                    </div>
                    <div className="ds-overlay-tags">
                      {student.tags?.length ? (
                        student.tags.map((t: any) => {
                          const c = String(t.color || "").toLowerCase();
                          const lightColors = ["#eab308", "#06b6d4"];
                          const isLight = lightColors.some((x) => c === x);
                          return (
                            <span
                              key={t.id}
                              className="ds-overlay-tag"
                              style={{
                                background: t.color,
                                color: isLight ? "#1a1a1a" : "#fff",
                                textShadow: isLight ? "none" : "0 0 1px rgba(0,0,0,0.2)",
                              }}
                            >
                              {t.name}
                              <button
                                type="button"
                                className="ds-overlay-tag__remove"
                                onClick={(e) => { e.stopPropagation(); removeTag.mutate(t.id); }}
                                disabled={removeTag.isPending}
                                aria-label={`${t.name} 태그 제거`}
                                style={{ cursor: removeTag.isPending ? "wait" : "pointer" }}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })
                      ) : (
                        <span className="ds-overlay-info-row__label">태그 없음</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5" style={{ marginTop: 6 }}>
                      <Button type="button" intent="primary" size="sm" onClick={() => setTagCreateOpen(true)}>
                        + 추가
                      </Button>
                      {(tags?.filter((t: any) => !student.tags?.some((st: any) => st.id === t.id)).length ?? 0) > 0 && (
                        <select
                          className="ds-input"
                          style={{ fontSize: 12, minWidth: 120 }}
                          onChange={(e) => {
                            const tagId = Number(e.target.value);
                            if (tagId) addTag.mutate(tagId);
                            e.currentTarget.value = "";
                          }}
                        >
                          <option value="">기존 태그…</option>
                          {tags
                            ?.filter((t: any) => !student.tags?.some((st: any) => st.id === t.id))
                            .map((tag: any) => (
                              <option key={tag.id} value={tag.id}>{tag.name}</option>
                            ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* 메모 */}
                  <div className="ds-overlay-sidebar-section">
                    <div className="ds-overlay-sidebar-section__title">
                      메모
                      {updateMemo.isPending && (
                        <span className="ds-overlay-memo__status ds-overlay-memo__status--saving">저장 중...</span>
                      )}
                      {updateMemo.isSuccess && !updateMemo.isPending && (
                        <span className="ds-overlay-memo__status ds-overlay-memo__status--saved">저장됨</span>
                      )}
                    </div>
                    <textarea
                      key={`memo-${student.memo ?? ""}`}
                      className="ds-textarea w-full"
                      rows={3}
                      defaultValue={student.memo ?? ""}
                      placeholder="포커스 해제 시 자동 저장"
                      onBlur={(e) => updateMemo.mutate(e.target.value)}
                      style={{ fontSize: 13, borderRadius: 8, border: "1px solid var(--color-border-divider)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Right panel — Stat-Tab 네비게이터 + 콘텐츠 */}
              <div className="ds-overlay-content-panel">
                {/* Stat-Tab 네비게이터: 요약 + 탭 전환 통합 */}
                <StudentStatTabs
                  activeTab={tab}
                  onTabChange={setTab}
                  enrollments={student.enrollments}
                  examGrades={examGrades}
                  homeworkGrades={homeworkGrades}
                  clinicData={clinicData ?? []}
                  questionsData={questionsData ?? []}
                />

                <div className="ds-overlay-content-panel__scrollable">
                  {tab === "enroll" && <EnrollmentsTab enrollments={student.enrollments} onNavigate={(path) => { if (props?.onClose) props.onClose(); navigate(path); }} />}
                  {tab === "score" && <ScoreTab data={examGrades} onNavigate={(path) => { if (props?.onClose) props.onClose(); navigate(path); }} />}
                  {tab === "homework" && <HomeworkTab data={homeworkGrades} onNavigate={(path) => { if (props?.onClose) props.onClose(); navigate(path); }} />}
                  {tab === "clinic" && <ClinicTab data={clinicData ?? []} onNavigate={(path) => { if (props?.onClose) props.onClose(); navigate(path); }} />}
                  {tab === "question" && <QuestionTab data={questionsData ?? []} onNavigate={(path) => { if (props?.onClose) props.onClose(); navigate(path); }} />}
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
  value: React.ReactNode;
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
      data-copyable={canCopy ? "" : undefined}
      onClick={canCopy ? handleCopy : undefined}
      title={canCopy ? "클릭하여 복사" : undefined}
    >
      <span className="ds-overlay-info-row__label">{label}</span>
      <span className={`ds-overlay-info-row__value${accent ? " ds-overlay-info-row__value--accent" : ""}`}>
        {displayValue}
        {canCopy && (
          <svg className="ds-overlay-info-row__copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </span>
    </div>
  );
}

/** Stat-Tab 네비게이터: 요약 숫자 + 탭 전환 통합 */
function StudentStatTabs({
  activeTab,
  onTabChange,
  enrollments,
  examGrades,
  homeworkGrades,
  clinicData,
  questionsData,
}: {
  activeTab: StatTabKey;
  onTabChange: (tab: StatTabKey) => void;
  enrollments: any[];
  examGrades: any[];
  homeworkGrades: any[];
  clinicData: any[];
  questionsData: any[];
}) {
  // 정책: 합격률은 "성취"(1차 + 보강합격) 기준. achievement가 내려오면 우선 사용.
  // 드리프트 방지: 같은 오버레이의 ScoreTab이 achievement 기반으로 뱃지를 그리므로
  // 요약 KPI도 동일 기준이어야 한다.
  let examPassCount = 0;
  let examFailCount = 0;
  for (const e of examGrades as any[]) {
    const ach: string | null | undefined = e.achievement;
    if (ach === "PASS" || ach === "REMEDIATED") examPassCount += 1;
    else if (ach === "FAIL") examFailCount += 1;
    else if (ach === "NOT_SUBMITTED" || ach == null) {
      // achievement 필드 없는 구서버 폴백 — remediated/is_pass로 계산
      if (e.remediated === true || e.final_pass === true || e.is_pass === true) examPassCount += 1;
      else if (e.is_pass === false || e.final_pass === false) examFailCount += 1;
    }
  }
  const examJudged = examPassCount + examFailCount;
  const avgScore = examGrades.length > 0
    ? Math.round(examGrades.reduce((s: number, e: any) => s + (e.total_score ?? 0), 0) / examGrades.length)
    : null;
  const passRate = examJudged > 0 ? `${Math.round((examPassCount / examJudged) * 100)}%` : null;

  const hwPassCount = homeworkGrades.filter((h: any) => h.passed === true).length;
  const hwTotal = homeworkGrades.length;

  const clinicCount = (clinicData ?? []).length;
  const clinicAttended = (clinicData ?? []).filter((c: any) => c.status === "ATTENDED" || c.status === "attended").length;
  const questionCount = (questionsData ?? []).length;

  const activeEnrollments = (enrollments ?? []).filter((en: any) => (en.status ?? "ACTIVE") === "ACTIVE").length;

  const tabs: { key: StatTabKey; label: string; value: string; sub?: string; tone?: string }[] = [
    {
      key: "enroll",
      label: "수강",
      value: `${activeEnrollments}`,
      sub: enrollments?.length !== activeEnrollments ? `전체 ${enrollments?.length ?? 0}` : undefined,
    },
    {
      key: "score",
      label: "시험",
      value: `${examGrades.length}건`,
      sub: [avgScore != null ? `평균 ${avgScore}` : null, passRate ? `합격 ${passRate}` : null].filter(Boolean).join(" · ") || undefined,
      tone: examJudged > 0 ? (examPassCount >= examFailCount ? "success" : "danger") : undefined,
    },
    {
      key: "homework",
      label: "과제",
      value: `${hwTotal}건`,
      sub: hwTotal > 0 ? `완료 ${hwPassCount}` : undefined,
    },
    {
      key: "clinic",
      label: "클리닉",
      value: `${clinicCount}건`,
      sub: clinicAttended > 0 ? `출석 ${clinicAttended}` : undefined,
    },
    {
      key: "question",
      label: "질문",
      value: `${questionCount}건`,
    },
  ];

  const isZero = (v: string) => v === "0" || v === "0건";

  return (
    <div className="ds-stat-tabs" role="tablist">
      {tabs.map((t) => {
        const active = activeTab === t.key;
        const muted = isZero(t.value);
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`ds-stat-tab${active ? " ds-stat-tab--active" : ""}${muted ? " ds-stat-tab--muted" : ""}`}
            onClick={() => onTabChange(t.key)}
          >
            <span className="ds-stat-tab__label">{t.label}</span>
            <span className={`ds-stat-tab__value${t.tone === "success" ? " ds-stat-tab__value--success" : t.tone === "danger" ? " ds-stat-tab__value--danger" : ""}`}>
              {t.value}
            </span>
            {t.sub && <span className="ds-stat-tab__sub">{t.sub}</span>}
          </button>
        );
      })}
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

  const statusLabel: Record<string, string> = { ACTIVE: "수강중", INACTIVE: "비활성", PENDING: "대기" };
  const statusTone: Record<string, string> = { ACTIVE: "success", INACTIVE: "muted", PENDING: "warning" };

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
            <Badge variant="solid" size="sm" tone={(statusTone[status] || "muted") as BadgeTone}>
              {statusLabel[status] || status}
            </Badge>
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
            <Badge variant="solid" size="sm" tone={(statusTone[st] || "muted") as BadgeTone}>
              {statusLabel[st] || p.status}
            </Badge>
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
                <Badge size="xs" className="shrink-0">
                  {typeLabel[postType] || postType}
                </Badge>
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
                <Badge variant="solid" size="sm" tone={(achievementTone[exam.achievement] || "muted") as BadgeTone}>
                  {achievementLabel[exam.achievement] || exam.achievement}
                </Badge>
              )}
              {!exam.achievement && (exam.remediated === true || exam.final_pass === true) && (
                // 구서버 폴백: achievement 미제공이지만 remediated/final_pass로 보강합격 감지
                <Badge variant="solid" size="sm" tone={exam.remediated ? "warning" : "success"}>
                  {exam.remediated ? "보강합격" : "합격"}
                </Badge>
              )}
              {exam.is_pass != null && !exam.achievement && exam.remediated !== true && exam.final_pass !== true && (
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
                <Badge variant="solid" size="sm" tone={(achievementTone[hw.achievement] || "muted") as BadgeTone}>
                  {achievementLabel[hw.achievement] || hw.achievement}
                </Badge>
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
