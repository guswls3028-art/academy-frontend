// PATH: src/features/messages/components/SendMessageModal.tsx
// 공용 메시지 발송 모달 — 좌: 수신자+미리보기 / 우: 탭+본문+삽입 블록
// TemplateEditModal 디자인 패턴과 통일된 split-view 레이아웃. 단발성 발송 SSOT.

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "antd";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import {
  fetchMessageTemplates,
  sendMessage,
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
} from "../constants/templateBlocks";
import type { MessageTemplateCategory } from "../api/messages.api";
import "../styles/templateEditor.css";

/** SMS 기준 글자수: 90자 이하 = SMS, 91~2000 = LMS */
function getCharLabel(len: number) {
  if (len === 0) return null;
  if (len <= 90) return { label: `${len}/90`, tone: "ok" as const };
  if (len <= 2000) return { label: `${len} (LMS)`, tone: "lms" as const };
  return { label: `${len} (초과)`, tone: "over" as const };
}

export type SendMessageModalOpenOptions = {
  studentIds: number[];
  recipientLabel?: string;
};

import type { TemplateCategory } from "../constants/templateBlocks";

export type SendMessageModalProps = {
  open: boolean;
  onClose: () => void;
  /** 호출한 화면에서 넘긴 수신자(학생 ID). 비어 있으면 발송 불가 안내 */
  initialStudentIds?: number[];
  /** 직원 수신 시 넘긴 직원 ID 목록 */
  initialStaffIds?: number[];
  /** 수신자 설명 (예: "선택한 학생 3명") */
  recipientLabel?: string;
  /** 삽입 블록 카테고리. 미지정 시 "default" (모든 블록) */
  blockCategory?: TemplateCategory;
  /** 본문 사전 입력 (성적 발송 등) */
  initialBody?: string;
  /** 알림톡 추가 치환 변수 (성적 발송 시 시험명/강의명/시험성적 등) */
  alimtalkExtraVars?: Record<string, string>;
};

type ContentMode = "free" | "template";
type SendMode = "sms" | "alimtalk";

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
  const [contentMode, setContentMode] = useState<ContentMode>("free");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  /** 수신자: 학부모·학생 둘 다 선택 가능 (최소 1개). 직원 모드일 때는 사용 안 함 */
  const [sendToParent, setSendToParent] = useState(true);
  const [sendToStudent, setSendToStudent] = useState(true);
  /** 발송 방식: 단일 sendMode 드롭다운 */
  const [sendMode, setSendMode] = useState<SendMode>("alimtalk");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // ref guard against double-submit
  const [templates, setTemplates] = useState<MessageTemplateItem[]>([]);
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  const getNativeTextarea = useCallback(
    () => bodyWrapRef.current?.querySelector("textarea") ?? null,
    []
  );
  const { data: messagingInfo } = useMessagingInfo();
  const smsAllowed = messagingInfo?.sms_allowed ?? false;
  const alimtalkAvailable = messagingInfo?.alimtalk_available ?? false;

  const isStaffMode = (initialStaffIds?.length ?? 0) > 0;
  const studentIds = initialStudentIds;
  const staffIds = initialStaffIds ?? [];
  const hasRecipients = isStaffMode ? staffIds.length > 0 : studentIds.length > 0;
  const sendToTargets: SendToType[] = isStaffMode
    ? ["staff"]
    : (() => {
        const t: SendToType[] = [];
        if (sendToParent) t.push("parent");
        if (sendToStudent) t.push("student");
        return t;
      })();

  // Derive messageModes from sendMode
  const messageModes: MessageMode[] = (() => {
    const modes: MessageMode[] = [];
    if (sendMode === "sms" && smsAllowed) modes.push("sms");
    if (sendMode === "alimtalk") modes.push("alimtalk");
    return modes;
  })();

  // Alimtalk template resolution: auto-select freeform template if user typed freely
  const needsApprovedTemplate =
    sendMode === "alimtalk";
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const hasApprovedTemplate =
    !!selectedTemplate && selectedTemplate.solapi_status === "APPROVED";
  // Auto-detect: any approved template available (backend will auto-pick freeform if needed)
  const hasAnyApprovedTemplate = templates.some((t) => t.solapi_status === "APPROVED");

  const canSend =
    hasRecipients &&
    body.trim().length > 0 &&
    sendToTargets.length > 0 &&
    messageModes.length > 0 &&
    (!needsApprovedTemplate || hasApprovedTemplate || hasAnyApprovedTemplate || alimtalkAvailable) &&
    !sending;

  const blocks = getBlocksForCategory(blockCategory);
  const badgeBody = renderPreviewBadges(body);
  const badgeSubject = renderPreviewBadges(subject);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSubject("");
      setBody(initialBody ?? "");
      setSelectedTemplateId(null);
      setContentMode("free");
      setSendToParent(true);
      setSendToStudent(true);
      setSendMode("alimtalk");
      sendingRef.current = false;
    }
  }, [open, smsAllowed, initialBody]);

  // Guard: if smsAllowed becomes false while sms-related mode is selected
  useEffect(() => {
    if (open && !smsAllowed && sendMode === "sms") {
      setSendMode("alimtalk");
    }
  }, [open, smsAllowed, sendMode]);

  // Load templates
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchMessageTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const insertBlock = useCallback(
    (insertText: string) => {
      const ta = getNativeTextarea();
      if (!ta) {
        setBody((prev) => prev + insertText);
        return;
      }
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? start;
      setBody((prev) => {
        const before = prev.slice(0, start);
        const after = prev.slice(end);
        return before + insertText + after;
      });
      const newPos = start + insertText.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      });
    },
    [getNativeTextarea]
  );

  const handleLoadTemplate = (t: MessageTemplateItem) => {
    setSelectedTemplateId(t.id);
    setSubject(t.subject ?? "");
    setBody(t.body ?? "");
    setContentMode("template");
  };

  const handleSend = async () => {
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const taskId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    asyncStatusStore.addWorkerJob("문자 발송", taskId, "messaging");
    try {
      let totalEnqueued = 0;
      let totalSkipped = 0;
      let completedCalls = 0;
      const totalCalls = isStaffMode
        ? messageModes.length
        : sendToTargets.length * messageModes.length;
      if (isStaffMode) {
        for (const messageMode of messageModes) {
          const payload: Parameters<typeof sendMessage>[0] = {
            staff_ids: staffIds,
            send_to: "staff",
            message_mode: messageMode,
            raw_body: body.trim(),
          };
          if (subject.trim()) payload.raw_subject = subject.trim();
          if (selectedTemplateId) payload.template_id = selectedTemplateId;
          const res = await sendMessage(payload);
          totalEnqueued += res.enqueued ?? 0;
          totalSkipped += res.skipped_no_phone ?? 0;
          completedCalls++;
          asyncStatusStore.updateProgress(taskId, Math.round((completedCalls / totalCalls) * 90));
        }
      } else {
        for (const sendTo of sendToTargets) {
          for (const messageMode of messageModes) {
            const payload: Parameters<typeof sendMessage>[0] = {
              student_ids: studentIds,
              send_to: sendTo,
              message_mode: messageMode,
              raw_body: body.trim(),
            };
            if (subject.trim()) payload.raw_subject = subject.trim();
            if (selectedTemplateId) payload.template_id = selectedTemplateId;
            if (alimtalkExtraVars && messageMode === "alimtalk") {
              payload.alimtalk_extra_vars = alimtalkExtraVars;
            }
            const res = await sendMessage(payload);
            totalEnqueued += res.enqueued ?? 0;
            totalSkipped += res.skipped_no_phone ?? 0;
            completedCalls++;
            asyncStatusStore.updateProgress(taskId, Math.round((completedCalls / totalCalls) * 90));
          }
        }
      }
      const sendToLabel = isStaffMode
        ? "직원"
        : sendToTargets.length === 2 ? "학부모·학생" : sendToTargets[0] === "parent" ? "학부모" : "학생";
      const modeLabel = sendMode === "sms" ? "메시지" : "알림톡";
      feedback.success(
        `${sendToLabel} ${modeLabel} 발송 예정 ${totalEnqueued}건입니다.`
      );
      if (totalSkipped > 0) {
        feedback.info(`전화번호 없음으로 ${totalSkipped}건 제외되었습니다.`);
      }
      asyncStatusStore.completeTask(taskId, "success");
      queryClient.invalidateQueries({ queryKey: ["messaging", "info"] });
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      const errMsg = (msg && typeof msg === "string" ? msg : "발송 요청에 실패했습니다.") as string;
      asyncStatusStore.completeTask(taskId, "error", errMsg);
      feedback.error(errMsg);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (!open) return null;

  const label =
    recipientLabel ??
    (isStaffMode
      ? (hasRecipients ? `선택한 직원 ${staffIds.length}명` : "수신자 없음")
      : (hasRecipients ? `선택한 학생 ${studentIds.length}명` : "수신자 없음"));

  // 탭은 발송 방식(sendMode)과 연동 — 별도 탭 불필요
  const showSubjectField = sendMode === "alimtalk";

  const charInfo = getCharLabel(body.length);

  return (
    <AdminModal open={open} onClose={onClose} width={880} onEnterConfirm={handleSend} className="send-message-modal">
      <ModalHeader title="메시지 발송" />
      <ModalBody>
        <div className="flex gap-5" style={{ minHeight: 460 }}>

          {/* ── 좌측: 미리보기 ── */}
          <div className="shrink-0 flex flex-col gap-3" style={{ width: 240 }}>
            {/* 수신자 */}
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface))", border: "1px solid var(--color-border-divider)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4 }}>수신자</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }}>{label}</div>
              {!hasRecipients && (
                <div style={{ fontSize: 11, color: "var(--color-status-warning, #d97706)", marginTop: 4 }}>
                  수신자를 선택한 뒤 발송해 주세요.
                </div>
              )}
            </div>

            {/* 미리보기 */}
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>미리보기</div>
            {sendMode === "sms" ? (
              <div style={{ background: "#1c1c1e", borderRadius: 20, padding: 8 }}>
                <div style={{ background: "#000", borderRadius: 16, padding: "28px 10px 12px", minHeight: 180 }}>
                  <div style={{ maxWidth: "85%", marginLeft: "auto", padding: "8px 12px", background: "#34c759", color: "#fff", fontSize: 12, lineHeight: 1.5, borderRadius: "14px 14px 4px 14px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {body ? badgeBody : <span style={{ opacity: 0.6 }}>본문을 입력하세요</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: "#b2c7d9", borderRadius: 10, padding: 10, minHeight: 140 }}>
                <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", borderLeft: "3px solid #fee500" }}>
                  {subject && (
                    <div style={{ padding: "8px 10px 4px", fontSize: 12, fontWeight: 700, color: "#333", borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}>{badgeSubject}</div>
                  )}
                  <div style={{ padding: "8px 10px 10px", fontSize: 11, lineHeight: 1.5, color: "#333", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {body ? badgeBody : <span style={{ color: "#999" }}>본문을 입력하세요</span>}
                  </div>
                </div>
              </div>
            )}
            <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
              {sendMode === "sms" ? "SMS 예시" : "카카오 알림톡 예시"}
            </div>
          </div>

          {/* ── 우측: 편집 ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* 상단 바: 발송 방식 + 수신 대상 */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 12px", background: "var(--color-bg-surface-soft)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-divider)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>방식</span>
                <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--color-border-divider)" }}>
                  {([
                    { key: "alimtalk" as const, label: "알림톡" },
                    { key: "sms" as const, label: "SMS", disabled: !smsAllowed },
                  ]).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => !opt.disabled && setSendMode(opt.key)}
                      disabled={sending || opt.disabled}
                      style={{
                        padding: "5px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        border: "none",
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
              </div>

              <div style={{ width: 1, height: 20, background: "var(--color-border-divider)" }} />

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>대상</span>
                {isStaffMode ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>직원</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                      <input type="checkbox" checked={sendToParent} onChange={(e) => setSendToParent(e.target.checked)} disabled={sending} />
                      학부모
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                      <input type="checkbox" checked={sendToStudent} onChange={(e) => setSendToStudent(e.target.checked)} disabled={sending} />
                      학생
                    </label>
                    {sendToTargets.length === 0 && (
                      <span style={{ fontSize: 11, color: "var(--color-error)" }}>선택 필요</span>
                    )}
                  </div>
                )}
              </div>

              {charInfo && (
                <>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: charInfo.tone === "ok" ? "var(--color-text-muted)" : charInfo.tone === "lms" ? "var(--color-primary)" : "var(--color-error)" }}>
                    {charInfo.label}
                  </span>
                </>
              )}
            </div>

            {/* 템플릿 or 직접 입력 */}
            {templates.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <Button
                  size="sm"
                  intent={contentMode === "free" ? "primary" : "secondary"}
                  onClick={() => { setContentMode("free"); setSelectedTemplateId(null); }}
                >
                  직접 입력
                </Button>
                {templates.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    intent={selectedTemplateId === t.id ? "primary" : "secondary"}
                    onClick={() => handleLoadTemplate(t)}
                  >
                    {t.name}
                  </Button>
                ))}
              </div>
            )}

            {/* 제목 (알림톡) */}
            {showSubjectField && (
              <Input
                placeholder="알림톡 제목 (선택)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                style={{ fontSize: 14 }}
              />
            )}

            {/* 본문 */}
            <div ref={bodyWrapRef} className="flex-1 min-h-0 flex flex-col">
              <Input.TextArea
                placeholder="내용을 입력하세요"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={sending}
                className="message-domain-input"
                style={{ resize: "vertical", fontFamily: "inherit", minHeight: 180, flex: 1, fontSize: 14, lineHeight: 1.7, padding: 12 }}
              />
            </div>

            {/* 삽입 블록 — 본문 아래 가로 나열 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4 }}>치환 변수 삽입</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {blocks.map((block) => {
                  const bc = getBlockColor(block.id);
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertBlock(block.insertText)}
                      disabled={sending}
                      className="template-editor__block-tag"
                      style={{ background: bc.bg, color: bc.color, borderColor: bc.border, padding: "4px 10px", fontSize: 11 }}
                    >
                      {block.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button intent="secondary" onClick={onClose} disabled={sending}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={handleSend}
              disabled={!canSend || sending}
              style={{ minWidth: 120, fontSize: 14, padding: "8px 24px" }}
            >
              {sending ? "발송 중…" : `${isStaffMode ? staffIds.length : studentIds.length}명에게 발송`}
            </Button>
          </div>
        }
      />
    </AdminModal>
  );
}
