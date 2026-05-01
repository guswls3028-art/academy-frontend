// PATH: src/app_admin/domains/messages/components/TemplateExplorer.tsx
// 템플릿 저장 — "기본"=사용자 커스텀 | 나머지=자동발송 동일 카테고리 (기본 템플릿 구분 표시)

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FiMessageSquare,
  FiCopy,
  FiEdit2,
  FiTrash2,
  FiSend,
} from "react-icons/fi";
import { FilePlus, Shield } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import TemplateCategoryTree from "./TemplateCategoryTree";
import TemplateEditModal from "./TemplateEditModal";
import {
  fetchMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  submitMessageTemplateReview,
  provisionDefaultTemplates,
  type MessageTemplateItem,
  type MessageTemplatePayload,
  type MessageTemplateCategory,
} from "../api/messages.api";
import {
  TEMPLATE_CATEGORY_LABELS,
  renderPreviewBadges,
} from "../constants/templateBlocks";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import "../styles/templateEditor.css";

const QUERY_KEY = ["messaging", "templates"] as const;

/** 기본 템플릿 식별 — is_system 플래그 또는 이름 접두어 기준 */
function isDefaultTemplate(t: MessageTemplateItem): boolean {
  return t.is_system || t.name.startsWith("[HakwonPlus]") || t.name.startsWith("[학원플러스]");
}

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
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "var(--radius-md)",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap" as const,
        color: c.color,
        background: c.bg,
      }}
    >
      {c.label}
    </span>
  );
}

function DefaultBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 8px",
        borderRadius: "var(--radius-md)",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap" as const,
        color: "var(--color-status-info, #2563eb)",
        background: "color-mix(in srgb, var(--color-status-info, #2563eb) 10%, transparent)",
      }}
    >
      <Shield size={10} />
      기본
    </span>
  );
}

function IconAction({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
        color: danger ? "var(--color-error)" : "var(--color-text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background 0.12s, border-color 0.12s, color 0.12s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = danger
            ? "color-mix(in srgb, var(--color-error) 8%, var(--color-bg-surface))"
            : "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))";
          (e.currentTarget as HTMLButtonElement).style.borderColor = danger
            ? "var(--color-error)"
            : "var(--color-primary)";
          (e.currentTarget as HTMLButtonElement).style.color = danger
            ? "var(--color-error)"
            : "var(--color-primary)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--color-bg-surface)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "var(--color-border-divider)";
        (e.currentTarget as HTMLButtonElement).style.color = danger
          ? "var(--color-error)"
          : "var(--color-text-secondary)";
      }}
    >
      {icon}
    </button>
  );
}

const CATEGORY_DESCRIPTIONS: Record<MessageTemplateCategory, string> = {
  default:
    "사용자가 직접 만든 커스텀 템플릿입니다. 수동 발송 시 자유롭게 사용할 수 있습니다.",
  signup:
    "가입/등록 관련 자동발송에 사용됩니다. 학생·학부모 ID·비밀번호 블록을 사용할 수 있습니다.",
  attendance:
    "출결 관련 자동발송에 사용됩니다. 강의명·차시명 블록을 사용할 수 있습니다.",
  lecture:
    "강의 관련 자동발송에 사용됩니다. 강의명·차시명 블록을 사용할 수 있습니다.",
  exam: "시험 관련 자동발송에 사용됩니다. 시험명·성적 블록을 사용할 수 있습니다.",
  assignment:
    "과제 관련 자동발송에 사용됩니다. 과제명·성적 블록을 사용할 수 있습니다.",
  grades:
    "성적 관련 자동발송에 사용됩니다. 시험·과제 성적 블록을 사용할 수 있습니다.",
  clinic:
    "클리닉/상담 관련 자동발송에 사용됩니다. 클리닉명·장소 블록을 사용할 수 있습니다.",
  payment:
    "결제 관련 자동발송에 사용됩니다. 기본 블록을 사용할 수 있습니다.",
  notice:
    "운영공지 자동발송에 사용됩니다. 기본 블록을 사용할 수 있습니다.",
  community:
    "커뮤니티(Q&A, 상담) 관련 자동발송에 사용됩니다. 기본 블록을 사용할 수 있습니다.",
  staff:
    "직원 관련 자동발송에 사용됩니다. 출결 요약·급여·정산 블록을 사용할 수 있습니다.",
};

export type ModalOpenState =
  | "create"
  | { template: MessageTemplateItem; mode: "view" | "edit" }
  | null;

export default function TemplateExplorer() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] =
    useState<MessageTemplateCategory>("default");
  const [modalOpen, setModalOpen] = useState<ModalOpenState>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "review";
    id: number;
  } | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, activeCategory],
    queryFn: () => fetchMessageTemplates(activeCategory),
    staleTime: 30 * 1000,
  });

  const createMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) =>
      createMessageTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setModalOpen(null);
      feedback.success("템플릿이 저장되었습니다.");
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<MessageTemplatePayload>;
    }) => updateMessageTemplate(id, payload),
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
      setConfirmAction(null);
      feedback.success("템플릿이 삭제되었습니다.");
    },
    onError: () => {
      setConfirmAction(null);
      feedback.error("삭제에 실패했습니다.");
    },
  });

  const submitReviewMut = useMutation({
    mutationFn: (id: number) => submitMessageTemplateReview(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setConfirmAction(null);
      feedback.success(data.detail || "검수 신청이 완료되었습니다.");
    },
    onError: (err: unknown) => {
      setConfirmAction(null);
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : null;
      feedback.error(msg || "검수 신청에 실패했습니다.");
    },
  });

  const provisionMut = useMutation({
    mutationFn: provisionDefaultTemplates,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      const parts: string[] = [];
      if (result.created_templates > 0) parts.push(`${result.created_templates}개 생성`);
      if (result.reset_templates > 0) parts.push(`${result.reset_templates}개 기본값 복원`);
      if (parts.length === 0) parts.push(`이미 모두 최신 상태입니다 (총 ${result.total_templates}개)`);
      feedback.success(parts.join(", "));
    },
    onError: () => {
      feedback.error("기본 템플릿 생성에 실패했습니다.");
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

  const isCreate = modalOpen === "create";
  const isEditOrView = modalOpen !== null && modalOpen !== "create";
  const editing = isEditOrView ? modalOpen.template : null;
  const modalCategory = editing ? editing.category : activeCategory;

  const renderTemplateCard = (t: MessageTemplateItem) => {
    const isConfirming = confirmAction?.id === t.id;
    const isDef = isDefaultTemplate(t);
    return (
      <div
        key={t.id}
        className={panelStyles.contentCard}
        style={{
          background: isDef
            ? "color-mix(in srgb, var(--color-status-info, #2563eb) 4%, var(--color-bg-surface))"
            : "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
          borderLeft: isDef
            ? "3px solid color-mix(in srgb, var(--color-status-info, #2563eb) 40%, transparent)"
            : undefined,
          transition: "background 0.15s, box-shadow 0.15s",
          cursor: "pointer",
        }}
        onClick={() =>
          !isConfirming &&
          setModalOpen({ template: t, mode: "edit" })
        }
      >
        {/* 카드 헤더 */}
        <div className={panelStyles.contentCardHeader}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: isDef
                  ? "color-mix(in srgb, var(--color-status-info, #2563eb) 12%, transparent)"
                  : "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDef
                  ? "var(--color-status-info, #2563eb)"
                  : "var(--color-primary)",
                flexShrink: 0,
              }}
            >
              {isDef ? <Shield size={16} aria-hidden /> : <FiMessageSquare size={16} aria-hidden />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    letterSpacing: "-0.1px",
                  }}
                >
                  {t.name}
                </span>
                {isDef && <DefaultBadge />}
                <SolapiStatusBadge status={t.solapi_status} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  marginTop: 2,
                  lineHeight: 1.45,
                }}
              >
                {TEMPLATE_CATEGORY_LABELS[t.category]} · {formatDate(t.updated_at)}
              </div>
            </div>
          </div>

          {/* 우측 액션 */}
          {!isConfirming && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}
            >
              <IconAction
                icon={<FiEdit2 size={14} />}
                label="수정"
                onClick={() =>
                  setModalOpen({ template: t, mode: "edit" })
                }
              />
              <IconAction
                icon={<FiCopy size={14} />}
                label="복제"
                onClick={() => handleDuplicate(t)}
                disabled={createMut.isPending}
              />
              {t.solapi_status !== "PENDING" &&
                t.solapi_status !== "APPROVED" && (
                  <IconAction
                    icon={<FiSend size={14} />}
                    label="검수 신청"
                    onClick={() =>
                      setConfirmAction({
                        type: "review",
                        id: t.id,
                      })
                    }
                  />
                )}
              {!t.is_system && (
                <IconAction
                  icon={<FiTrash2 size={14} />}
                  label="삭제"
                  onClick={() =>
                    setConfirmAction({ type: "delete", id: t.id })
                  }
                  danger
                />
              )}
            </div>
          )}

          {/* 인라인 확인 */}
          {isConfirming && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                animation: "fadeIn 0.15s ease",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                {confirmAction.type === "delete"
                  ? "정말 삭제할까요?"
                  : "검수 신청할까요?"}
              </span>
              <Button
                intent={
                  confirmAction.type === "delete"
                    ? "danger"
                    : "primary"
                }
                size="sm"
                onClick={() => {
                  if (confirmAction.type === "delete")
                    deleteMut.mutate(t.id);
                  else submitReviewMut.mutate(t.id);
                }}
                disabled={
                  deleteMut.isPending ||
                  submitReviewMut.isPending
                }
              >
                {deleteMut.isPending || submitReviewMut.isPending
                  ? "처리 중…"
                  : confirmAction.type === "delete"
                  ? "삭제"
                  : "신청"}
              </Button>
              <Button
                intent="secondary"
                size="sm"
                onClick={() => setConfirmAction(null)}
                disabled={
                  deleteMut.isPending ||
                  submitReviewMut.isPending
                }
              >
                취소
              </Button>
            </div>
          )}
        </div>

        {/* 본문 미리보기 — 컬러 배지로 변수 표시 */}
        {t.body && (
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
              lineHeight: 1.8,
              margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {renderPreviewBadges(t.body)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={panelStyles.root}>
      {/* 헤더 */}
      <div className={panelStyles.header}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 className={panelStyles.headerTitle}>템플릿 저장</h2>
            <p className={panelStyles.headerDesc}>
              알림톡·문자 발송 시 사용할 메시지 템플릿을 카테고리별로 관리합니다.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              intent="secondary"
              size="sm"
              onClick={() => provisionMut.mutate()}
              disabled={provisionMut.isPending}
              title="삭제·변경된 기본 템플릿을 일괄로 다시 채워 넣습니다"
            >
              {provisionMut.isPending ? "복원 중…" : "기본 세트 복원"}
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={() => setModalOpen("create")}
              leftIcon={<FilePlus size={14} />}
            >
              새 템플릿
            </Button>
          </div>
        </div>
      </div>

      {/* 본문: 좌측 트리 + 우측 카드 */}
      <div className={panelStyles.body}>
        <aside className={panelStyles.tree}>
          <TemplateCategoryTree
            currentCategory={activeCategory}
            onSelect={setActiveCategory}
          />
        </aside>

        <div className={panelStyles.content}>
          {isLoading ? (
            <div className={panelStyles.contentInner}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={panelStyles.skeletonCard} />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div style={{ padding: "var(--space-6)" }}>
              <EmptyState
                scope="panel"
                tone="empty"
                mode="embedded"
                title="저장된 템플릿이 없습니다"
                description={CATEGORY_DESCRIPTIONS[activeCategory]}
                actions={
                  <Button
                    intent="primary"
                    size="sm"
                    onClick={() => setModalOpen("create")}
                  >
                    + 새 템플릿 추가
                  </Button>
                }
              />
            </div>
          ) : (
            <div className={panelStyles.contentInner}>
              <p className={panelStyles.sectionTitle}>
                {TEMPLATE_CATEGORY_LABELS[activeCategory]} —{" "}
                {CATEGORY_DESCRIPTIONS[activeCategory]}
              </p>

              {templates.map(renderTemplateCard)}

              {/* + 새 템플릿 추가 버튼 */}
              <button
                type="button"
                onClick={() => setModalOpen("create")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 12,
                  border: "2px dashed var(--color-border-divider)",
                  background: "transparent",
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary)";
                  e.currentTarget.style.color = "var(--color-primary)";
                  e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 4%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border-divider)";
                  e.currentTarget.style.color = "var(--color-text-muted)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <FilePlus size={16} />
                새 템플릿 추가
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 템플릿 생성/수정 모달 */}
      <TemplateEditModal
        open={isCreate || isEditOrView}
        onClose={() => setModalOpen(null)}
        category={modalCategory}
        initial={editing ?? undefined}
        onSubmit={(payload) => {
          if (editing) {
            updateMut.mutate({ id: editing.id, payload });
          } else {
            createMut.mutate(payload);
          }
        }}
        isPending={createMut.isPending || updateMut.isPending}
        onDelete={(id) => {
          deleteMut.mutate(id, { onSuccess: () => setModalOpen(null) });
        }}
        isDeleting={deleteMut.isPending}
      />
    </div>
  );
}
