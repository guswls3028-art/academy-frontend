// PATH: src/features/messages/components/TemplateExplorer.tsx
// 템플릿 저장 — 목록형 UI (좌측 카테고리 트리 + 우측 리스트)

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FiMessageSquare, FiCopy } from "react-icons/fi";
import { FilePlus } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import Breadcrumb from "@/features/storage/components/Breadcrumb";
import TemplateCategoryTree from "./TemplateCategoryTree";
import TemplateEditModal from "./TemplateEditModal";
import {
  fetchMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  submitMessageTemplateReview,
  type MessageTemplateItem,
  type MessageTemplatePayload,
  type MessageTemplateCategory,
} from "../api/messages.api";
import { TEMPLATE_CATEGORY_LABELS, renderPreviewText } from "../constants/templateBlocks";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "./TemplateExplorer.module.css";

const QUERY_KEY = ["messaging", "templates"] as const;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SolapiStatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    APPROVED: {
      label: "승인",
      color: "var(--color-success)",
      bg: "color-mix(in srgb, var(--color-success) 12%, transparent)",
    },
    PENDING: {
      label: "검수 대기",
      color: "var(--color-primary)",
      bg: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
    },
    REJECTED: {
      label: "반려",
      color: "var(--color-error)",
      bg: "color-mix(in srgb, var(--color-error) 12%, transparent)",
    },
  };
  const c = cfg[status];
  if (!c) return null;
  return (
    <span
      className={styles.statusBadge}
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: MessageTemplateCategory }) {
  return (
    <span className={styles.categoryBadge}>
      {TEMPLATE_CATEGORY_LABELS[category]}
    </span>
  );
}

export type ModalOpenState =
  | "create"
  | { template: MessageTemplateItem; mode: "view" | "edit" }
  | null;

export default function TemplateExplorer() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<MessageTemplateCategory>("default");
  const [modalOpen, setModalOpen] = useState<ModalOpenState>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, activeCategory],
    queryFn: () => fetchMessageTemplates(activeCategory),
    staleTime: 30 * 1000,
  });

  const createMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) => createMessageTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setModalOpen(null);
      feedback.success("템플릿이 저장되었습니다.");
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<MessageTemplatePayload> }) =>
      updateMessageTemplate(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setModalOpen(null);
      feedback.success("템플릿이 수정되었습니다.");
    },
    onError: () => feedback.error("수정에 실패했습니다."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteMessageTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setDeletingId(null);
      feedback.success("템플릿이 삭제되었습니다.");
    },
    onError: () => {
      setDeletingId(null);
      feedback.error("삭제에 실패했습니다.");
    },
  });

  const submitReviewMut = useMutation({
    mutationFn: (id: number) => submitMessageTemplateReview(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setReviewingId(null);
      feedback.success(data.detail || "검수 신청이 완료되었습니다.");
    },
    onError: (err: unknown) => {
      setReviewingId(null);
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      feedback.error(msg || "검수 신청에 실패했습니다.");
    },
  });

  const handleDuplicate = (t: MessageTemplateItem) => {
    createMut.mutate({
      category: t.category,
      name: `복사 - ${t.name}`,
      subject: t.subject ?? "",
      body: t.body,
    });
    feedback.info("템플릿을 복제합니다…");
  };

  const breadcrumbPath = [
    { id: null, name: "템플릿" },
    { id: activeCategory, name: TEMPLATE_CATEGORY_LABELS[activeCategory] },
  ];

  const isCreate = modalOpen === "create";
  const isEditOrView = modalOpen !== null && modalOpen !== "create";
  const editing = isEditOrView ? modalOpen.template : null;
  const openAsView = isEditOrView && modalOpen.mode === "view";
  const modalCategory = editing ? editing.category : activeCategory;

  const descriptions: Record<MessageTemplateCategory, string> = {
    default: "어디서나 사용할 수 있는 기본 템플릿입니다. 이름·사이트 링크 블록을 사용할 수 있습니다.",
    signup: "가입/등록 완료 시 자동발송에 사용됩니다. 학생·학부모 ID·비밀번호 블록을 사용할 수 있습니다.",
    attendance: "출결 관련 자동발송에 사용됩니다. 이름·사이트 링크 등 기본 블록을 사용할 수 있습니다.",
    lecture: "강의·차시 내 학생 선택 후 발송할 때 사용됩니다. 강의명·출결·성적 블록 등을 사용할 수 있습니다.",
    exam: "시험 관련 자동발송에 사용됩니다. 시험명·성적 블록 등을 사용할 수 있습니다.",
    assignment: "과제 관련 자동발송에 사용됩니다. 과제명·성적 블록 등을 사용할 수 있습니다.",
    grades: "성적 관련 자동발송에 사용됩니다. 기본·강의 블록을 사용할 수 있습니다.",
    clinic: "클리닉 내 학생 선택 후 발송할 때 사용됩니다. 클리닉 합불·날짜 블록을 사용할 수 있습니다.",
    payment: "결제 관련 자동발송에 사용됩니다. 기본 블록을 사용할 수 있습니다.",
    notice: "운영공지 자동발송에 사용됩니다. 기본 블록을 사용할 수 있습니다.",
  };

  return (
    <div className={panelStyles.root}>
      <div className={panelStyles.header}>
        <h2 className={panelStyles.headerTitle}>템플릿 저장</h2>
        <p className={panelStyles.headerDesc}>
          알림톡·문자 발송 시 사용할 메시지 템플릿을 카테고리별로 관리합니다.
        </p>
      </div>
      <div className={panelStyles.toolbar}>
        <Breadcrumb
          path={breadcrumbPath}
          onSelect={(id) => setActiveCategory((id as MessageTemplateCategory) ?? "default")}
        />
        <div className={panelStyles.actions}>
          <Button intent="primary" size="sm" onClick={() => setModalOpen("create")}>
            <FilePlus size={14} style={{ marginRight: 5 }} />
            새 템플릿
          </Button>
        </div>
      </div>

      <div className={panelStyles.body}>
        {/* 좌측 카테고리 트리 */}
        <aside className={panelStyles.tree}>
          <TemplateCategoryTree currentCategory={activeCategory} onSelect={setActiveCategory} />
        </aside>

        {/* 우측 목록 */}
        <div className={panelStyles.content}>
          {isLoading ? (
            <div className={styles.placeholder}>
              <div className={styles.loadingRows}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={styles.skeletonRow} />
                ))}
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div style={{ padding: "var(--space-6)" }}>
              <EmptyState
                scope="panel"
                tone="empty"
                mode="embedded"
                title="저장된 템플릿이 없습니다"
                description={descriptions[activeCategory]}
                actions={
                  <Button intent="primary" size="sm" onClick={() => setModalOpen("create")}>
                    + 새 템플릿 추가
                  </Button>
                }
              />
            </div>
          ) : (
            <div className={styles.list}>
              {templates.map((t) => (
                <div key={t.id} className={styles.listItem}>
                  {/* 아이콘 */}
                  <div className={styles.listItemIcon}>
                    <FiMessageSquare size={17} aria-hidden />
                  </div>

                  {/* 내용 */}
                  <div className={styles.listItemContent}>
                    <div className={styles.listItemHeader}>
                      <span className={styles.listItemName}>{t.name}</span>
                      {t.solapi_status && <SolapiStatusBadge status={t.solapi_status} />}
                    </div>
                    <div className={styles.listItemMeta}>
                      <CategoryBadge category={t.category} />
                      <span className={styles.listItemDate}>{formatDate(t.updated_at)}</span>
                    </div>
                    {t.body && (
                      <p className={styles.listItemPreview}>
                        {renderPreviewText(t.body)}
                      </p>
                    )}
                  </div>

                  {/* 액션 */}
                  <div className={styles.listItemActions}>
                    {deletingId !== t.id && reviewingId !== t.id && (
                      <>
                        <Button
                          intent="secondary"
                          size="sm"
                          onClick={() => setModalOpen({ template: t, mode: "edit" })}
                        >
                          수정
                        </Button>
                        <Button
                          intent="secondary"
                          size="sm"
                          title="복제"
                          onClick={() => handleDuplicate(t)}
                          disabled={createMut.isPending}
                        >
                          <FiCopy size={13} aria-label="복제" />
                        </Button>
                        {t.solapi_status !== "PENDING" && t.solapi_status !== "APPROVED" && (
                          <Button
                            intent="primary"
                            size="sm"
                            onClick={() => setReviewingId(t.id)}
                          >
                            검수 신청
                          </Button>
                        )}
                        <Button
                          intent="danger"
                          size="sm"
                          onClick={() => setDeletingId(t.id)}
                        >
                          삭제
                        </Button>
                      </>
                    )}

                    {/* 검수 신청 확인 */}
                    {reviewingId === t.id && (
                      <div className={styles.confirmBox}>
                        <span className={styles.confirmLabel}>검수 신청할까요?</span>
                        <Button
                          intent="primary"
                          size="sm"
                          onClick={() => submitReviewMut.mutate(t.id)}
                          disabled={submitReviewMut.isPending}
                        >
                          {submitReviewMut.isPending ? "신청 중…" : "신청"}
                        </Button>
                        <Button
                          intent="secondary"
                          size="sm"
                          onClick={() => setReviewingId(null)}
                          disabled={submitReviewMut.isPending}
                        >
                          취소
                        </Button>
                      </div>
                    )}

                    {/* 삭제 확인 */}
                    {deletingId === t.id && (
                      <div className={styles.confirmBox}>
                        <span className={styles.confirmLabel}>정말 삭제할까요?</span>
                        <Button
                          intent="danger"
                          size="sm"
                          onClick={() => deleteMut.mutate(t.id)}
                          disabled={deleteMut.isPending}
                        >
                          {deleteMut.isPending ? "삭제 중…" : "삭제"}
                        </Button>
                        <Button
                          intent="secondary"
                          size="sm"
                          onClick={() => setDeletingId(null)}
                          disabled={deleteMut.isPending}
                        >
                          취소
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <TemplateEditModal
        open={isCreate || isEditOrView}
        onClose={() => setModalOpen(null)}
        category={modalCategory}
        initial={editing ?? undefined}
        defaultLocked={openAsView}
        onSubmit={(payload) => {
          if (editing) {
            updateMut.mutate({ id: editing.id, payload });
          } else {
            createMut.mutate(payload);
          }
        }}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
