// PATH: src/app_admin/domains/students/overlays/StudentsDetailOverlay.tsx
// 학생 상세 팝업 — URL/뒤로가기를 유지하면서 현재 업무 화면 위에 표시

import { useParams, useNavigate, useLocation } from "react-router";
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useCallback,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { FolderOpen } from "lucide-react";
import api from "@/shared/api/axios";

import {
  getStudentDetail,
  fetchStudentCustomFields,
  fetchStudentAccountNotifications,
  getTags,
  attachStudentTag,
  detachStudentTag,
  createMemo,
  toggleStudentActive,
  type ClientAccountNotificationLog,
  type ClientEnrollmentLite,
  type ClientStudentTag,
} from "../api/students.api";
import { useTenantLabels } from "@/shared/hooks/useTenantLabels";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import LectureChip from "@/shared/ui/chips/LectureChip";
import StudentScoreTrendChart from "@/shared/ui/assessment/StudentScoreTrendChart";
import {
  fetchAdminStudentGrades,
  type StudentExamGrade,
  type StudentGradesResponse,
  type StudentHomeworkGrade,
} from "@/shared/api/contracts/studentGrades";
import { EmptyState, Button, CloseButton, Badge, ICON, type BadgeTone } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { formatPhone, formatStudentPhoneDisplay, formatOmrCode, formatGenderDisplay } from "@/shared/utils/formatPhone";
import { adminStudentsQueryKeys } from "../queryKeys";
import StudentWrongNoteBuilder from "@admin/domains/results/public/StudentWrongNoteBuilder";
import HomeworkQuickEditor from "./HomeworkQuickEditor";
import styles from "./StudentsDetailOverlay.module.css";

const StudentFormModal = lazy(() => import("../components/EditStudentModal"));
const TagCreateModal = lazy(() => import("../components/TagCreateModal"));
const DeleteConfirmModal = lazy(() => import("../components/DeleteConfirmModal"));
const StudentEnrollmentMatrixDrawer = lazy(() => import("../components/StudentEnrollmentMatrixDrawer"));
const StudentStorageExplorer = lazy(() => import("@admin/domains/storage/components/StudentStorageExplorer"));

type StatTabKey = "enroll" | "score" | "homework" | "wrong-note" | "clinic" | "question";
type ExamSessionScope = "all" | "REGULAR" | "SUPPLEMENT";
type HomeworkStatusScope = "all" | "attention" | "done";
type HomeworkSortMode = "session_desc" | "session_asc" | "updated";

const EXAM_SESSION_SCOPE_OPTIONS: Array<{
  value: ExamSessionScope;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "REGULAR", label: "정규 수업" },
  { value: "SUPPLEMENT", label: "보강" },
];
type ClinicParticipant = {
  id: number | string;
  session?: number | string | null;
  status?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  student_name?: string | null;
  session_date?: string | null;
  session_start_time?: string | null;
  session_location?: string | null;
  clinic_reason?: string | null;
};

type CommunityPost = {
  id: number | string;
  replies_count?: number | null;
  reply_count?: number | null;
  post_type?: string | null;
  title?: string | null;
  created_at?: string | null;
  created_by_display?: string | null;
};

type ListEnvelope<T> = {
  results?: T[];
};

function listFromResponse<T>(value: T[] | ListEnvelope<T> | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.results) ? value.results : [];
}

type StudentsDetailOverlayProps = {
  /** 라우트가 아닌 곳(예: 모달)에서 띄울 때 전달. 있으면 onClose로만 닫고 라우트 변경 없음 */
  studentId?: number;
  onClose?: () => void;
  /** 다른 AdminModal 위에서 열 때 사용하는 명시적 레이어 */
  layer?: "workspace" | "modal";
};

export default function StudentsDetailOverlay({
  studentId,
  onClose: closeOverride,
  layer = "workspace",
}: StudentsDetailOverlayProps = {}) {
  const routeParams = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = studentId ?? Number(routeParams.studentId);
  const onClose = useCallback(() => {
    if (closeOverride) {
      closeOverride();
      return;
    }
    if (location.key === "default") {
      navigate("/workspace/students/home", { replace: true });
      return;
    }
    navigate(-1);
  }, [closeOverride, location.key, navigate]);
  const qc = useQueryClient();
  const studentQueryKey = ["student", id] as const;
  const studentsQueryKey = ["students"] as const;

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
    queryKey: adminStudentsQueryKeys.studentDetail(id),
    queryFn: () => getStudentDetail(id),
    enabled: !!id,
  });
  const { data: customFieldDefinitions = [] } = useQuery({
    queryKey: adminStudentsQueryKeys.customFields,
    queryFn: () => fetchStudentCustomFields(true),
  });

  const { data: tags } = useQuery({
    queryKey: adminStudentsQueryKeys.tags,
    queryFn: getTags,
  });

  // 공유 데이터: 대시보드 + 탭에서 중복 호출 제거
  const {
    data: gradesData,
    isLoading: gradesLoading,
    isError: gradesError,
    refetch: refetchGrades,
  } = useQuery({
    queryKey: adminStudentsQueryKeys.studentGrades(id),
    queryFn: () => fetchAdminStudentGrades(id),
    enabled: id > 0,
    refetchOnMount: "always",
  });
  const examGrades = gradesData?.exams ?? [];
  const homeworkGrades = gradesData?.homeworks ?? [];

  const { data: clinicData } = useQuery({
    queryKey: adminStudentsQueryKeys.studentClinic(id),
    queryFn: async () => {
      const res = await api.get<ClinicParticipant[] | ListEnvelope<ClinicParticipant>>("/clinic/participants/", { params: { student: id, page_size: 50 } });
      return listFromResponse(res.data);
    },
    enabled: id > 0,
  });
  const { data: questionsData } = useQuery({
    queryKey: adminStudentsQueryKeys.studentQuestions(id),
    queryFn: async () => {
      const res = await api.get<CommunityPost[] | ListEnvelope<CommunityPost>>("/community/posts/", { params: { author_student: id, page_size: 50 } });
      return listFromResponse(res.data);
    },
    enabled: id > 0,
  });
  const { data: accountNotifications, isLoading: accountNotificationsLoading } = useQuery({
    queryKey: adminStudentsQueryKeys.studentAccountNotifications(id),
    queryFn: () => fetchStudentAccountNotifications(id, 5),
    enabled: id > 0,
  });

  const addTag = useMutation({
    mutationFn: (tagId: number) => attachStudentTag(id, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.studentDetail(id) });
      qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.tags });
    },
    onError: () => { feedback.error("처리에 실패했습니다."); },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: number) => detachStudentTag(id, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.studentDetail(id) }),
    onError: () => { feedback.error("처리에 실패했습니다."); },
  });

  const updateMemo = useMutation({
    mutationFn: (memo: string) => createMemo(id, memo),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.studentDetail(id) }),
    onError: () => { feedback.error("처리에 실패했습니다."); },
  });

  const toggleActive = useMutation({
    mutationFn: (nextActive: boolean) => toggleStudentActive(id, nextActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.studentDetail(id) });
      qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.students });
    },
    onError: () => { feedback.error("처리에 실패했습니다."); },
  });

  // 에러 상태 (존재하지 않는 학생 ID 등)
  if (isError || (!isLoading && !student && !!id)) {
    return (
      <StudentDetailShell onClose={onClose} layer={layer}>
        <div className={`ds-overlay-body ${styles.bodyPadded}`}>
          <EmptyState scope="panel" tone="error" title="학생 정보를 찾을 수 없습니다" description="삭제되었거나 잘못된 학생 ID입니다." />
          <div className={styles.centerAction}>
            <Button intent="secondary" size="sm" onClick={onClose}>닫기</Button>
          </div>
        </div>
      </StudentDetailShell>
    );
  }

  // 로딩 스켈레톤
  if (isLoading || !student) {
    return (
      <StudentDetailShell onClose={onClose} layer={layer}>
        <header className="ds-overlay-header">
          <div className="ds-overlay-header__inner">
            <div className="ds-overlay-header__left">
              <div className="ds-overlay-header__avatar-wrap" aria-hidden>
                <span className={`ds-overlay-header__avatar ${styles.skeletonAvatar}`}>
                  &nbsp;
                </span>
              </div>
              <div className="ds-overlay-header__title-block">
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonSubtitle} />
              </div>
            </div>
          </div>
        </header>
        <div className={`ds-overlay-body ${styles.bodyPadded}`}>
          <EmptyState scope="panel" tone="loading" title="학생 정보를 불러오는 중..." />
        </div>
      </StudentDetailShell>
    );
  }

  const studentTagIds = new Set(student.tags.map((tag) => tag.id));
  const availableTags = tags?.filter((tag) => !studentTagIds.has(tag.id)) ?? [];

  return (
    <>
      <StudentDetailShell onClose={onClose} layer={layer}>
          <header className={`ds-overlay-header ${styles.detailHeader}`}>
            <div className="ds-overlay-header__inner">
              <div className="ds-overlay-header__left">
                <div className="ds-overlay-header__avatar-wrap" aria-hidden>
                  <span className={`ds-overlay-header__avatar ${styles.identityAvatar}`}>
                    {student.profilePhotoUrl ? (
                      <img src={student.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (student.name || "?")[0]
                    )}
                  </span>
                </div>
                <div className={`ds-overlay-header__title-block ${styles.headerTitleBlock}`}>
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
                  <dl className={styles.identityMeta}>
                    <div className={styles.identityMetaItem}>
                      <dt>아이디</dt>
                      <dd>{student.psNumber ?? "—"}</dd>
                    </div>
                    <div className={styles.identityMetaItem}>
                      <dt>시험코드</dt>
                      <dd>{formatOmrCode(student.omrCode)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="ds-overlay-header__right">
                <div className={`ds-overlay-header__actions ${styles.headerActions}`}>
                  <div className={styles.statusControl}>
                    <span className={styles.statusLabel}>학생 상태</span>
                    <button
                    type="button"
                    className={styles.statusToggle}
                    data-active={student.active ? "true" : "false"}
                    onClick={() => toggleActive.mutate(!student.active)}
                    disabled={toggleActive.isPending}
                    aria-label={student.active ? "현재 활성, 비활성으로 변경" : "현재 비활성, 활성으로 변경"}
                    title={student.active ? "눌러서 비활성으로 변경" : "눌러서 활성으로 변경"}
                  >
                      <span className={styles.statusDot} aria-hidden />
                      {toggleActive.isPending ? "변경 중" : student.active ? "활성" : "비활성"}
                    </button>
                  </div>
                  <span className={styles.actionDivider} aria-hidden />
                  <Button type="button" intent="secondary" size="sm" onClick={() => setEditOpen(true)}>
                    정보 수정
                  </Button>
                  <Button type="button" intent="ghost" size="sm" className={styles.deleteAction} onClick={() => setDeleteConfirmOpen(true)}>
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <div className="ds-overlay-body" data-testid="student-detail-scroll">
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

                  <div className="ds-overlay-sidebar-section">
                    <div className="ds-overlay-sidebar-section__title">계정 알림톡</div>
                    <AccountNotificationHistory
                      logs={accountNotifications ?? []}
                      loading={accountNotificationsLoading}
                    />
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

                  {customFieldDefinitions.some(
                    (definition) => {
                      const value = student.customFields[definition.key];
                      return value !== null && value !== undefined && value !== "";
                    },
                  ) && (
                    <div className="ds-overlay-sidebar-section">
                      <div className="ds-overlay-sidebar-section__title">맞춤 정보</div>
                      <div className="ds-overlay-info-rows">
                        {customFieldDefinitions.map((definition) => {
                          const value = student.customFields[definition.key];
                          return value === null || value === undefined || value === ""
                            ? null
                            : (
                              <InfoRow
                                key={definition.key}
                                label={definition.label}
                                value={String(value)}
                              />
                            );
                        })}
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
                      {student.tags.length ? (
                        student.tags.map((tag: ClientStudentTag) => {
                          const c = tag.color.toLowerCase();
                          const lightColors = ["#eab308", "#06b6d4"];
                          const isLight = lightColors.some((x) => c === x);
                          return (
                            <span
                              key={tag.id}
                              className={`ds-overlay-tag ${styles.studentTag}`}
                              data-light={isLight ? "" : undefined}
                              style={{ "--student-tag-color": tag.color } as CSSProperties}
                            >
                              {tag.name}
                              <button
                                type="button"
                                className={`ds-overlay-tag__remove ${styles.studentTagRemove}`}
                                onClick={(e) => { e.stopPropagation(); removeTag.mutate(tag.id); }}
                                disabled={removeTag.isPending}
                                data-pending={removeTag.isPending ? "" : undefined}
                                aria-label={`${tag.name} 태그 제거`}
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
                    <div className={styles.tagControls}>
                      <Button type="button" intent="primary" size="sm" onClick={() => setTagCreateOpen(true)}>
                        + 추가
                      </Button>
                      {availableTags.length > 0 && (
                        <select
                          className={`ds-input ${styles.tagSelect}`}
                          onChange={(e) => {
                            const tagId = Number(e.target.value);
                            if (tagId) addTag.mutate(tagId);
                            e.currentTarget.value = "";
                          }}
                        >
                          <option value="">기존 태그…</option>
                          {availableTags.map((tag) => (
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
                      className={`ds-textarea w-full ${styles.memoTextarea}`}
                      rows={3}
                      defaultValue={student.memo ?? ""}
                      placeholder="포커스 해제 시 자동 저장"
                      onBlur={(e) => updateMemo.mutate(e.target.value)}
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
                  examSummary={gradesData?.exam_summary}
                  homeworkGrades={homeworkGrades}
                  gradesLoading={gradesLoading}
                  gradesError={gradesError}
                  clinicData={clinicData ?? []}
                  questionsData={questionsData ?? []}
                />

                <div className="ds-overlay-content-panel__scrollable">
                  {tab === "enroll" && <EnrollmentsTab studentId={id} studentName={student.name || ""} enrollments={student.enrollments} onNavigate={(path) => { closeOverride?.(); navigate(path); }} />}
                  {tab === "score" && (
                    <ScoreTab
                      data={examGrades}
                      trend={gradesData?.exam_trend ?? []}
                      isLoading={gradesLoading}
                      isError={gradesError}
                      onRetry={() => { void refetchGrades(); }}
                      onNavigate={(path) => { closeOverride?.(); navigate(path); }}
                    />
                  )}
                  {tab === "homework" && (
                    <HomeworkTab
                      data={homeworkGrades}
                      isLoading={gradesLoading}
                      isError={gradesError}
                      onRetry={() => { void refetchGrades(); }}
                      onUpdated={async () => { await refetchGrades(); }}
                      onNavigate={(path) => { closeOverride?.(); navigate(path); }}
                    />
                  )}
                  {tab === "wrong-note" && <StudentWrongNoteBuilder studentId={id} />}
                  {tab === "clinic" && <ClinicTab data={clinicData ?? []} onNavigate={(path) => { closeOverride?.(); navigate(path); }} />}
                  {tab === "question" && <QuestionTab data={questionsData ?? []} onNavigate={(path) => { closeOverride?.(); navigate(path); }} />}
                </div>
              </div>
            </div>
          </div>

          {/* 우하단 인벤토리 트리거 — 아이콘만 큼지막하게, 클릭 시 좌측 패널 */}
          <div className="ds-overlay-inventory-wrap">
            <button
              type="button"
              className={`ds-inventory-trigger-btn ${styles.inventoryTrigger}`}
              onClick={() => setInventoryOpen(true)}
              title="인벤토리"
              aria-label="인벤토리 열기"
            >
              <FolderOpen size={ICON.lg} aria-hidden />
            </button>
          </div>
      </StudentDetailShell>

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
              <div className={styles.inventoryExplorerBody}>
                <Suspense fallback={<div className={styles.inventoryLoading}>로딩 중...</div>}>
                  <StudentStorageExplorer studentPs={student.psNumber} />
                </Suspense>
              </div>
            </div>
          </>,
          document.body
        )}

      {editOpen &&
        createPortal(
          <Suspense fallback={null}>
            <StudentFormModal
              open={true}
              initialValue={student}
              onClose={() => setEditOpen(false)}
              onSuccess={() => {
                setEditOpen(false);
                qc.invalidateQueries({ queryKey: studentQueryKey });
                qc.invalidateQueries({ queryKey: studentsQueryKey });
              }}
            />
          </Suspense>,
          document.body
        )}

      {tagCreateOpen &&
        createPortal(
          <Suspense fallback={null}>
            <TagCreateModal
              open={true}
              onClose={() => setTagCreateOpen(false)}
              onSuccess={(tag) => {
                addTag.mutate(tag.id);
                setTagCreateOpen(false);
              }}
              usedColors={tags?.map((tag) => tag.color).filter((color): color is string => Boolean(color)) ?? []}
            />
          </Suspense>,
          document.body
        )}

      {deleteConfirmOpen && (
        <Suspense fallback={null}>
          <DeleteConfirmModal
            open={true}
            id={id}
            onClose={() => setDeleteConfirmOpen(false)}
            onSuccess={() => {
              setDeleteConfirmOpen(false);
              qc.invalidateQueries({ queryKey: studentsQueryKey });
              feedback.success("학생이 삭제되었습니다. 30일간 보관 후 자동 삭제됩니다.");
              onClose();
            }}
          />
        </Suspense>
      )}
    </>
  );
}

function StudentDetailShell({
  onClose,
  children,
  layer,
}: {
  onClose: () => void;
  children: ReactNode;
  layer: "workspace" | "modal";
}) {
  const elevated = layer === "modal";
  return (
    <>
      <div className={`ds-overlay-backdrop${elevated ? ` ${styles.modalBackdrop}` : ""}`} onClick={onClose} aria-hidden />
      <div className={`ds-overlay-wrap${elevated ? ` ${styles.modalWrap}` : ""}`}>
        <div
          className="ds-overlay-panel ds-overlay-panel--student-detail"
          role="dialog"
          aria-modal="true"
          aria-label="학생 상세"
          data-testid="student-detail-overlay"
          onClick={(e) => e.stopPropagation()}
        >
          <CloseButton className="ds-overlay-panel__close" onClick={onClose} />
          {children}
        </div>
      </div>
    </>
  );
}

const ACCOUNT_NOTIFICATION_LABEL: Record<string, string> = {
  registration_approved_student: "학생 계정 안내",
  registration_approved_parent: "학부모 계정 안내",
  password_find_otp: "이전 비번찾기",
  password_reset_student: "학생 임시 비번",
  password_reset_parent: "학부모 임시 비번",
};

function formatAccountNotificationTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${d} ${hh}:${mm}`;
}

function AccountNotificationHistory({
  logs,
  loading,
}: {
  logs: ClientAccountNotificationLog[];
  loading: boolean;
}) {
  if (loading) {
    return <div className={styles.accountNotificationEmpty}>불러오는 중...</div>;
  }
  if (!logs.length) {
    return <div className={styles.accountNotificationEmpty}>최근 발송 없음</div>;
  }

  return (
    <div className={styles.accountNotificationList}>
      {logs.map((log) => {
        const failed = !log.success || log.status === "failed";
        const label = ACCOUNT_NOTIFICATION_LABEL[log.notificationType] ?? log.notificationType ?? "계정 알림톡";
        return (
          <div key={log.id} className={styles.accountNotificationItem}>
            <div className={styles.accountNotificationMain}>
              <span className={styles.accountNotificationType}>{label}</span>
              <span className={styles.accountNotificationTime}>{formatAccountNotificationTime(log.sentAt)}</span>
            </div>
            <span
              className={styles.accountNotificationStatus}
              data-status={failed ? "failed" : "sent"}
              title={failed ? log.failureReason || "발송 실패" : "발송 성공"}
            >
              {failed ? "실패" : "성공"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent,
  copyable,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
  copyable?: boolean;
}) {
  const displayValue = value || "-";
  const canCopy = copyable && value && value !== "-";

  const handleCopy = () => {
    if (!canCopy) return;
    const text = String(value).replace(/[^0-9a-zA-Z가-힣-]/g, "").trim() || String(value);
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
  examSummary,
  homeworkGrades,
  gradesLoading,
  gradesError,
  clinicData,
  questionsData,
}: {
  activeTab: StatTabKey;
  onTabChange: (tab: StatTabKey) => void;
  enrollments: ClientEnrollmentLite[];
  examGrades: StudentExamGrade[];
  examSummary?: StudentGradesResponse["exam_summary"];
  homeworkGrades: StudentHomeworkGrade[];
  gradesLoading: boolean;
  gradesError: boolean;
  clinicData: ClinicParticipant[];
  questionsData: CommunityPost[];
}) {
  // 정책: 합격률은 "성취"(1차 + 보강합격) 기준. achievement가 내려오면 우선 사용.
  // 드리프트 방지: 같은 오버레이의 ScoreTab이 achievement 기반으로 뱃지를 그리므로
  // 요약 KPI도 동일 기준이어야 한다.
  let examPassCount = 0;
  let examFailCount = 0;
  for (const e of examGrades) {
    const ach: string | null | undefined = e.achievement;
    if (ach === "PASS" || ach === "REMEDIATED") examPassCount += 1;
    else if (ach === "FAIL") examFailCount += 1;
    else if (ach === "NOT_SUBMITTED") {
      continue;
    } else if (ach == null) {
      // achievement 필드 없는 구서버 폴백 — remediated/is_pass로 계산
      if (e.remediated === true || e.final_pass === true || e.is_pass === true) examPassCount += 1;
      else if (e.is_pass === false || e.final_pass === false) examFailCount += 1;
    }
  }
  const examJudged = examPassCount + examFailCount;
  const avgScore = examSummary?.average_score_pct ?? null;
  const passRate = examJudged > 0 ? `${Math.round((examPassCount / examJudged) * 100)}%` : null;

  const hwPassCount = homeworkGrades.filter((homework) => (
    homework.achievement === "PASS" || homework.achievement === "REMEDIATED"
  )).length;
  const hwNotSubmittedCount = homeworkGrades.filter((homework) => (
    homework.achievement === "NOT_SUBMITTED"
  )).length;
  const hwTotal = homeworkGrades.length;

  const clinicCount = (clinicData ?? []).length;
  const clinicAttended = (clinicData ?? []).filter((participant) => participant.status === "ATTENDED" || participant.status === "attended").length;
  const questionCount = (questionsData ?? []).length;

  const activeEnrollments = (enrollments ?? []).filter((enrollment) => (enrollment.status ?? "ACTIVE") === "ACTIVE").length;

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
      value: gradesLoading ? "…" : gradesError ? "확인 필요" : `${examGrades.length}건`,
      sub: gradesLoading
        ? "불러오는 중"
        : gradesError
          ? "불러오기 실패"
          : [avgScore != null ? `평균 ${avgScore}%` : null, passRate ? `합격 ${passRate}` : null].filter(Boolean).join(" · ") || undefined,
      tone: examJudged > 0 ? (examPassCount >= examFailCount ? "success" : "danger") : undefined,
    },
    {
      key: "homework",
      label: "과제",
      value: gradesLoading ? "…" : gradesError ? "확인 필요" : `${hwTotal}건`,
      sub: gradesLoading
        ? "불러오는 중"
        : gradesError
          ? "불러오기 실패"
          : hwTotal > 0
            ? [`완료 ${hwPassCount}`, hwNotSubmittedCount > 0 ? `미제출 ${hwNotSubmittedCount}` : null].filter(Boolean).join(" · ")
            : undefined,
    },
    {
      key: "wrong-note",
      label: "오답노트",
      value: "통합",
      sub: "시험 + 워크북",
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
    <div className={styles.statTabs} role="tablist" aria-label="학생 활동 요약">
      {tabs.map((t) => {
        const active = activeTab === t.key;
        const muted = isZero(t.value);
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.statTab}${active ? ` ${styles.statTabActive}` : ""}${muted ? ` ${styles.statTabMuted}` : ""}`}
            onClick={() => onTabChange(t.key)}
          >
            <span className={styles.statTabLabel}>{t.label}</span>
            <span className={`${styles.statTabValue}${t.tone === "success" ? ` ${styles.statTabValueSuccess}` : t.tone === "danger" ? ` ${styles.statTabValueDanger}` : ""}`}>
              {t.value}
            </span>
            {t.sub && <span className={styles.statTabSub}>{t.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      className={styles.chevronIcon}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-text-muted)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function EnrollmentsTab({ studentId, studentName, enrollments, onNavigate }: { studentId: number; studentName: string; enrollments: ClientEnrollmentLite[]; onNavigate: (path: string) => void }) {
  const [matrixOpen, setMatrixOpen] = useState(false);
  if (!enrollments?.length) return <EmptyState scope="panel" tone="empty" title="수강 이력이 없습니다." />;

  const statusLabel: Record<string, string> = { ACTIVE: "수강중", INACTIVE: "비활성", PENDING: "대기" };
  const statusTone: Record<string, string> = { ACTIVE: "success", INACTIVE: "muted", PENDING: "warning" };

  // Phase #11/#12 — 학생 단위 matrix UI 진입 (수강중 강의만 대상).
  const activeLectures = enrollments
    .filter((enrollment) => (enrollment.status ?? "ACTIVE") === "ACTIVE" && enrollment.lectureId)
    .map((enrollment) => ({ id: enrollment.lectureId as number, title: enrollment.lectureName || `강의 ${enrollment.lectureId}` }));

  return (
    <div className={styles.tabList}>
      {/* Phase #11/#12 Matrix 진입 — 학생 단위 시험/과제 개별 추가·제거 */}
      {activeLectures.length > 0 && (
        <div className={styles.matrixBanner}>
          <div className={styles.matrixCopy}>
            <span className={styles.matrixTitle}>📋 수강 매트릭스</span>
            <span className={styles.matrixDescription}>학생 1명 × 세션별 시험·과제 빠른 추가/제거</span>
          </div>
          <button
            type="button"
            onClick={() => setMatrixOpen((v) => !v)}
            data-testid="enroll-matrix-toggle"
            className="ds-button"
            data-intent={matrixOpen ? "ghost" : "primary"}
            data-size="sm"
          >
            {matrixOpen ? "닫기" : "열기"}
          </button>
        </div>
      )}
      {matrixOpen && activeLectures.length > 0 && (
        <div className={styles.matrixPanel}>
          <Suspense fallback={<div className={styles.matrixLoading}>로딩 중...</div>}>
            <StudentEnrollmentMatrixDrawer
              studentId={studentId}
              studentName={studentName}
              lectures={activeLectures}
            />
          </Suspense>
        </div>
      )}
      <div className={styles.tabList}>
      {enrollments.map((enrollment) => {
        const { id, status: rawStatus, lectureId, lectureName, lectureColor, lectureChipLabel, enrolledAt } = enrollment;
        const status = rawStatus ?? "ACTIVE";
        const isActive = status === "ACTIVE";
        const canNav = !!lectureId;
        return (
          <div
            key={id}
            className={styles.tabRecord}
            data-clickable={canNav ? "" : undefined}
            data-inactive={isActive ? undefined : ""}
            onClick={canNav ? () => onNavigate(`/workspace/lectures/${lectureId}`) : undefined}
          >
            <LectureChip lectureName={lectureName || ""} color={lectureColor ?? undefined} chipLabel={lectureChipLabel} size={24} />
            <div className={styles.recordMain}>
              <span className={styles.recordTitle}>{lectureName || "-"}</span>
              {enrolledAt && (
                <span className={styles.recordMeta}>
                  {enrolledAt.slice(0, 10)} 등록
                </span>
              )}
            </div>
            <Badge variant="solid" size="sm" tone={(statusTone[status] || "muted") as BadgeTone}>
              {statusLabel[status] || status}
            </Badge>
            {canNav && <ChevronIcon />}
          </div>
        );
      })}
      </div>
    </div>
  );
}

/** 클리닉/상담 이력 탭 */
function ClinicTab({ data, onNavigate }: { data: ClinicParticipant[]; onNavigate: (path: string) => void }) {
  if (!data?.length) return <EmptyState scope="panel" tone="empty" title="클리닉/상담 이력이 없습니다." />;

  // 백엔드 ParticipantSerializer: status는 소문자 (booked, attended, no_show, cancelled, pending)
  const normalize = (status: string | null | undefined) => (status || "").toUpperCase();
  const statusLabel: Record<string, string> = { BOOKED: "예약", ATTENDED: "출석", NO_SHOW: "결석", CANCELLED: "취소", PENDING: "대기" };
  const statusTone: Record<string, string> = { BOOKED: "info", ATTENDED: "success", NO_SHOW: "danger", CANCELLED: "muted", PENDING: "warning" };

  return (
    <div className={styles.tabList}>
      {data.map((p) => {
        const st = normalize(p.status);
        const lectureName = p.lecture_title;
        const lectureColor = p.lecture_color;
        const lectureChip = p.lecture_chip_label;
        const sessionId = Number(p.session);
        const searchParams = new URLSearchParams();
        if (p.session_date && /^\d{4}-\d{2}-\d{2}$/.test(p.session_date)) {
          searchParams.set("date", p.session_date);
        }
        if (Number.isInteger(sessionId) && sessionId > 0) {
          searchParams.set("session", String(sessionId));
        }
        const queryString = searchParams.toString();
        const clinicPath = `/workspace/clinic/operations${queryString ? `?${queryString}` : ""}`;
        const clinicLabel = p.student_name
          ? `${p.student_name} 클리닉 출석·진행 열기`
          : "클리닉 출석·진행 열기";
        return (
          <button
            key={p.id}
            type="button"
            className={styles.tabRecord}
            data-clickable=""
            aria-label={clinicLabel}
            onClick={() => onNavigate(clinicPath)}
          >
            {lectureName && <LectureChip lectureName={lectureName} color={lectureColor ?? undefined} chipLabel={lectureChip} size={24} />}
            <div className={styles.recordMain}>
              <span className={styles.recordTitle}>
                {p.student_name ? `${p.student_name} 클리닉` : "클리닉"}
              </span>
              <div className={styles.recordMetaRow}>
                {p.session_date && <span>{p.session_date}</span>}
                {p.session_start_time && <span>{String(p.session_start_time).slice(0, 5)}</span>}
                {p.session_location && <span>· {p.session_location}</span>}
              </div>
              {p.clinic_reason && (
                <span className={styles.recordMeta}>{p.clinic_reason}</span>
              )}
            </div>
            <Badge variant="solid" size="sm" tone={(statusTone[st] || "muted") as BadgeTone}>
              {statusLabel[st] || p.status}
            </Badge>
            <span className={styles.recordActionHint}>출석·진행 열기</span>
            <ChevronIcon />
          </button>
        );
      })}
    </div>
  );
}

/** 질문 이력 탭 */
function QuestionTab({ data, onNavigate }: { data: CommunityPost[]; onNavigate: (path: string) => void }) {
  if (!data?.length) return <EmptyState scope="panel" tone="empty" title="질문 이력이 없습니다." />;

  const typeLabel: Record<string, string> = { qna: "질문", board: "게시글", notice: "공지", counsel: "상담", materials: "자료" };

  return (
    <div className={styles.tabList}>
      {data.map((post) => {
        const repliesCount = post.replies_count ?? post.reply_count ?? 0;
        const postType = post.post_type || "qna";
        // 질문 → QnA 인박스, 그 외 → 게시판
        const navPath = postType === "qna"
          ? `/workspace/community/qna?id=${post.id}`
          : `/workspace/community/board`;
        return (
          <div
            key={post.id}
            className={styles.questionRecord}
            data-clickable=""
            onClick={() => onNavigate(navPath)}
          >
            <div className={styles.questionHeader}>
              <div className={styles.questionTitleGroup}>
                <Badge size="xs" className={styles.shrink0}>
                  {typeLabel[postType] || postType}
                </Badge>
                <span className={styles.recordTitle}>{post.title || "(제목 없음)"}</span>
              </div>
              <div className={styles.questionMetaGroup}>
                {repliesCount > 0 && (
                  <span className={styles.replyCount}>
                    답변 {repliesCount}
                  </span>
                )}
                <ChevronIcon />
              </div>
            </div>
            <span className={styles.questionMeta}>
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
function ScoreTab({
  data,
  trend,
  isLoading,
  isError,
  onRetry,
  onNavigate,
}: {
  data: StudentExamGrade[];
  trend: StudentGradesResponse["exam_trend"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onNavigate: (path: string) => void;
}) {
  const labels = useTenantLabels();
  const [sessionScope, setSessionScope] = useState<ExamSessionScope>("all");
  const sessionScopeTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sessionScopePanelId = useId();
  if (isLoading) return <EmptyState scope="panel" tone="loading" title="성적 추이를 불러오는 중…" />;
  if (isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="성적 추이를 불러오지 못했습니다."
        description="잠시 후 다시 불러와 주세요."
        actions={<Button size="sm" onClick={onRetry}>다시 불러오기</Button>}
      />
    );
  }
  if (!data?.length) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="시험 성적이 없습니다."
        description="첫 시험 점수가 입력되면 1회차부터 자동으로 누적됩니다."
      />
    );
  }

  // PASS/FAIL 라벨은 학원장 커스텀 (Phase #5). REMEDIATED("보강합격")는 자체 정책.
  const achievementLabel: Record<string, string> = { PASS: labels.pass, FAIL: labels.fail, REMEDIATED: "보강합격", NOT_SUBMITTED: "미응시" };
  const achievementTone: Record<string, string> = { PASS: "success", FAIL: "danger", REMEDIATED: "warning", NOT_SUBMITTED: "muted" };
  const sessionScopeCounts: Record<ExamSessionScope, number> = {
    all: data.length,
    REGULAR: data.filter((exam) => exam.session_type === "REGULAR").length,
    SUPPLEMENT: data.filter((exam) => exam.session_type === "SUPPLEMENT").length,
  };
  const visibleExams = sessionScope === "all"
    ? data
    : data.filter((exam) => exam.session_type === sessionScope);
  const visibleTrend = sessionScope === "all"
    ? trend
    : trend.filter((point) => point.session_type === sessionScope);
  const selectedScopeLabel = EXAM_SESSION_SCOPE_OPTIONS.find((option) => option.value === sessionScope)?.label ?? "전체";

  function selectSessionScope(value: ExamSessionScope) {
    setSessionScope(value);
  }

  function handleSessionScopeKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % EXAM_SESSION_SCOPE_OPTIONS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + EXAM_SESSION_SCOPE_OPTIONS.length) % EXAM_SESSION_SCOPE_OPTIONS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = EXAM_SESSION_SCOPE_OPTIONS.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    selectSessionScope(EXAM_SESSION_SCOPE_OPTIONS[nextIndex].value);
    sessionScopeTabRefs.current[nextIndex]?.focus();
  }

  return (
    <div>
      <section className={styles.scoreScope} aria-labelledby={`${sessionScopePanelId}-title`}>
        <div className={styles.scoreScopeHeader}>
          <div>
            <span>시험 범위</span>
            <strong id={`${sessionScopePanelId}-title`}>정규 수업과 보강을 나눠 봅니다</strong>
          </div>
          <p>차시의 수업 구분에 따라 추이와 목록이 함께 바뀝니다.</p>
        </div>
        <div className={styles.scoreScopeTabs} role="tablist" aria-label="개인 시험 결과 범위">
          {EXAM_SESSION_SCOPE_OPTIONS.map((option, index) => {
            const tabId = `${sessionScopePanelId}-${option.value.toLowerCase()}`;
            return (
              <button
                key={option.value}
                ref={(node) => { sessionScopeTabRefs.current[index] = node; }}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={sessionScope === option.value}
                aria-controls={sessionScopePanelId}
                tabIndex={sessionScope === option.value ? 0 : -1}
                data-active={sessionScope === option.value ? "true" : "false"}
                data-session-type={option.value}
                onClick={() => selectSessionScope(option.value)}
                onKeyDown={(event) => handleSessionScopeKeyDown(event, index)}
              >
                <span>{option.label}</span>
                <strong>{sessionScopeCounts[option.value]}<small>건</small></strong>
              </button>
            );
          })}
        </div>
      </section>
      <div
        id={sessionScopePanelId}
        role="tabpanel"
        aria-labelledby={`${sessionScopePanelId}-${sessionScope.toLowerCase()}`}
      >
      {visibleExams.length > 0 ? (
        <>
      <StudentScoreTrendChart points={visibleTrend} />
      <div className={styles.tabList}>
      {visibleExams.map((exam, i) => {
        const lectureId = exam.lecture_id;
        const sessionId = exam.session_id;
        const canNav = !!lectureId && !!sessionId;
        const navPath = canNav ? `/workspace/lectures/${lectureId}/sessions/${sessionId}/scores` : "";
        return (
          <div
            key={exam.exam_id ?? i}
            className={styles.tabRecord}
            data-clickable={canNav ? "" : undefined}
            onClick={canNav ? () => onNavigate(navPath) : undefined}
          >
            {exam.lecture_title && (
              <LectureChip lectureName={exam.lecture_title} color={exam.lecture_color ?? undefined} chipLabel={exam.lecture_chip_label} size={24} />
            )}
            <div className={styles.recordMain}>
              <div className={styles.recordTitleRow}>
                <span className={styles.recordTitle}>{exam.title}</span>
                <Badge
                  size="xs"
                  tone={exam.session_type === "REGULAR" ? "info" : exam.session_type === "SUPPLEMENT" ? "teal" : "muted"}
                >
                  {exam.session_type === "REGULAR" ? "정규" : exam.session_type === "SUPPLEMENT" ? "보강" : "구분 필요"}
                </Badge>
              </div>
              <div className={styles.recordMetaRow}>
                {exam.session_title && <span>{exam.session_title}</span>}
                {(exam.retake_count ?? 0) > 1 && <span>· 재시도 {(exam.retake_count ?? 0) - 1}회</span>}
                {exam.submitted_at && <span>· {exam.submitted_at.slice(0, 10)}</span>}
              </div>
            </div>
            <div className={styles.recordActions}>
              {exam.total_score != null && (
                <span className={styles.scoreValue}>
                  {Math.round(exam.total_score)}<span className={styles.scoreMax}>/{exam.max_score ?? 100}</span>
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
                  {exam.remediated ? "보강합격" : labels.pass}
                </Badge>
              )}
              {exam.is_pass != null && !exam.achievement && exam.remediated !== true && exam.final_pass !== true && (
                <Badge variant="solid" size="sm" tone={exam.is_pass ? "success" : "danger"}>
                  {exam.is_pass ? "합" : "불"}
                </Badge>
              )}
              {canNav && (
                <ChevronIcon />
              )}
            </div>
          </div>
        );
      })}
      </div>
        </>
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title={`${selectedScopeLabel} 시험 성적이 없습니다.`}
          description={sessionScope === "all"
            ? "첫 시험 점수가 입력되면 1회차부터 자동으로 누적됩니다."
            : `차시가 ${selectedScopeLabel}으로 구분된 시험이 여기에 표시됩니다.`}
        />
      )}
      </div>
    </div>
  );
}

/** 과제 탭 — admin/student-grades API 기반 */
function HomeworkTab({
  data,
  isLoading,
  isError,
  onRetry,
  onUpdated,
  onNavigate,
}: {
  data: StudentHomeworkGrade[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onUpdated: () => Promise<unknown>;
  onNavigate: (path: string) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [sessionScope, setSessionScope] = useState<ExamSessionScope>("all");
  const [statusScope, setStatusScope] = useState<HomeworkStatusScope>("all");
  const [sortMode, setSortMode] = useState<HomeworkSortMode>("session_desc");
  if (isLoading) return <EmptyState scope="panel" tone="loading" title="과제 성적을 불러오는 중…" />;
  if (isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="과제 성적을 불러오지 못했습니다."
        description="잠시 후 다시 불러와 주세요."
        actions={<Button size="sm" onClick={onRetry}>다시 불러오기</Button>}
      />
    );
  }
  if (!data?.length) return <EmptyState scope="panel" tone="empty" title="과제 성적이 없습니다." />;

  const achievementLabel: Record<string, string> = {
    PASS: "완료",
    FAIL: "미완료",
    REMEDIATED: "보강완료",
    NOT_SUBMITTED: "미제출",
  };
  const achievementTone: Record<string, BadgeTone> = {
    PASS: "success",
    FAIL: "danger",
    REMEDIATED: "warning",
    NOT_SUBMITTED: "danger",
  };
  const isDone = (homework: StudentHomeworkGrade) => (
    homework.achievement === "PASS"
    || homework.achievement === "REMEDIATED"
    || homework.passed === true
  );
  const visibleData = data
    .filter((homework) => {
      if (sessionScope !== "all" && homework.session_type !== sessionScope) return false;
      if (statusScope === "done") return isDone(homework);
      if (statusScope === "attention") return !isDone(homework);
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "updated") {
        const updatedDiff = Date.parse(b.score_updated_at ?? "") - Date.parse(a.score_updated_at ?? "");
        if (Number.isFinite(updatedDiff) && updatedDiff !== 0) return updatedDiff;
      } else {
        const aOrder = a.session_regular_order ?? a.session_order;
        const bOrder = b.session_regular_order ?? b.session_order;
        if (aOrder == null && bOrder != null) return 1;
        if (aOrder != null && bOrder == null) return -1;
        if (aOrder != null && bOrder != null && aOrder !== bOrder) {
          return sortMode === "session_desc" ? bOrder - aOrder : aOrder - bOrder;
        }
      }
      const displayOrderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (displayOrderDiff !== 0) return displayOrderDiff;
      return b.homework_id - a.homework_id;
    });

  return (
    <div>
      <section className={styles.homeworkHistoryControls} aria-label="과제 이력 표시 기준">
        <div className={styles.homeworkHistorySummary}>
          <strong>차시별 과제</strong>
          <span aria-live="polite">{visibleData.length}/{data.length}건 표시</span>
        </div>
        <div className={styles.homeworkHistoryFilters}>
          <label>
            <span>수업</span>
            <select value={sessionScope} onChange={(event) => setSessionScope(event.target.value as ExamSessionScope)}>
              <option value="all">정규·보강 전체</option>
              <option value="REGULAR">정규 수업</option>
              <option value="SUPPLEMENT">보강</option>
            </select>
          </label>
          <label>
            <span>상태</span>
            <select value={statusScope} onChange={(event) => setStatusScope(event.target.value as HomeworkStatusScope)}>
              <option value="all">전체 상태</option>
              <option value="attention">확인 필요</option>
              <option value="done">완료</option>
            </select>
          </label>
          <label>
            <span>정렬</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as HomeworkSortMode)}>
              <option value="session_desc">최근 차시순</option>
              <option value="session_asc">1차시부터</option>
              <option value="updated">최근 수정순</option>
            </select>
          </label>
        </div>
      </section>
      {visibleData.length === 0 ? (
        <EmptyState scope="panel" tone="empty" title="조건에 맞는 과제가 없습니다." description="수업 또는 상태 필터를 바꿔 주세요." />
      ) : (
        <div className={styles.tabList}>
          {visibleData.map((hw, i) => {
            const lectureId = hw.lecture_id;
            const sessionId = hw.session_id;
            const canNav = !!lectureId && !!sessionId;
            const navPath = canNav ? `/workspace/lectures/${lectureId}/sessions/${sessionId}/scores` : "";
            const rowKey = `${hw.homework_id}-${hw.enrollment_id}-${i}`;
            const isEditing = editingKey === rowKey;
            return (
              <div key={rowKey} className={styles.homeworkRecordGroup}>
                <div
                  className={styles.tabRecord}
                  data-clickable={canNav ? "" : undefined}
                  onClick={canNav ? () => onNavigate(navPath) : undefined}
                >
                  {hw.lecture_title && (
                    <LectureChip lectureName={hw.lecture_title} color={hw.lecture_color ?? undefined} chipLabel={hw.lecture_chip_label} size={24} />
                  )}
                  <div className={styles.recordMain}>
                    <span className={styles.recordTitle}>{hw.title}</span>
                    <div className={styles.recordMetaRow}>
                      {hw.session_title && <span>{hw.session_title}</span>}
                      {hw.session_type && <span>· {hw.session_type === "SUPPLEMENT" ? "보강" : "정규"}</span>}
                      <span>· {hw.grading_mode === "COMPLETION" ? "완료 체크" : "숫자 채점"}</span>
                      {(hw.retake_count ?? 0) > 1 && <span>· 재시도 {(hw.retake_count ?? 0) - 1}회</span>}
                    </div>
                  </div>
                  <div className={styles.recordActions}>
                    {hw.grading_mode !== "COMPLETION" && hw.score != null && (
                      <span className={styles.scoreValue}>
                        {Math.round(hw.score)}<span className={styles.scoreMax}>/{hw.max_score ?? 100}</span>
                      </span>
                    )}
                    <Badge variant="solid" size="sm" tone={hw.achievement ? (achievementTone[hw.achievement] || "muted") : "muted"}>
                      {hw.achievement ? (achievementLabel[hw.achievement] || hw.achievement) : "검사 전"}
                    </Badge>
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      aria-expanded={isEditing}
                      aria-controls={`homework-quick-editor-${hw.homework_id}-${hw.enrollment_id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingKey(isEditing ? null : rowKey);
                      }}
                    >
                      바로 수정
                    </Button>
                    {canNav && <ChevronIcon />}
                  </div>
                </div>
                {isEditing && (
                  <HomeworkQuickEditor
                    grade={hw}
                    onClose={() => setEditingKey(null)}
                    onUpdated={onUpdated}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
