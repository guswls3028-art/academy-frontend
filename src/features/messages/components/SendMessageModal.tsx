// PATH: src/features/messages/components/SendMessageModal.tsx
// 공용 메시지 발송 모달 — SMS 직접 작성 + 알림톡 템플릿 전용 UX
// 좌: 수신자 + 실시간 미리보기 / 우: 모드별 편집·선택
// 모든 진입점(학생·출결·성적·클리닉·직원)에서 동일 UX 제공. 단발성 발송 SSOT.

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "antd";
import { FiSearch, FiSave, FiChevronLeft, FiCheck, FiAlertCircle, FiAlertTriangle, FiCopy, FiTrash2, FiStar, FiEdit3 } from "react-icons/fi";
import { Shield } from "lucide-react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import {
  fetchMessageTemplates,
  sendMessage,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  setTemplateDefault,
  duplicateMessageTemplate,
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
import GradesBlockPanel from "./GradesBlockPanel";
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
  /** 학생별 개별 치환 변수 — key: student_id (대량 성적 발송 등) */
  alimtalkExtraVarsPerStudent?: Record<number, Record<string, string>>;
};

type SendMode = "sms" | "alimtalk";

// ─── Constants ───

const RECENT_KEY = "sendModal_recentTpls";
const MAX_RECENT = 5;
const SMS_MAX_CHARS = 2000;

// ─── Helpers ───

function getCharLabel(len: number) {
  if (len === 0) return null;
  if (len <= 90) return { label: `SMS ${len}/90자`, tone: "ok" as const };
  if (len <= SMS_MAX_CHARS) return { label: `LMS ${len}/2,000자`, tone: "lms" as const };
  return { label: `${len}/2,000자 초과`, tone: "over" as const };
}

function isSystemTpl(t: MessageTemplateItem): boolean {
  return t.is_system || t.name.startsWith("[HakwonPlus]") || t.name.startsWith("[학원플러스]");
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
  const isDef = isSystemTpl(t);
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
            {isSystemTpl(t) ? <Shield size={12} style={{ color: "var(--color-status-info, #2563eb)", flexShrink: 0 }} /> : <span style={{ width: 12, flexShrink: 0 }} />}
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

// ─── Template Picker Card (SMS 양식 관리 패널) ───

function TemplatePickerCard({
  template: t,
  isSelected,
  onSelect,
  onSetDefault,
  onDuplicate,
  onDelete,
}: {
  template: MessageTemplateItem;
  isSelected: boolean;
  onSelect: () => void;
  onSetDefault: (() => void) | null;
  onDuplicate: (() => void) | null;
  onDelete: (() => void) | null;
}) {
  const isSys = isSystemTpl(t);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 8, width: "100%",
        padding: "8px 10px", borderRadius: 8,
        border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
        background: isSelected
          ? "color-mix(in srgb, var(--color-primary) 6%, transparent)"
          : "var(--color-bg-surface)",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {/* 클릭 영역 — 선택 */}
      <button
        type="button"
        onClick={onSelect}
        style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left" as const }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          {isSys && <Shield size={10} style={{ color: "var(--color-status-info, #2563eb)", flexShrink: 0 }} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t.name}
          </span>
          {t.is_user_default && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "0 4px", borderRadius: 3, background: "color-mix(in srgb, var(--color-primary) 12%, transparent)", color: "var(--color-primary)" }}>기본</span>
          )}
        </div>
        <div style={{
          fontSize: 11.5, color: "var(--color-text-secondary)", lineHeight: 1.5,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          opacity: 0.8,
        }}>
          {t.body.replace(/#\{[^}]+\}/g, "•").slice(0, 80)}
        </div>
      </button>

      {/* 더보기 메뉴 (⋯) */}
      {(onSetDefault || onDuplicate || onDelete) && (
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            style={{ padding: "6px 8px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 6, color: "var(--color-text-muted)", fontSize: 18, lineHeight: 1, transition: "background 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "100%", marginTop: 4, width: 160,
              background: "var(--color-bg-surface)", border: "1px solid var(--color-border-divider)",
              borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, overflow: "hidden",
            }}>
              {onSetDefault && (
                <button type="button" onClick={() => { onSetDefault(); setMenuOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", textAlign: "left" as const }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <FiStar size={13} style={t.is_user_default ? { color: "var(--color-primary)", fill: "var(--color-primary)" } : { color: "var(--color-text-muted)" }} />
                  {t.is_user_default ? "기본 해제" : "기본으로 지정"}
                </button>
              )}
              {onDuplicate && (
                <button type="button" onClick={() => { onDuplicate(); setMenuOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", textAlign: "left" as const }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <FiCopy size={13} style={{ color: "var(--color-text-muted)" }} />
                  {isSys ? "복제해서 내 양식으로" : "다른 이름으로 복제"}
                </button>
              )}
              {onDelete && !isSys && (
                <button type="button" onClick={() => { onDelete(); setMenuOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--color-error, #dc2626)", textAlign: "left" as const }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-error) 6%, transparent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <FiTrash2 size={13} />
                  삭제
                </button>
              )}
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
  alimtalkExtraVarsPerStudent,
}: SendMessageModalProps) {
  const queryClient = useQueryClient();
  const { data: messagingInfo } = useMessagingInfo();
  const smsAllowed = messagingInfo?.sms_allowed ?? false;

  // ─── State ───
  const [sendMode, setSendMode] = useState<SendMode>("alimtalk");
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
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showAlimtalkPanel, setShowAlimtalkPanel] = useState(false);
  /** 알림톡 직접 작성 모드 — 양식 없이 자유 입력 */
  const [alimtalkFreeForm, setAlimtalkFreeForm] = useState(false);
  const [templateBodySnapshot, setTemplateBodySnapshot] = useState<string | null>(null);
  /** 빈 본문 안내 오버레이를 닫음 — "직접 작성하기" 후에도 본문이 비어 있으면 오버레이가 다시 덮여 입력 불가가 되던 버그 방지 */
  const [smsEmptyHintDismissed, setSmsEmptyHintDismissed] = useState(false);
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  /** open 전환 감지용 — smsAllowed 변경 시 body 리셋 방지 */
  const prevOpenRef = useRef(false);
  const getNativeTextarea = useCallback(
    () => bodyWrapRef.current?.querySelector("textarea") ?? null, [],
  );

  // ─── Derived ───
  // 통합 4종 알림톡 전환 완료 — 모든 카테고리에서 SMS/알림톡 양쪽 사용 가능
  const smsOnlyCategory = false;
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
  const bodyModified = selectedTemplate != null && templateBodySnapshot != null && body !== templateBodySnapshot;
  const approvedTemplates = useMemo(() => templates.filter((t) => t.solapi_status === "APPROVED"), [templates]);
  const recentIds = useMemo(() => getRecentIds(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Categorize templates for picker/browser
  // 알림톡: 통합 4종 라우팅이므로 모든 템플릿 사용 가능 (signup 제외)
  const categorizedTemplates = useMemo(() => {
    const list = sendMode === "alimtalk"
      ? templates.filter((t) => t.category !== "signup")  // signup은 시스템 전용
      : templates;
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
      else if (isSystemTpl(t)) defaults.push(t);
      else custom.push(t);
    }
    recent.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
    return { recent, defaults, custom };
  }, [templates, sendMode, templateSearch, recentIds]);

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

  const smsOverLimit = sendMode === "sms" && body.length > SMS_MAX_CHARS;

  const canSend = (() => {
    if (!hasRecipients || sendToTargets.length === 0 || messageModes.length === 0 || sending) return false;
    if (sendMode === "sms") return body.trim().length > 0 && !smsOverLimit;
    if (sendMode === "alimtalk") {
      if (!selectedTemplate && !alimtalkFreeForm) return false;
      if (!body.trim()) return false;
      return true;
    }
    return false;
  })();

  // ─── Blocks (SMS only) ───
  const blocks = useMemo(() => getBlocksForCategory(blockCategory), [blockCategory]);

  // ─── Preview ───
  const previewBody = sendMode === "alimtalk" && selectedTemplate
    ? renderPreviewWithActualData(selectedTemplate.body, alimtalkExtraVars, freeContent)
    : sendMode === "alimtalk" && alimtalkFreeForm
    ? renderPreviewBadges(body)
    : renderPreviewBadges(body);
  const previewSubject = sendMode === "alimtalk" && selectedTemplate
    ? renderPreviewWithActualData(selectedTemplate.subject || "", alimtalkExtraVars)
    : renderPreviewBadges(subject);

  // ─── Confirmation step ───
  const [showConfirm, setShowConfirm] = useState(false);

  // ─── Reset on open (open 전환 시에만 전체 리셋) ───
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;
    setSubject("");
    setBody(initialBody ?? "");
    setFreeContent("");
    setSelectedTemplateId(null);
    setSendToParent(true);
    setSendToStudent(true);
    setSendMode("alimtalk");
    setTemplateSearch("");
    setShowSaveForm(false);
    setSaveTemplateName("");
    setShowTemplatePanel(false);
    setShowAlimtalkPanel(false);
    setAlimtalkFreeForm(!!initialBody);
    setTemplateBodySnapshot(null);
    setSmsEmptyHintDismissed(false);
    setShowConfirm(false);
    sendingRef.current = false;
  }, [open, initialBody, smsAllowed]);

  // smsAllowed가 뒤늦게 로드되면 sendMode만 보정 (body·subject 등 사용자 입력은 건드리지 않음)
  useEffect(() => {
    if (!open || !smsAllowed) return;
    // smsAllowed 로드 시 모드 보정 — 알림톡 기본 유지
    setSendMode((prev) => prev);
  }, [open, smsAllowed, blockCategory, initialBody]);

  // Load templates (시스템 기본 승인 템플릿 포함 — 알림톡 기본 채널 폴백용)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchMessageTemplates(undefined, true).then((list) => {
      if (cancelled) return;
      setTemplates(list);
      // 알림톡 모드 + 양식 미선택 시: 카테고리에 맞는 기본 양식 자동 선택
      if (!selectedTemplateId && !initialBody) {
        const categoryMap: Record<string, string> = {
          clinic: "clinic", attendance: "attendance", exam: "exam",
          grades: "grades", assignment: "assignment", payment: "payment",
          student: "default", default: "default",
        };
        const targetCat = categoryMap[blockCategory] || "default";
        const match = list.find((t) => t.is_system && t.category === targetCat)
          || list.find((t) => t.is_system && t.is_user_default)
          || list.find((t) => t.is_system);
        if (match) {
          setSelectedTemplateId(match.id);
          setBody(match.body);
          setTemplateBodySnapshot(match.body);
        }
      }
    }).catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setTemplateBodySnapshot(t.body ?? "");
    setFreeContent("");
    addRecentId(t.id);
  }, []);

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim() || !body.trim() || savingTemplate) return;
    setSavingTemplate(true);
    try {
      const created = await createMessageTemplate({
        category: (blockCategory === "default" ? "default" : blockCategory) as Parameters<typeof createMessageTemplate>[0]["category"],
        name: saveTemplateName.trim(),
        subject: subject || "",
        body,
      });
      setTemplates((prev) => [created, ...prev]);
      setSelectedTemplateId(created.id);
      setTemplateBodySnapshot(created.body);
      feedback.success(`"${created.name}" 양식이 저장되었습니다.`);
      setShowSaveForm(false);
      setSaveTemplateName("");
    } catch {
      feedback.error("양식 저장에 실패했습니다.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate || isSystemTpl(selectedTemplate) || !body.trim()) return;
    try {
      const updated = await updateMessageTemplate(selectedTemplate.id, { body, subject });
      setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setTemplateBodySnapshot(updated.body);
      feedback.success(`"${updated.name}" 양식이 업데이트되었습니다.`);
    } catch {
      feedback.error("양식 업데이트에 실패했습니다.");
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      const updated = await setTemplateDefault(id);
      setTemplates((prev) => prev.map((t) => {
        if (t.id === id) return updated;
        // 같은 카테고리의 다른 것은 기본 해제
        if (t.category === updated.category && t.is_user_default && t.id !== id) {
          return { ...t, is_user_default: false };
        }
        return t;
      }));
      feedback.success(updated.is_user_default ? `"${updated.name}" 을(를) 기본 양식으로 지정했습니다.` : "기본 양식 지정을 해제했습니다.");
    } catch {
      feedback.error("기본 양식 지정에 실패했습니다.");
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const dup = await duplicateMessageTemplate(id);
      setTemplates((prev) => [dup, ...prev]);
      feedback.success(`"${dup.name}" 양식이 복제되었습니다.`);
    } catch {
      feedback.error("양식 복제에 실패했습니다.");
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    if (!window.confirm(`"${target.name}" 양식을 삭제할까요?\n삭제하면 복구할 수 없습니다.`)) return;
    try {
      await deleteMessageTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setTemplateBodySnapshot(null);
      }
      feedback.success("양식이 삭제되었습니다.");
    } catch {
      feedback.error("양식 삭제에 실패했습니다.");
    }
  };

  const requestSend = () => {
    if (!canSend) return;
    setShowConfirm(true);
  };

  const handleSend = async () => {
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setShowConfirm(false);
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
          payload.raw_body = body.trim();
          if (subject.trim()) payload.raw_subject = subject.trim();
          if (alimtalkExtraVars) payload.alimtalk_extra_vars = alimtalkExtraVars;
          if (alimtalkExtraVarsPerStudent && Object.keys(alimtalkExtraVarsPerStudent).length > 0) {
            payload.alimtalk_extra_vars_per_student = alimtalkExtraVarsPerStudent;
          }
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
      if (totalEnqueued > 0) {
        const skippedNote = totalSkipped > 0 ? ` (전화번호 없음 ${totalSkipped}건 제외)` : "";
        feedback.success(`${sendToLabel} ${modeLabel} ${totalEnqueued}건 발송 예정${skippedNote} — 발송 내역에서 결과를 확인하세요.`);
        asyncStatusStore.completeTask(taskId, "success");
      } else {
        const hint = totalSkipped > 0
          ? `${sendToLabel} 대상 중 전화번호가 없어 큐에 등록된 건이 0건입니다.`
          : `${sendToLabel} ${modeLabel} 발송이 큐에 등록되지 않았습니다. 발신번호·메시지 연동(SMS/알림톡)·수신 번호를 확인해 주세요.`;
        feedback.warning(hint);
        asyncStatusStore.completeTask(taskId, "error", "발송 큐 0건");
      }
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
    if (sendMode === "sms" && !smsAllowed) return "SMS 연동 후 발송 가능합니다 (설정 > 메시지)";
    if (sendMode === "sms" && !body.trim()) return "본문을 입력해 주세요";
    if (sendMode === "sms" && smsOverLimit) return `본문이 ${SMS_MAX_CHARS}자를 초과합니다`;
    if (sendMode === "alimtalk" && !selectedTemplate && !alimtalkFreeForm) return "양식을 선택하거나 직접 작성해 주세요";
    if (sendMode === "alimtalk" && !body.trim()) return "본문을 입력해 주세요";
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
    <AdminModal open={open} onClose={onClose} width={920} onEnterConfirm={requestSend} className="send-message-modal">
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
        <div className="flex gap-5" style={{ minHeight: 0, flex: "1 1 auto" }}>

          {/* ═══ 좌측: 수신자 + 미리보기 + 변수 상태 ═══ */}
          <div className="shrink-0 flex flex-col gap-3" style={{ width: 260, maxHeight: "100%", overflowY: "auto" }}>
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
              {hasRecipients && !isStaffMode && (
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4, lineHeight: 1.6 }}>
                  {sendToParent && sendToStudent ? "학부모·학생 모두에게 발송" :
                   sendToParent ? "학부모에게만 발송" :
                   sendToStudent ? "학생에게만 발송" :
                   "대상을 선택해 주세요"}
                </div>
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
                    {selectedTemplate ? previewBody : alimtalkFreeForm && body ? previewBody : <span style={{ color: "#999" }}>{alimtalkFreeForm ? "내용을 입력하세요" : "양식을 선택하세요"}</span>}
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
              {/* 채널 선택: SMS / 알림톡 / 둘 다 */}
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
                      onClick={() => {
                        if (opt.key === sendMode || opt.disabled) return;
                        setSendMode(opt.key);
                        setSelectedTemplateId(null);
                        setSubject("");
                        setBody(opt.key === "sms" ? (initialBody ?? "") : "");
                        setFreeContent("");
                        setShowAlimtalkPanel(false);
                        setAlimtalkFreeForm(false);
                        setShowTemplatePanel(false);
                      }}
                      disabled={sending || opt.disabled}
                      title={opt.disabled ? "SMS 연동 후 사용 가능 (설정 > 메시지)" : undefined}
                      style={{
                        padding: "6px 16px", fontSize: 13, fontWeight: 700, border: "none",
                        cursor: opt.disabled ? "not-allowed" : "pointer",
                        color: sendMode === opt.key ? "#fff" : opt.disabled ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                        background: sendMode === opt.key ? "var(--color-primary)" : "var(--color-bg-surface)",
                        opacity: opt.disabled ? 0.5 : 1,
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {!smsAllowed && sendMode === "sms" && <span style={{ fontSize: 10, color: "var(--color-status-warning, #d97706)" }}>SMS 미연동</span>}
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
                {/* ── 양식 선택 바 ── */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, background: "color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-surface))",
                  border: "1.5px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border-divider))",
                }}>
                  <FiChevronLeft size={16} style={{ color: "var(--color-primary)", flexShrink: 0, transform: "rotate(-90deg)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {selectedTemplate ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {selectedTemplate.name}
                        </span>
                        {selectedTemplate.is_user_default && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, var(--color-primary) 14%, transparent)", color: "var(--color-primary)" }}>기본</span>}
                        {isSystemTpl(selectedTemplate) && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, #2563eb 12%, transparent)", color: "#2563eb" }}>시스템</span>}
                        {bodyModified && <span style={{ fontSize: 10, color: "var(--color-status-warning, #d97706)", fontWeight: 600 }}>· 수정됨</span>}
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>양식을 선택하거나 직접 작성하세요</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    intent="primary"
                    onClick={() => setShowTemplatePanel(!showTemplatePanel)}
                    disabled={sending}
                    style={{ fontWeight: 700 }}
                  >
                    {showTemplatePanel ? "닫기" : selectedTemplate ? "양식 변경" : "양식 선택"}
                  </Button>
                </div>

                {/* ── 양식 패널 (접이식) ── */}
                {showTemplatePanel && (
                  <div style={{ borderRadius: 10, border: "1px solid var(--color-border-divider)", background: "var(--color-bg-surface)", maxHeight: 280, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ position: "relative", marginBottom: 2 }}>
                      <FiSearch size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
                      <Input size="small" placeholder="양식 검색…" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} style={{ paddingLeft: 28, fontSize: 12 }} />
                    </div>
                    <button type="button" onClick={() => { setSelectedTemplateId(null); setBody(""); setSubject(""); setShowTemplatePanel(false); setTemplateBodySnapshot(null); setSmsEmptyHintDismissed(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: selectedTemplateId == null ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)", background: selectedTemplateId == null ? "color-mix(in srgb, var(--color-primary) 6%, transparent)" : "transparent", cursor: "pointer", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", transition: "all 0.15s" }}>
                      <FiEdit3 size={14} style={{ color: selectedTemplateId == null ? "var(--color-primary)" : "var(--color-text-muted)", flexShrink: 0 }} />
                      직접 작성하기
                    </button>
                    {categorizedTemplates.custom.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", padding: "6px 4px 2px", letterSpacing: "0.5px" }}>내 양식</div>
                        {categorizedTemplates.custom.map((t) => (
                          <TemplatePickerCard key={t.id} template={t} isSelected={selectedTemplateId === t.id} onSelect={() => { selectTemplate(t); setShowTemplatePanel(false); }} onSetDefault={() => handleSetDefault(t.id)} onDuplicate={() => handleDuplicate(t.id)} onDelete={() => handleDeleteTemplate(t.id)} />
                        ))}
                      </>
                    )}
                    {categorizedTemplates.defaults.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", padding: "6px 4px 2px", letterSpacing: "0.5px" }}>시스템 기본 양식</div>
                        {categorizedTemplates.defaults.map((t) => (
                          <TemplatePickerCard key={t.id} template={t} isSelected={selectedTemplateId === t.id} onSelect={() => { selectTemplate(t); setShowTemplatePanel(false); }} onSetDefault={() => handleSetDefault(t.id)} onDuplicate={() => handleDuplicate(t.id)} onDelete={null} />
                        ))}
                      </>
                    )}
                    {categorizedTemplates.recent.length === 0 && categorizedTemplates.custom.length === 0 && categorizedTemplates.defaults.length === 0 && (
                      <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--color-text-muted)" }}>
                        {templateSearch ? "검색 결과 없음" : "저장된 양식이 없습니다."}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 저장 바 (상황에 따라 한 가지만 표시) ── */}
                {!showSaveForm && body.trim() && !showTemplatePanel && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "var(--color-bg-surface-soft)", border: "1px solid var(--color-border-divider)" }}>
                    {bodyModified && selectedTemplate && !isSystemTpl(selectedTemplate) ? (
                      <>
                        <Button size="sm" intent="primary" onClick={handleUpdateTemplate} disabled={sending}>양식 덮어쓰기</Button>
                        <button type="button" onClick={() => { setShowSaveForm(true); setSaveTemplateName(""); }} disabled={sending} style={{ fontSize: 12, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>
                          다른 이름으로 저장
                        </button>
                      </>
                    ) : (
                      <Button size="sm" intent="secondary" onClick={() => { setShowSaveForm(true); setSaveTemplateName(""); }} disabled={sending}>양식으로 저장</Button>
                    )}
                    <div style={{ flex: 1 }} />
                    {charInfo && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: charInfo.tone === "ok" ? "color-mix(in srgb, var(--color-success) 12%, transparent)" : charInfo.tone === "lms" ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "color-mix(in srgb, var(--color-error) 12%, transparent)", color: charInfo.tone === "ok" ? "var(--color-success)" : charInfo.tone === "lms" ? "var(--color-primary)" : "var(--color-error)" }}>
                        {charInfo.label}
                      </span>
                    )}
                  </div>
                )}
                {showSaveForm && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px", borderRadius: 8, background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))", border: "1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border-divider))" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>양식 이름을 입력하세요</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Input size="small" placeholder="예: 출결 알림, 성적표 양식" value={saveTemplateName} onChange={(e) => setSaveTemplateName(e.target.value)} onPressEnter={handleSaveTemplate} style={{ flex: 1, fontSize: 13 }} autoFocus />
                      <Button size="sm" intent="primary" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim() || !body.trim() || savingTemplate}>{savingTemplate ? "저장 중…" : "저장"}</Button>
                      <Button size="sm" intent="secondary" onClick={() => setShowSaveForm(false)}>취소</Button>
                    </div>
                  </div>
                )}

                {/* ── 편집 영역: 본문(좌) + 변수 팔레트(우) ── */}
                <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
                  {/* 본문 */}
                  <div ref={bodyWrapRef} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
                    {/* 빈 상태 오버레이 */}
                    {!body && !selectedTemplate && !smsEmptyHintDismissed && (
                      <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--color-bg-surface)", borderRadius: 8, border: "1px solid var(--color-border-divider)", pointerEvents: "auto" }}>
                        <FiEdit3 size={28} style={{ color: "var(--color-text-muted)", opacity: 0.4 }} />
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>양식을 선택하거나</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)" }}>직접 내용을 작성하세요</div>
                        </div>
                        <Button size="sm" intent="primary" onClick={() => { setSmsEmptyHintDismissed(true); setShowTemplatePanel(true); }} style={{ marginTop: 4 }}>양식 선택하기</Button>
                        <button type="button" onClick={() => setSmsEmptyHintDismissed(true)} style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>직접 작성하기</button>
                      </div>
                    )}
                    <Input.TextArea
                      placeholder="내용을 입력하세요"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      disabled={sending}
                      className="message-domain-input"
                      style={{
                        resize: "none",
                        fontFamily: "inherit",
                        minHeight: 240,
                        flex: 1,
                        fontSize: 14,
                        lineHeight: 1.7,
                        padding: 12,
                        borderColor: smsOverLimit ? "var(--color-error)" : undefined,
                        pointerEvents: !body && !selectedTemplate && !smsEmptyHintDismissed ? "none" : undefined,
                      }}
                    />
                    {smsOverLimit && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 12, fontWeight: 600, color: "var(--color-error)" }}>
                        <FiAlertCircle size={12} />
                        {SMS_MAX_CHARS}자 초과 ({body.length}자)
                      </div>
                    )}
                  </div>

                  {/* 변수 팔레트 */}
                  <div style={{ width: 195, flexShrink: 0, overflowY: "auto", padding: "10px 10px 10px 12px", borderRadius: 10, background: "color-mix(in srgb, var(--color-bg-surface-soft) 70%, var(--color-bg-surface))", border: "1px solid var(--color-border-divider)", borderLeft: "2.5px solid var(--color-primary)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: 2 }}>변수 삽입</div>
                    <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.4 }}>클릭하면 커서 위치에 추가됩니다</div>
                    {blockCategory === "grades" ? (
                      <GradesBlockPanel blocks={blocks} onInsert={insertBlock} disabled={sending} currentBody={body} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {blocks.map((block) => {
                          const bc = getBlockColor(block.id);
                          return (
                            <div key={block.id}>
                              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertBlock(block.insertText)} disabled={sending} className="template-editor__block-tag" style={{ background: bc.bg, color: bc.color, borderColor: bc.border, padding: "4px 10px", fontSize: 11, width: "100%" }}>
                                {block.label}
                              </button>
                              {block.description && <div style={{ fontSize: 9.5, color: "var(--color-text-muted)", paddingLeft: 2, lineHeight: 1.3, marginTop: 1 }}>{block.description}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ══════ 알림톡 모드 — SMS와 동일한 양식 선택 패널 + 본문 편집 ══════ */}
            {sendMode === "alimtalk" && (
              <>
                {/* ── 양식 선택 바 ── */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, background: "color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-surface))",
                  border: "1.5px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border-divider))",
                }}>
                  <FiChevronLeft size={16} style={{ color: "var(--color-primary)", flexShrink: 0, transform: "rotate(-90deg)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {selectedTemplate ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {selectedTemplate.name}
                        </span>
                        {selectedTemplate.is_user_default && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, var(--color-primary) 14%, transparent)", color: "var(--color-primary)" }}>기본</span>}
                        {isSystemTpl(selectedTemplate) && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, #2563eb 12%, transparent)", color: "#2563eb" }}>시스템</span>}
                        {selectedTemplate.solapi_status === "APPROVED" && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, var(--color-success) 12%, transparent)", color: "var(--color-success)" }}>승인</span>}
                        {bodyModified && <span style={{ fontSize: 10, color: "var(--color-status-warning, #d97706)", fontWeight: 600 }}>· 수정됨</span>}
                      </div>
                    ) : alimtalkFreeForm ? (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>직접 작성 모드</span>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>양식을 선택하거나 직접 작성하세요</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    intent="primary"
                    onClick={() => setShowAlimtalkPanel(!showAlimtalkPanel)}
                    disabled={sending}
                    style={{ fontWeight: 700 }}
                  >
                    {showAlimtalkPanel ? "닫기" : selectedTemplate ? "양식 변경" : "양식 선택"}
                  </Button>
                </div>

                {/* ── 양식 패널 (접이식) ── */}
                {showAlimtalkPanel && (
                  <div style={{ borderRadius: 10, border: "1px solid var(--color-border-divider)", background: "var(--color-bg-surface)", maxHeight: 280, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ position: "relative", marginBottom: 2 }}>
                      <FiSearch size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
                      <Input size="small" placeholder="양식 검색…" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} style={{ paddingLeft: 28, fontSize: 12 }} />
                    </div>
                    {/* 직접 작성하기 */}
                    <button type="button" onClick={() => {
                      setSelectedTemplateId(null); setBody(""); setSubject(""); setFreeContent("");
                      setShowAlimtalkPanel(false); setTemplateBodySnapshot(null); setAlimtalkFreeForm(true);
                    }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8,
                        border: alimtalkFreeForm && !selectedTemplate ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
                        background: alimtalkFreeForm && !selectedTemplate ? "color-mix(in srgb, var(--color-primary) 6%, transparent)" : "transparent",
                        cursor: "pointer", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", transition: "all 0.15s",
                      }}>
                      <FiEdit3 size={14} style={{ color: alimtalkFreeForm && !selectedTemplate ? "var(--color-primary)" : "var(--color-text-muted)", flexShrink: 0 }} />
                      직접 작성하기
                    </button>
                    {/* 내 양식 — SMS와 동일한 관리 기능 (기본 지정/복제/삭제) */}
                    {categorizedTemplates.custom.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", padding: "6px 4px 2px", letterSpacing: "0.5px" }}>내 양식</div>
                        {categorizedTemplates.custom.map((t) => (
                          <TemplatePickerCard key={t.id} template={t} isSelected={selectedTemplateId === t.id} onSelect={() => { selectTemplate(t); setShowAlimtalkPanel(false); setAlimtalkFreeForm(false); }} onSetDefault={() => handleSetDefault(t.id)} onDuplicate={() => handleDuplicate(t.id)} onDelete={() => handleDeleteTemplate(t.id)} />
                        ))}
                      </>
                    )}
                    {/* 시스템 기본 양식 */}
                    {categorizedTemplates.defaults.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", padding: "6px 4px 2px", letterSpacing: "0.5px" }}>시스템 기본 양식</div>
                        {categorizedTemplates.defaults.map((t) => (
                          <TemplatePickerCard key={t.id} template={t} isSelected={selectedTemplateId === t.id} onSelect={() => { selectTemplate(t); setShowAlimtalkPanel(false); setAlimtalkFreeForm(false); }} onSetDefault={() => handleSetDefault(t.id)} onDuplicate={() => handleDuplicate(t.id)} onDelete={null} />
                        ))}
                      </>
                    )}
                    {categorizedTemplates.custom.length === 0 && categorizedTemplates.defaults.length === 0 && categorizedTemplates.recent.length === 0 && (
                      <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--color-text-muted)" }}>
                        {templateSearch ? "검색 결과 없음" : "저장된 양식이 없습니다."}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 저장 바 ── */}
                {!showSaveForm && body.trim() && !showAlimtalkPanel && (selectedTemplate || alimtalkFreeForm) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "var(--color-bg-surface-soft)", border: "1px solid var(--color-border-divider)" }}>
                    {bodyModified && selectedTemplate && !isSystemTpl(selectedTemplate) ? (
                      <>
                        <Button size="sm" intent="primary" onClick={handleUpdateTemplate} disabled={sending}>양식 덮어쓰기</Button>
                        <button type="button" onClick={() => { setShowSaveForm(true); setSaveTemplateName(""); }} disabled={sending} style={{ fontSize: 12, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>
                          다른 이름으로 저장
                        </button>
                      </>
                    ) : (
                      <Button size="sm" intent="secondary" onClick={() => { setShowSaveForm(true); setSaveTemplateName(""); }} disabled={sending}>양식으로 저장</Button>
                    )}
                  </div>
                )}
                {showSaveForm && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px", borderRadius: 8, background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))", border: "1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border-divider))" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>양식 이름을 입력하세요</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Input size="small" placeholder="예: 출결 알림, 성적표 양식" value={saveTemplateName} onChange={(e) => setSaveTemplateName(e.target.value)} onPressEnter={handleSaveTemplate} style={{ flex: 1, fontSize: 13 }} autoFocus />
                      <Button size="sm" intent="primary" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim() || !body.trim() || savingTemplate}>{savingTemplate ? "저장 중…" : "저장"}</Button>
                      <Button size="sm" intent="secondary" onClick={() => setShowSaveForm(false)}>취소</Button>
                    </div>
                  </div>
                )}

                {/* ── 편집 영역: 본문(좌) + 변수 팔레트(우) — SMS와 동일 구조 ── */}
                <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
                  {/* 본문 */}
                  <div ref={bodyWrapRef} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
                    {selectedTemplate && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        본문
                        {isSystemTpl(selectedTemplate) && (
                          <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, #2563eb 12%, transparent)", color: "#2563eb" }}>기본</span>
                        )}
                        {bodyModified && (
                          <span style={{ fontSize: 10, color: "var(--color-status-warning, #d97706)", fontWeight: 600 }}>수정됨</span>
                        )}
                      </div>
                    )}
                    {/* 빈 상태 오버레이 — SMS와 동일 패턴 */}
                    {!body && !selectedTemplate && !alimtalkFreeForm && (
                      <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--color-bg-surface)", borderRadius: 8, border: "1px solid var(--color-border-divider)", pointerEvents: "auto" }}>
                        <FiEdit3 size={28} style={{ color: "var(--color-text-muted)", opacity: 0.4 }} />
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>양식을 선택하거나</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)" }}>직접 내용을 작성하세요</div>
                        </div>
                        <Button size="sm" intent="primary" onClick={() => { setAlimtalkFreeForm(true); setShowAlimtalkPanel(true); }} style={{ marginTop: 4 }}>양식 선택하기</Button>
                        <button type="button" onClick={() => setAlimtalkFreeForm(true)} style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>직접 작성하기</button>
                      </div>
                    )}
                    <Input.TextArea
                      value={body}
                      onChange={(e) => { setBody(e.target.value); if (!alimtalkFreeForm && !selectedTemplate) setAlimtalkFreeForm(true); }}
                      disabled={sending}
                      className="message-domain-input"
                      style={{
                        resize: "none", fontFamily: "inherit", minHeight: 200, flex: 1,
                        fontSize: 14, lineHeight: 1.7, padding: 12,
                        pointerEvents: !body && !selectedTemplate && !alimtalkFreeForm ? "none" : undefined,
                      }}
                      placeholder="알림톡 본문을 작성하세요"
                    />
                  </div>

                  {/* 변수 팔레트 — 항상 표시 */}
                  <div style={{ width: 195, flexShrink: 0, overflowY: "auto", padding: "10px 10px 10px 12px", borderRadius: 10, background: "color-mix(in srgb, var(--color-bg-surface-soft) 70%, var(--color-bg-surface))", border: "1px solid var(--color-border-divider)", borderLeft: "2.5px solid var(--color-primary)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: 2 }}>변수 삽입</div>
                    <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.4 }}>클릭하면 커서 위치에 추가됩니다</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {blocks.map((block) => {
                        const bc = getBlockColor(block.id);
                        return (
                          <div key={block.id}>
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (!alimtalkFreeForm && !selectedTemplate) setAlimtalkFreeForm(true); insertBlock(block.insertText); }} disabled={sending} className="template-editor__block-tag" style={{ background: bc.bg, color: bc.color, borderColor: bc.border, padding: "4px 10px", fontSize: 11, width: "100%" }}>
                              {block.label}
                            </button>
                            {block.description && <div style={{ fontSize: 9.5, color: "var(--color-text-muted)", paddingLeft: 2, lineHeight: 1.3, marginTop: 1 }}>{block.description}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalBody>

      {/* ─── 발송 확인 오버레이 ─── */}
      {showConfirm && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 20,
          background: "color-mix(in srgb, var(--color-bg-surface) 94%, transparent)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "inherit",
        }}>
          <div style={{
            width: 380, padding: "32px 28px", textAlign: "center",
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
              발송을 확인해 주세요
            </div>
            <div style={{
              display: "flex", flexDirection: "column", gap: 8, padding: "16px 20px",
              borderRadius: 12, background: "var(--color-bg-surface-soft)",
              border: "1px solid var(--color-border-divider)",
              textAlign: "left",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--color-text-muted)" }}>채널</span>
                <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {sendMode === "sms" ? (body.length > 90 ? "LMS (장문)" : "SMS (단문)") : "카카오 알림톡"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--color-text-muted)" }}>대상</span>
                <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {isStaffMode ? `직원 ${staffIds.length}명` : (() => {
                    const parts: string[] = [];
                    if (sendToParent) parts.push(`학부모 ${recipientCount}명`);
                    if (sendToStudent) parts.push(`학생 ${recipientCount}명`);
                    return parts.join(" + ");
                  })()}
                </span>
              </div>
              {sendMode === "alimtalk" && (selectedTemplate || alimtalkFreeForm) && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--color-text-muted)" }}>템플릿</span>
                  <span style={{ fontWeight: 600, color: "var(--color-text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedTemplate ? selectedTemplate.name : "직접 작성"}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--color-text-muted)" }}>본문</span>
                <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>{body.length}자</span>
              </div>
              {/* 본문 미리보기 */}
              <div style={{
                fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5,
                padding: "8px 10px", borderRadius: 8, marginTop: 2,
                background: "var(--color-bg-surface)", border: "1px solid var(--color-border-divider)",
                maxHeight: 80, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {body.slice(0, 200)}{body.length > 200 ? "…" : ""}
              </div>
            </div>
            {sendMode === "sms" && body.length > 90 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                borderRadius: 8, fontSize: 12,
                background: "color-mix(in srgb, var(--color-status-warning, #d97706) 8%, transparent)",
                color: "var(--color-status-warning, #d97706)",
              }}>
                <FiAlertTriangle size={13} style={{ flexShrink: 0 }} />
                90자 초과 — LMS 요금이 적용됩니다
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Button intent="secondary" onClick={() => setShowConfirm(false)} style={{ minWidth: 100 }}>
                돌아가기
              </Button>
              <Button intent="primary" onClick={handleSend} disabled={sending} style={{ minWidth: 140, fontSize: 14 }}>
                {sending ? "발송 중…" : "발송하기"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
              onClick={requestSend}
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
