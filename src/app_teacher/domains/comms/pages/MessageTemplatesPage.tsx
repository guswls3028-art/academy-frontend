/* eslint-disable no-restricted-syntax, @typescript-eslint/no-unused-vars */
// PATH: src/app_teacher/domains/comms/pages/MessageTemplatesPage.tsx
// 메시지 템플릿 관리 + 메시지 설정 + 잔액 확인
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Plus, Pencil, Trash2, Settings } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { fetchAllTemplates, createTemplate, updateTemplate, deleteTemplate, fetchMessagingInfo, type MsgTemplate } from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";

export default function MessageTemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editSheet, setEditSheet] = useState<{ open: boolean; template?: MsgTemplate }>({ open: false });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["teacher-msg-templates"],
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

  const { data: info } = useQuery({
    queryKey: ["teacher-messaging-info"],
    queryFn: fetchMessagingInfo,
  });

  const deleteMut = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-msg-templates"] }); teacherToast.info("템플릿이 삭제되었습니다."); },
    onError: (e) => teacherToast.error(extractApiError(e, "템플릿을 삭제하지 못했습니다.")),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>메시지 템플릿</h1>
        <button onClick={() => setEditSheet({ open: true })}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 새 템플릿
        </button>
      </div>

      {/* Messaging info card */}
      {info && (
        <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>메시지 설정</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                {info.messaging_provider || "미설정"} · 발신: {info.messaging_sender || "미등록"}
              </div>
            </div>
            <div className="text-right">
              <Badge tone={info.sms_allowed ? "success" : "danger"} size="xs">
                {info.sms_allowed ? "활성" : "비활성"}
              </Badge>
              {info.balance != null && (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                  잔액: {info.balance.toLocaleString()}원
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Template list */}
      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : sortedTemplates.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sortedTemplates.map((t) => (
            <Card key={t.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{t.name}</span>
                    <Badge tone="neutral" size="xs">{t.category}</Badge>
                    {t.is_system && <Badge tone="primary" size="xs">시스템</Badge>}
                    {t.is_default && <Badge tone="success" size="xs">기본</Badge>}
                    {duplicateNameSet.has((t.name || "").trim()) && (
                      <Badge tone="warning" size="xs">이름 중복</Badge>
                    )}
                  </div>
                  <div className="text-[12px] mt-1 line-clamp-2" style={{ color: "var(--tc-text-muted)" }}>
                    {t.body}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!t.is_system && (
                    <>
                      <button onClick={() => setEditSheet({ open: true, template: t })}
                        className="flex p-1.5 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={async () => {
                          const ok = await confirm({ title: "템플릿 삭제", message: "이 템플릿을 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                          if (ok) deleteMut.mutate(t.id);
                        }}
                        className="flex p-1.5 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)" }}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="등록된 템플릿이 없습니다" />
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
      qc.invalidateQueries({ queryKey: ["teacher-msg-templates"] });
      teacherToast.success(isEdit ? "템플릿이 수정되었습니다." : "템플릿이 생성되었습니다.");
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, isEdit ? "템플릿을 수정하지 못했습니다." : "템플릿을 생성하지 못했습니다.")),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? "템플릿 편집" : "새 템플릿"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>이름 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="템플릿 이름"
            className="w-full text-sm" style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>카테고리</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm" style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }}>
            {["default", "signup", "attendance", "exam", "assignment", "grades", "clinic", "notice", "community"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>본문 *</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="메시지 내용 (#{학생명} 등 변수 사용 가능)"
            className="w-full text-sm" style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none", resize: "vertical" }} />
        </div>
        <button onClick={() => mutation.mutate()} disabled={!name.trim() || !body.trim() || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: name.trim() && body.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: name.trim() && body.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "생성"}
        </button>
      </div>
    </BottomSheet>
  );
}
