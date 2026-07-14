/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/comms/pages/MessageTemplatesPage.tsx
// 알림톡에 담을 사용자 문구 관리. 카카오 승인 봉투와 저장 문구를 구분해 표시한다.
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { ChevronLeft, Plus, Pencil, Trash2, Eye, MessageCircle } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { fetchAllTemplates, createTemplate, updateTemplate, deleteTemplate, type MsgTemplate } from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import { teacherCommsQueryKeys } from "../queryKeys";

const CATEGORY_LABELS: Record<string, string> = {
  default: "일반 안내",
  signup: "가입 안내",
  attendance: "출결",
  lecture: "수업",
  exam: "시험",
  assignment: "과제",
  grades: "성적",
  clinic: "클리닉",
  payment: "결제",
  notice: "공지",
  community: "커뮤니티",
  staff: "직원",
};

function ReadinessBadge({ template }: { template: MsgTemplate }) {
  if (template.alimtalk_readiness === "ready") return <Badge tone="success" size="xs">알림톡 준비됨</Badge>;
  if (template.alimtalk_readiness === "provider_template_missing") return <Badge tone="warning" size="xs">발송 준비 필요</Badge>;
  if (template.alimtalk_readiness === "envelope_selection_required") return <Badge tone="neutral" size="xs">발송 시 유형 선택</Badge>;
  return null;
}

export default function MessageTemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editSheet, setEditSheet] = useState<{ open: boolean; template?: MsgTemplate }>({ open: false });

  const { data: templates, isLoading, isError, refetch } = useQuery({
    queryKey: teacherCommsQueryKeys.templates,
    queryFn: fetchAllTemplates,
  });

  // 시스템 템플릿 우선 → 카테고리 → 이름 가나다순. 운영 화면에서 시스템 템플릿이 먼저 보이도록.
  const sortedTemplates = useMemo(() => {
    if (!templates) return [];
    return [...templates].sort((a, b) => {
      if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
      if (a.category !== b.category) return (a.category || "").localeCompare(b.category || "");
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [templates]);

  // 같은 이름 중복 — 사용자 템플릿만 검사. 시스템은 제외(다른 카테고리로 같은 이름일 수 있음).
  const duplicateNameSet = useMemo(() => {
    const seen = new Map<string, number>();
    (templates ?? []).forEach((t) => {
      if (t.is_system) return;
      const key = (t.name || "").trim();
      if (!key) return;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    return new Set(Array.from(seen.entries()).filter(([, c]) => c > 1).map(([k]) => k));
  }, [templates]);

  const deleteMut = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: teacherCommsQueryKeys.templates }); teacherToast.info("템플릿이 삭제되었습니다."); },
    onError: (e) => teacherToast.error(extractApiError(e, "템플릿을 삭제하지 못했습니다.")),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} aria-label="뒤로가기" className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>알림톡 문구</h1>
        <button onClick={() => setEditSheet({ open: true })}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={ICON.xs} /> 새 문구
        </button>
      </div>

      <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
        <div className="flex items-start gap-2">
          <MessageCircle size={ICON.sm} style={{ color: "var(--tc-primary)", flexShrink: 0 }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>승인 양식은 자동으로 연결됩니다</div>
            <div className="text-[11px] mt-0.5 leading-5" style={{ color: "var(--tc-text-muted)" }}>
              여기서는 자주 쓰는 안내문만 저장하세요. 발송할 때 선택한 유형에 맞는 카카오 승인 알림톡으로 전송됩니다.
            </div>
          </div>
        </div>
      </Card>

      {/* Template list */}
      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="문구를 불러오지 못했습니다"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          actions={<EmptyActionButton onClick={() => void refetch()}>다시 시도</EmptyActionButton>}
        />
      ) : sortedTemplates.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sortedTemplates.map((t) => (
            <Card key={t.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{t.name}</span>
                    <Badge tone="neutral" size="xs">{CATEGORY_LABELS[t.category] ?? t.category}</Badge>
                    {t.is_system && <Badge tone="primary" size="xs">시스템</Badge>}
                    {(t.is_default || t.is_user_default) && <Badge tone="success" size="xs">기본</Badge>}
                    <ReadinessBadge template={t} />
                    {duplicateNameSet.has((t.name || "").trim()) && (
                      <Badge tone="warning" size="xs">이름 중복</Badge>
                    )}
                  </div>
                  <div className="text-[12px] mt-1 line-clamp-2" style={{ color: "var(--tc-text-muted)" }}>
                    {t.body}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {t.is_system ? (
                    <button onClick={() => setEditSheet({ open: true, template: t })}
                      aria-label={`${t.name} 보기`}
                      className="flex p-1.5 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
                      <Eye size={ICON.xs} />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setEditSheet({ open: true, template: t })}
                        aria-label={`${t.name} 편집`}
                        className="flex p-1.5 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
                        <Pencil size={ICON.xs} />
                      </button>
                      <button onClick={async () => {
                          const ok = await confirm({ title: "템플릿 삭제", message: "이 템플릿을 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                          if (ok) deleteMut.mutate(t.id);
                        }} aria-label={`${t.name} 삭제`}
                        className="flex p-1.5 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)" }}>
                        <Trash2 size={ICON.xs} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title="저장된 문구가 없습니다"
          description="자주 보내는 안내 문구를 저장하면 학생 선택 발송에서 바로 재사용할 수 있습니다."
          actions={
            <EmptyActionButton onClick={() => setEditSheet({ open: true })}>
              새 문구 만들기
            </EmptyActionButton>
          }
        />
      )}

      {/* Create/Edit sheet */}
      <TemplateEditSheet
        open={editSheet.open}
        onClose={() => setEditSheet({ open: false })}
        template={editSheet.template}
      />
    </div>
  );
}

function TemplateEditSheet({ open, onClose, template }: { open: boolean; onClose: () => void; template?: MsgTemplate }) {
  const qc = useQueryClient();
  const isEdit = !!template;
  const readOnly = Boolean(template?.is_system);
  const [name, setName] = useState(template?.name || "");
  const [category, setCategory] = useState(template?.category || "default");
  const [body, setBody] = useState(template?.body || "");

  // Reset when template changes
  useEffect(() => {
    if (open) {
      setName(template?.name || "");
      setCategory(template?.category || "default");
      setBody(template?.body || "");
    }
  }, [open, template]);

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? updateTemplate(template!.id, { name, category, body })
      : createTemplate({ name, category, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherCommsQueryKeys.templates });
      teacherToast.success(isEdit ? "템플릿이 수정되었습니다." : "템플릿이 생성되었습니다.");
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, isEdit ? "템플릿을 수정하지 못했습니다." : "템플릿을 생성하지 못했습니다.")),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={readOnly ? "시스템 문구 보기" : isEdit ? "문구 편집" : "새 문구"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <div>
          <label htmlFor="message-template-name" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>이름 *</label>
          <input id="message-template-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="문구 이름" disabled={readOnly}
            className="w-full text-sm" style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
        </div>
        <div>
          <label htmlFor="message-template-category" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>카테고리</label>
          <select id="message-template-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={readOnly}
            className="w-full text-sm" style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }}>
            {["default", "signup", "attendance", "lecture", "exam", "assignment", "grades", "clinic", "payment", "notice", "community", "staff"].map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="message-template-body" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>본문 *</label>
          <textarea id="message-template-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} placeholder="알림톡 안내문 (예: #{학생이름})" disabled={readOnly}
            className="w-full text-sm" style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none", resize: "vertical" }} />
        </div>
        {!readOnly && <button onClick={() => mutation.mutate()} disabled={!name.trim() || !body.trim() || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: name.trim() && body.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: name.trim() && body.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "저장"}
        </button>}
      </div>
    </BottomSheet>
  );
}
