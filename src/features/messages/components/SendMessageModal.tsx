// PATH: src/features/messages/components/SendMessageModal.tsx
// 공용 메시지 발송 모달 — SMS 직접 작성 + 알림톡 템플릿 전용 UX
// 좌: 수신자 + 실시간 미리보기 / 우: 모드별 편집·선택
// 모든 진입점(학생·출결·성적·클리닉·직원)에서 동일 UX 제공. 단발성 발송 SSOT.

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "antd";
import { FiSearch, FiSave, FiChevronLeft, FiCheck, FiAlertCircle } from "react-icons/fi";
import { Shield } from "lucide-react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import {
  fetchMessageTemplates,
  sendMessage,
  createMessageTemplate,
  type MessageTemplateItem,
  type MessageMode,
  type SendToType,
} from "../api/messages.api";
import { useMessagingInfo } from "../hooks/useMessagingInfo";
import {
  TEMPLATE_CATEGORY_LABELS,
  getBlocksForCategory,
  getBlockColor,
  renderPreviewBadges,
  renderPreviewWithActualData,
  ALWAYS_AVAILABLE_VARS,
} from "../constants/templateBlocks";
import type { TemplateCategory } from "../constants/templateBlocks";
import "../styles/templateEditor.css";

// ─── Types ───

export type SendMessageModalProps = {
  open: boolean;
  onClose: () => void;
  initialStudentIds?: number[];
  initialStaffIds?: number[];
  recipientLabel?: string;
  blockCategory?: TemplateCategory;
  initialBody?: string;
  alimtalkExtraVars?: Record<string, string>;
};

type SendMode = "sms" | "alimtalk";

// ─── Constants ───

const RECENT_KEY = "sendModal_recentTpls";
const MAX_RECENT = 5;

// ─── Helpers ───

function getCharLabel(len: number) {
  if (len === 0) return null;
  if (len <= 90) return { label: `SMS ${len}/90자`, tone: "ok" as const };
  if (len <= 2000) return { label: `LMS ${len}/2,000자`, tone: "lms" as const };
  return { label: `${len}자 (초과)`, tone: "over" as const };
}

function isDefaultTpl(t: MessageTemplateItem): boolean {
  return t.name.startsWith("[학원플러스]");
}

function getRecentIds(): number[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}
function addRecentId(id: number) {
  const ids = getRecentIds().filter((x) => x !== id);
  ids.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

function extractVars(body: string): string[] {
  const matches = body.match(/#\{([^}]+)\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -1)))];
}

type VarStatus = { name: string; status: "auto" | "provided" | "missing"; value?: string };

function getVarStatuses(
  templateBody: string,
  extraVars?: Record<string, string>,
  freeContent?: string,
): VarStatus[] {
  return extractVars(templateBody).map((name) => {
    if (name === "내용") {
      return { name, status: freeContent?.trim() ? "provided" : "missing", value: freeContent?.trim() || undefined };
    }
    if (ALWAYS_AVAILABLE_VARS.has(name)) return { name, status: "auto" as const };
    if (extraVars && name in extraVars && extraVars[name]) {
      return { name, status: "provided" as const, value: extraVars[name] };
    }
    return { name, status: "missing" as const };
  });
}

// ─── Template Card (AlimTalk browser) ───

function TemplateCard({
  template: t,
  isSelected,
  onClick,
}: {
  template: MessageTemplateItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isDef = isDefaultTpl(t);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        padding: "10px 14px",
        borderRadius: 10,
        border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
        background: isSelected
          ? "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface))"
          : "var(--color-bg-surface)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-primary) 40%, var(--color-border-divider))";
          e.currentTarget.style.boxShadow = "0 2px 8px color-mix(in srgb, var(--color-primary) 8%, transparent)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--color-border-divider)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {isDef && <Shield size={12} style={{ color: "var(--color-status-info, #2563eb)", flexShrink: 0 }} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.name}
        </span>
        {t.solapi_status === "APPROVED" && (
          <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, color: "var(--color-success)", background: "color-mix(in srgb, var(--color-success) 10%, transparent)", flexShrink: 0 }}>
            승인
          </span>
        )}
      </div>
      {t.body && (
        <div style={{
          fontSize: 11,
          color: "var(--color-text-muted)",
          lineHeight: 1.5,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {renderPreviewBadges(t.body)}
        </div>
      )}
    </button>
  );
}

// ─── SMS Template Picker Dropdown ───

function TemplatePickerDropdown({
  templates,
  search,
  onSearchChange,
  onSelect,
  selectedId,
  disabled,
}: {
  templates: { recent: MessageTemplateItem[]; defaults: MessageTemplateItem[]; custom: MessageTemplateItem[] };
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (t: MessageTemplateItem) => void;
  selectedId: number | null;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const allEmpty = templates.recent.length === 0 && templates.defaults.length === 0 && templates.custom.length === 0;

  function renderSection(title: string, items: MessageTemplateItem[]) {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", padding: "6px 6px 2px", letterSpacing: "0.5px", textTransform: "uppercase" as const }}>{title}</div>
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { onSelect(t); setIsOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "7px 8px", borderRadius: 6, border: "none",
              background: selectedId === t.id ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "transparent",
              color: "var(--color-text-primary)", fontSize: 12, fontWeight: 500,
              cursor: "pointer", textAlign: "left" as const, transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              if (selectedId !== t.id) e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 6%, transparent)";
            }}
            onMouseLeave={(e) => {
              if (selectedId !== t.id) e.currentTarget.style.background = "transparent";
            }}
          >
            {isDefaultTpl(t) ? <Shield size={12} style={{ color: "var(--color-status-info, #2563eb)", flexShrink: 0 }} /> : <span style={{ width: 12, flexShrink: 0 }} />}
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
            {t.solapi_status === "APPROVED" && <span style={{ fontSize: 9, color: "var(--color-success)", fontWeight: 700 }}>승인</span>}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Button size="sm" intent={selectedId ? "primary" : "secondary"} onClick={() => setIsOpen(!isOpen)} disabled={disabled}>
        템플릿 {isOpen ? "▲" : "▼"}
      </Button>
      {isOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 4, width: 320,
          maxHeight: 360, overflowY: "auto", background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-divider)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10, padding: 8,
        }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <FiSearch size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
            <Input size="small" placeholder="검색…" value={search} onChange={(e) => onSearchChange(e.target.value)} style={{ paddingLeft: 28, fontSize: 12 }} autoFocus />
          </div>
          {renderSection("최근 사용", templates.recent)}
          {renderSection("기본 템플릿", templates.defaults)}
          {renderSection("내 템플릿", templates.custom)}
          {allEmpty && (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--color-text-muted)" }}>
              {search ? "검색 결과 없음" : "저장된 템플릿이 없습니다"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── Main Component ───
// ═══════════════════════════════════════════════════════════════

export default function SendMessageModal({
  open,
  onClose,
  initialStudentIds = [],
  initialStaffIds = [],
  recipientLabel,
  blockCategory = "default",
  initialBody,
  alimtalkExtraVars,
}: SendMessageModalProps) {
  const queryClient = useQueryClient();
  const { data: messagingInfo } = useMessagingInfo();
  const smsAllowed = messagingInfo?.sms_allowed ?? false;

  // ─── State ───
  const [sendMode, setSendMode] = useState<SendMode>("sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [freeContent, setFreeContent] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [sendToParent, setSendToParent] = useState(true);
  const [sendToStudent, setSendToStudent] = useState(true);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [templates, setTemplates] = useState<MessageTemplateItem[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  const getNativeTextarea = useCallback(
    () => bodyWrapRef.current?.querySelector("textarea") ?? null, [],
  );

  // ─── Derived ───
  const isStaffMode = (initialStaffIds?.length ?? 0) > 0;
  const studentIds = initialStudentIds;
  const staffIds = initialStaffIds ?? [];
  const hasRecipients = isStaffMode ? staffIds.length > 0 : studentIds.length > 0;
  const recipientCount = isStaffMode ? staffIds.length : studentIds.length;
  const sendToTargets: SendToType[] = isStaffMode
    ? ["staff"]
    : (() => {
        const t: SendToType[] = [];
        if (sendToParent) t.push("parent");
        if (sendToStudent) t.push("student");
        return t;
      })();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const approvedTemplates = useMemo(() => templates.filter((t) => t.solapi_status === "APPROVED"), [templates]);
  const recentIds = useMemo(() => getRecentIds(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Categorize templates for picker/browser
  const categorizedTemplates = useMemo(() => {
    const list = sendMode === "alimtalk" ? approvedTemplates : templates;
    const search = templateSearch.toLowerCase().trim();
    const filtered = search
      ? list.filter((t) => t.name.toLowerCase().includes(search) || t.body.toLowerCase().includes(search))
      : list;
    const recent: MessageTemplateItem[] = [];
    const defaults: MessageTemplateItem[] = [];
    const custom: MessageTemplateItem[] = [];
    const recentSet = new Set(recentIds);
    for (const t of filtered) {
      if (recentSet.has(t.id)) recent.push(t);
      else if (isDefaultTpl(t)) defaults.push(t);
      else custom.push(t);
    }
    recent.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
    return { recent, defaults, custom };
  }, [templates, approvedTemplates, sendMode, templateSearch, recentIds]);

  // Variable statuses for AlimTalk
  const varStatuses = useMemo(() => {
    if (!selectedTemplate) return [];
    return getVarStatuses(selectedTemplate.body, alimtalkExtraVars, freeContent);
  }, [selectedTemplate, alimtalkExtraVars, freeContent]);

  const hasMissingVars = varStatuses.some((v) => v.status === "missing");
  const templateHasContentVar = selectedTemplate?.has_content_var ?? (selectedTemplate?.body?.includes("#{내용}") ?? false);

  // ─── Can Send ───
  const messageModes: MessageMode[] = useMemo(() => {
    if (sendMode === "sms" && smsAllowed) return ["sms"];
    if (sendMode === "alimtalk") return ["alimtalk"];
    return [];
  }, [sendMode, smsAllowed]);

  const canSend = (() => {
    if (!hasRecipients || sendToTargets.length === 0 || messageModes.length === 0 || sending) return false;
    if (sendMode === "sms") return body.trim().length > 0;
    if (sendMode === "alimtalk") {
      if (!selectedTemplate || selectedTemplate.solapi_status !== "APPROVED") return false;
      if (templateHasContentVar && !freeContent.trim()) return false;
      return true;
    }
    return false;
  })();

  // ─── Blocks (SMS only) ───
  const blocks = useMemo(() => getBlocksForCategory(blockCategory), [blockCategory]);

  // ─── Preview ───
  const previewBody = sendMode === "alimtalk" && selectedTemplate
    ? renderPreviewWithActualData(selectedTemplate.body, alimtalkExtraVars, freeContent)
    : renderPreviewBadges(body);
  const previewSubject = sendMode === "alimtalk" && selectedTemplate
    ? renderPreviewWithActualData(selectedTemplate.subject || "", alimtalkExtraVars)
    : renderPreviewBadges(subject);

  // ─── Reset on open ───
  useEffect(() => {
    if (open) {
      setSubject("");
      setBody(initialBody ?? "");
      setFreeContent("");
      setSelectedTemplateId(null);
      setSendToParent(true);
      setSendToStudent(true);
      setSendMode(smsAllowed ? "sms" : "alimtalk");
      setTemplateSearch("");
      setShowSaveForm(false);
      setSaveTemplateName("");
      sendingRef.current = false;
    }
  }, [open, initialBody]);

  // smsAllowed 비동기 로딩 대응 — 양방향 보정
  useEffect(() => {
    if (!open) return;
    if (!smsAllowed && sendMode === "sms") setSendMode("alimtalk");
    if (smsAllowed && sendMode === "alimtalk" && !selectedTemplateId) setSendMode("sms");
  }, [open, smsAllowed, sendMode, selectedTemplateId]);

  // Load templates
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchMessageTemplates().then((list) => { if (!cancelled) setTemplates(list); }).catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [open]);

  // ─── Actions ───
  const insertBlock = useCallback((insertText: string) => {
    const ta = getNativeTextarea();
    if (!ta) { setBody((prev) => prev + insertText); return; }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    setBody((prev) => prev.slice(0, start) + insertText + prev.slice(end));
    const newPos = start + insertText.length;
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(newPos, newPos); });
  }, [getNativeTextarea]);

  const selectTemplate = useCallback((t: MessageTemplateItem) => {
    setSelectedTemplateId(t.id);
    setSubject(t.subject ?? "");
    setBody(t.body ?? "");
    setFreeContent("");
    addRecentId(t.id);
  }, []);

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim() || savingTemplate) return;
    setSavingTemplate(true);
    try {
      const created = await createMessageTemplate({
        category: (blockCategory === "default" ? "default" : blockCategory) as Parameters<typeof createMessageTemplate>[0]["category"],
        name: saveTemplateName.trim(),
        subject: subject || "",
        body,
      });
      setTemplates((prev) => [...prev, created]);
      feedback.success("템플릿이 저장되었습니다.");
      setShowSaveForm(false);
      setSaveTemplateName("");
    } catch {
      feedback.error("템플릿 저장에 실패했습니다.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSend = async () => {
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const modeLabel = sendMode === "sms" ? "문자" : "알림톡";
    const taskId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    asyncStatusStore.addWorkerJob(`${modeLabel} 발송`, taskId, "messaging");
    try {
      let totalEnqueued = 0;
      let totalSkipped = 0;
      let completedCalls = 0;
      const totalCalls = isStaffMode ? messageModes.length : sendToTargets.length * messageModes.length;

      const buildPayload = (sendTo: SendToType, messageMode: MessageMode) => {
        const payload: Parameters<typeof sendMessage>[0] = { send_to: sendTo, message_mode: messageMode };
        if (isStaffMode) payload.staff_ids = staffIds; else payload.student_ids = studentIds;
        if (sendMode === "alimtalk") {
          if (selectedTemplateId) payload.template_id = selectedTemplateId;
          payload.raw_body = templateHasContentVar && freeContent.trim() ? freeContent.trim() : body.trim();
          if (subject.trim()) payload.raw_subject = subject.trim();
          if (alimtalkExtraVars) payload.alimtalk_extra_vars = alimtalkExtraVars;
        } else {
          payload.raw_body = body.trim();
          if (subject.trim()) payload.raw_subject = subject.trim();
          if (selectedTemplateId) payload.template_id = selectedTemplateId;
        }
        return payload;
      };

      const targets = isStaffMode ? ["staff" as SendToType] : sendToTargets;
      for (const sendTo of targets) {
        for (const messageMode of messageModes) {
          const res = await sendMessage(buildPayload(sendTo, messageMode));
          totalEnqueued += res.enqueued ?? 0;
          totalSkipped += res.skipped_no_phone ?? 0;
          completedCalls++;
          asyncStatusStore.updateProgress(taskId, Math.round((completedCalls / totalCalls) * 90));
        }
      }

      const sendToLabel = isStaffMode ? "직원" : sendToTargets.length === 2 ? "학부모·학생" : sendToTargets[0] === "parent" ? "학부모" : "학생";
      feedback.success(`${sendToLabel} ${modeLabel} 발송 예정 ${totalEnqueued}건입니다.`);
      if (totalSkipped > 0) feedback.info(`전화번호 없음으로 ${totalSkipped}건 제외되었습니다.`);
      asyncStatusStore.completeTask(taskId, "success");
      queryClient.invalidateQueries({ queryKey: ["messaging", "info"] });
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail : null;
      const errMsg = (msg && typeof msg === "string" ? msg : "발송 요청에 실패했습니다.") as string;
      asyncStatusStore.completeTask(taskId, "error", errMsg);
      feedback.error(errMsg);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (!open) return null;

  // ─── Labels ───
  const label = recipientLabel ?? (isStaffMode
    ? (hasRecipients ? `선택한 직원 ${staffIds.length}명` : "수신자 없음")
    : (hasRecipients ? `선택한 학생 ${studentIds.length}명` : "수신자 없음"));
  const domainLabel = TEMPLATE_CATEGORY_LABELS[blockCategory] ?? "사용자";
  const charInfo = sendMode === "sms" ? getCharLabel(body.length) : null;

  // Footer text
  const sendButtonText = (() => {
    if (sending) return "발송 중…";
    const modeText = sendMode === "sms" ? "문자" : "알림톡";
    if (isStaffMode) return `직원 ${staffIds.length}명에게 ${modeText} 발송`;
    const parts: string[] = [];
    if (sendToParent) parts.push(`학부모 ${recipientCount}명`);
    if (sendToStudent) parts.push(`학생 ${recipientCount}명`);
    if (parts.length === 0) return "대상 선택 필요";
    return `${parts.join(" + ")}에게 ${modeText} 발송`;
  })();

  const disableReason = (() => {
    if (!hasRecipients) return "수신자를 선택해 주세요";
    if (sendToTargets.length === 0) return "발송 대상을 선택해 주세요";
    if (sendMode === "sms" && !body.trim()) return "본문을 입력해 주세요";
    if (sendMode === "alimtalk" && !selectedTemplate) return "템플릿을 선택해 주세요";
    if (sendMode === "alimtalk" && selectedTemplate?.solapi_status !== "APPROVED") return "승인된 템플릿만 발송 가능합니다";
    if (sendMode === "alimtalk" && templateHasContentVar && !freeContent.trim()) return "자유 내용을 입력해 주세요";
    return null;
  })();

  // AlimTalk template section renderer
  function renderAlimtalkSection(title: string, items: MessageTemplateItem[]) {
    if (items.length === 0) return null;
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", padding: "8px 0 4px", letterSpacing: "0.5px" }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((t) => (
            <TemplateCard key={t.id} template={t} isSelected={selectedTemplateId === t.id} onClick={() => selectTemplate(t)} />
          ))}
        </div>
      </div>
    );
  }

  // ─── Render ───
  return (
    <AdminModal open={open} onClose={onClose} width={920} onEnterConfirm={handleSend} className="send-message-modal">
      <ModalHeader title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>메시지 발송</span>
          <span style={{
            display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20,
            fontSize: 11, fontWeight: 700,
            background: "color-mix(in srgb, var(--color-primary) 12%, transparent)", color: "var(--color-primary)",
          }}>
            {domainLabel}
          </span>
        </div>
      } />

      <ModalBody>
        <div className="flex gap-5" style={{ minHeight: 500 }}>

          {/* ═══ 좌측: 수신자 + 미리보기 + 변수 상태 ═══ */}
          <div className="shrink-0 flex flex-col gap-3" style={{ width: 260 }}>
            {/* 수신자 카드 */}
            <div style={{
              padding: "12px 16px", borderRadius: "var(--radius-md)",
              background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface))",
              border: "1px solid var(--color-border-divider)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4 }}>수신자</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }}>{label}</div>
              {!hasRecipients && (
                <div style={{ fontSize: 11, color: "var(--color-status-warning, #d97706)", marginTop: 4 }}>수신자를 선택한 뒤 발송해 주세요.</div>
              )}
            </div>

            {/* 미리보기 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.5px" }}>미리보기</div>
            {sendMode === "sms" ? (
              <div className="template-preview-phone">
                <div className="template-preview-phone__screen">
                  <div className="template-preview-phone__bubble">
                    {body ? previewBody : <span className="template-editor__preview-placeholder">본문을 입력하세요</span>}
                  </div>
                  <div className="template-preview-phone__time">오후 2:30</div>
                </div>
              </div>
            ) : (
              <div className="template-preview-kakao">
                <div className="template-preview-kakao__card">
                  {(selectedTemplate?.subject || subject) && (
                    <div className="template-preview-kakao__title">{previewSubject}</div>
                  )}
                  <div className="template-preview-kakao__body">
                    {selectedTemplate ? previewBody : <span style={{ color: "#999" }}>템플릿을 선택하세요</span>}
                  </div>
                </div>
              </div>
            )}
            <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
              {sendMode === "sms" ? "SMS 미리보기" : "카카오 알림톡 미리보기"}
            </div>

            {/* 변수 상태 (AlimTalk with selected template) */}
            {sendMode === "alimtalk" && selectedTemplate && varStatuses.length > 0 && (
              <div style={{
                padding: "10px 12px", borderRadius: "var(--radius-md)",
                background: "var(--color-bg-surface)", border: "1px solid var(--color-border-divider)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 6 }}>변수 상태</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {varStatuses.map((v) => (
                    <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                      {v.status === "missing"
                        ? <FiAlertCircle size={12} style={{ color: "#d97706", flexShrink: 0 }} />
                        : <FiCheck size={12} style={{ color: "var(--color-success)", flexShrink: 0 }} />}
                      <span style={{ fontWeight: 600, color: v.status === "missing" ? "#d97706" : "var(--color-text-secondary)" }}>{v.name}</span>
                      <span style={{ color: "var(--color-text-muted)", fontSize: 10, flex: 1, textAlign: "right" as const }}>
                        {v.status === "auto" ? "자동" : v.status === "provided" ? (v.value ? `"${v.value}"` : "제공됨") : "미제공"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══ 우측: 편집/선택 ═══ */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* 상단 바: 채널 + 대상 + 글자수 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 16, padding: "8px 14px",
              background: "var(--color-bg-surface-soft)", borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-divider)",
            }}>
              {/* 채널 탭 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>채널</span>
                <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-border-divider)" }}>
                  {([
                    { key: "sms" as SendMode, label: "SMS", disabled: !smsAllowed },
                    { key: "alimtalk" as SendMode, label: "알림톡", disabled: false },
                  ]).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => !opt.disabled && setSendMode(opt.key)}
                      disabled={sending || opt.disabled}
                      style={{
                        padding: "6px 16px", fontSize: 13, fontWeight: 700, border: "none",
                        cursor: opt.disabled ? "not-allowed" : "pointer",
                        color: sendMode === opt.key ? "#fff" : opt.disabled ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                        background: sendMode === opt.key ? "var(--color-primary)" : "var(--color-bg-surface)",
                        opacity: opt.disabled ? 0.45 : 1, transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {!smsAllowed && <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>SMS 미설정</span>}
              </div>

              <div style={{ width: 1, height: 24, background: "var(--color-border-divider)" }} />

              {/* 대상 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>대상</span>
                {isStaffMode ? (
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>직원</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                      <input type="checkbox" checked={sendToParent} onChange={(e) => setSendToParent(e.target.checked)} disabled={sending} style={{ accentColor: "var(--color-primary)" }} />
                      학부모
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                      <input type="checkbox" checked={sendToStudent} onChange={(e) => setSendToStudent(e.target.checked)} disabled={sending} style={{ accentColor: "var(--color-primary)" }} />
                      학생
                    </label>
                    {sendToTargets.length === 0 && <span style={{ fontSize: 11, color: "var(--color-error)", fontWeight: 600 }}>선택 필요</span>}
                  </div>
                )}
              </div>

              {/* 글자수 (SMS) */}
              {charInfo && (
                <>
                  <div style={{ flex: 1 }} />
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                    background: charInfo.tone === "ok" ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
                      : charInfo.tone === "lms" ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                      : "color-mix(in srgb, var(--color-error) 10%, transparent)",
                    color: charInfo.tone === "ok" ? "var(--color-success)" : charInfo.tone === "lms" ? "var(--color-primary)" : "var(--color-error)",
                  }}>
                    {charInfo.label}
                  </span>
                </>
              )}
            </div>

            {/* ══════ SMS 모드 ══════ */}
            {sendMode === "sms" && (
              <>
                {/* 템플릿 바 */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <TemplatePickerDropdown
                    templates={categorizedTemplates}
                    search={templateSearch}
                    onSearchChange={setTemplateSearch}
                    onSelect={(t) => { selectTemplate(t); setTemplateSearch(""); }}
                    selectedId={selectedTemplateId}
                    disabled={sending}
                  />
                  {selectedTemplate && (
                    <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedTemplate.name}
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {!showSaveForm && body.trim() && (
                    <Button
                      size="sm"
                      intent="secondary"
                      leftIcon={<FiSave size={13} />}
                      onClick={() => {
                        setShowSaveForm(true);
                        setSaveTemplateName(selectedTemplate ? `복사 - ${selectedTemplate.name}` : "");
                      }}
                      disabled={sending}
                    >
                      템플릿 저장
                    </Button>
                  )}
                </div>

                {/* 저장 폼 */}
                {showSaveForm && (
                  <div style={{
                    display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: "var(--radius-md)",
                    background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
                    border: "1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border-divider))",
                  }}>
                    <Input size="small" placeholder="템플릿 이름" value={saveTemplateName}
                      onChange={(e) => setSaveTemplateName(e.target.value)} onPressEnter={handleSaveTemplate}
                      style={{ flex: 1, fontSize: 13 }} autoFocus />
                    <Button size="sm" intent="primary" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim() || savingTemplate}>
                      {savingTemplate ? "저장 중…" : "저장"}
                    </Button>
                    <Button size="sm" intent="secondary" onClick={() => setShowSaveForm(false)}>취소</Button>
                  </div>
                )}

                {/* 본문 */}
                <div ref={bodyWrapRef} className="flex-1 min-h-0 flex flex-col">
                  <Input.TextArea
                    placeholder="내용을 입력하세요"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={sending}
                    className="message-domain-input"
                    style={{ resize: "vertical", fontFamily: "inherit", minHeight: 200, flex: 1, fontSize: 14, lineHeight: 1.7, padding: 12 }}
                  />
                </div>

                {/* 변수 블록 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 6 }}>치환 변수 삽입</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {blocks.map((block) => {
                      const bc = getBlockColor(block.id);
                      return (
                        <button key={block.id} type="button" onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertBlock(block.insertText)} disabled={sending}
                          className="template-editor__block-tag"
                          style={{ background: bc.bg, color: bc.color, borderColor: bc.border, padding: "4px 10px", fontSize: 11 }}>
                          {block.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ══════ 알림톡 모드 — 컴팩트 접이식 ══════ */}
            {sendMode === "alimtalk" && (
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  알림톡은 승인된 템플릿으로만 발송합니다. 템플릿을 선택하면 미리보기가 좌측에 표시됩니다.
                </div>

                {approvedTemplates.length === 0 ? (
                  <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--color-text-muted)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>승인된 템플릿이 없습니다</div>
                    <div style={{ fontSize: 12 }}>메시지 &gt; 템플릿 관리에서 생성 후 검수 신청해 주세요.</div>
                  </div>
                ) : (
                  <>
                    {/* 템플릿 드롭다운 선택 */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        value={selectedTemplateId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value ? Number(e.target.value) : null;
                          if (id) {
                            const t = approvedTemplates.find((x) => x.id === id);
                            if (t) selectTemplate(t);
                          } else {
                            setSelectedTemplateId(null);
                          }
                        }}
                        disabled={sending}
                        style={{
                          flex: 1, maxWidth: 400, padding: "8px 12px", fontSize: 13, fontWeight: 600,
                          borderRadius: 8, border: "1px solid var(--color-border-divider)",
                          background: "var(--color-bg-surface)", color: "var(--color-text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">— 템플릿 선택 —</option>
                        {approvedTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {selectedTemplate && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-success)", display: "flex", alignItems: "center", gap: 3 }}>
                          <FiCheck size={12} /> 선택됨
                        </span>
                      )}
                    </div>

                    {/* 선택된 템플릿 readOnly 미리보기 (접이식) */}
                    {selectedTemplate && (
                      <div style={{
                        padding: "12px 16px", borderRadius: 8,
                        background: "var(--color-bg-surface-soft)", border: "1px solid var(--color-border-divider)",
                        fontSize: 12, lineHeight: 1.7, color: "var(--color-text-secondary)",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                        maxHeight: 200, overflowY: "auto",
                      }}>
                        {renderPreviewBadges(selectedTemplate.body)}
                      </div>
                    )}

                    {/* 자유 내용 (#{내용} 포함 시) */}
                    {selectedTemplate && templateHasContentVar && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4 }}>
                          자유 내용 입력 <span style={{ fontWeight: 400 }}>— 템플릿의 {"#{내용}"} 위치에 삽입</span>
                        </div>
                        <Input.TextArea
                          placeholder="전달할 내용을 입력하세요"
                          value={freeContent}
                          onChange={(e) => setFreeContent(e.target.value)}
                          disabled={sending}
                          style={{ minHeight: 60, fontSize: 13, lineHeight: 1.6, padding: 10 }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {disableReason && !sending && (
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginRight: 4, maxWidth: 200, textAlign: "right" as const }}>
                {disableReason}
              </span>
            )}
            <Button intent="secondary" onClick={onClose} disabled={sending}>취소</Button>
            <Button
              intent="primary"
              onClick={handleSend}
              disabled={!canSend || sending}
              style={{ minWidth: 160, fontSize: 14, padding: "8px 24px" }}
            >
              {sendButtonText}
            </Button>
          </div>
        }
      />
    </AdminModal>
  );
}
