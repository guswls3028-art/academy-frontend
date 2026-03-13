// PATH: src/features/messages/components/SendMessageModal.tsx
// 공용 메시지 발송 모달 — 좌: 수신자+미리보기 / 우: 탭+본문+삽입 블록
// TemplateEditModal 디자인 패턴과 통일된 split-view 레이아웃. 단발성 발송 SSOT.

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "antd";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button, Tabs } from "@/shared/ui/ds";
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
};

type ContentMode = "free" | "template";
type EditorTab = "message" | "alimtalk";
type SendMode = "sms" | "alimtalk" | "both";

export default function SendMessageModal({
  open,
  onClose,
  initialStudentIds = [],
  initialStaffIds = [],
  recipientLabel,
  blockCategory = "default",
  initialBody,
}: SendMessageModalProps) {
  const [contentMode, setContentMode] = useState<ContentMode>("free");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("message");
  /** 수신자: 학부모·학생 둘 다 선택 가능 (최소 1개). 직원 모드일 때는 사용 안 함 */
  const [sendToParent, setSendToParent] = useState(true);
  const [sendToStudent, setSendToStudent] = useState(true);
  /** 발송 방식: 단일 sendMode 드롭다운 */
  const [sendMode, setSendMode] = useState<SendMode>("both");
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
    if ((sendMode === "sms" || sendMode === "both") && smsAllowed) modes.push("sms");
    if (sendMode === "alimtalk" || sendMode === "both") modes.push("alimtalk");
    return modes;
  })();

  const canSend =
    hasRecipients &&
    body.trim().length > 0 &&
    sendToTargets.length > 0 &&
    messageModes.length > 0 &&
    !sending;

  const blocks = getBlocksForCategory(blockCategory);
  const badgeBody = renderPreviewBadges(body);
  const badgeSubject = renderPreviewBadges(subject);
  const showSubject = activeTab === "alimtalk";

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSubject("");
      setBody(initialBody ?? "");
      setSelectedTemplateId(null);
      setContentMode("free");
      setActiveTab("message");
      setSendToParent(true);
      setSendToStudent(true);
      setSendMode(smsAllowed ? "both" : "alimtalk");
      sendingRef.current = false;
    }
  }, [open, smsAllowed, initialBody]);

  // Guard: if smsAllowed becomes false while sms-related mode is selected
  useEffect(() => {
    if (open && !smsAllowed && (sendMode === "sms" || sendMode === "both")) {
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
            const res = await sendMessage(payload);
            totalEnqueued += res.enqueued ?? 0;
            totalSkipped += res.skipped_no_phone ?? 0;
          }
        }
      }
      const sendToLabel = isStaffMode
        ? "직원"
        : sendToTargets.length === 2 ? "학부모·학생" : sendToTargets[0] === "parent" ? "학부모" : "학생";
      const modeLabel =
        messageModes.length === 2 ? "모두" : messageModes[0] === "sms" ? "메세지" : "알림톡";
      feedback.success(
        `${sendToLabel} ${modeLabel} 발송 예정 ${totalEnqueued}건입니다.`
      );
      if (totalSkipped > 0) {
        feedback.info(`전화번호 없음으로 ${totalSkipped}건 제외되었습니다.`);
      }
      asyncStatusStore.completeTask(taskId, "success");
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

  const editorTabItems = [
    { key: "message", label: "메시지" },
    { key: "alimtalk", label: "알림톡" },
  ] as const;

  return (
    <AdminModal open={open} onClose={onClose} width={1000} onEnterConfirm={handleSend} className="send-message-modal">
      <ModalHeader title="메시지 발송" />
      <ModalBody>
        <div className="template-editor flex gap-5" style={{ minHeight: 420 }}>
          {/* ── 좌측: 수신자 정보 + 미리보기 ── */}
          <div
            className="template-editor__left shrink-0 flex flex-col gap-4 p-4 overflow-hidden"
            style={{ width: 300 }}
          >
            {/* 수신자 정보 */}
            <section>
              <div className="template-editor__blocks-title mb-1">수신자</div>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                  color: "var(--color-primary)",
                }}
              >
                {label}
              </span>
              {!hasRecipients && (
                <p className="mt-2 text-xs" style={{ color: "var(--color-status-warning, #d97706)" }}>
                  수신자를 선택한 뒤 메시지 발송 버튼을 눌러 주세요.
                </p>
              )}
            </section>

            {/* 미리보기 */}
            <section>
              <div className="template-editor__preview-title mb-2">
                실제 수신자에게 이렇게 보입니다
              </div>
              {activeTab === "message" ? (
                <div className="template-preview-phone" aria-label="아이폰 메시지 미리보기">
                  <div className="template-preview-phone__screen">
                    <div className="template-preview-phone__bubble" style={{ lineHeight: 1.7 }}>
                      {body ? badgeBody : (
                        <span className="template-editor__preview-placeholder">본문을 입력하면 미리보기가 표시됩니다.</span>
                      )}
                    </div>
                    <div className="template-preview-phone__time">오전 9:00</div>
                  </div>
                </div>
              ) : (
                <div className="template-preview-kakao" aria-label="카카오톡 알림톡 미리보기">
                  <div className="template-preview-kakao__card">
                    {subject && (
                      <div className="template-preview-kakao__title" style={{ lineHeight: 1.7 }}>{badgeSubject}</div>
                    )}
                    <div className="template-preview-kakao__body" style={{ lineHeight: 1.7 }}>
                      {body ? badgeBody : (
                        <span className="template-editor__preview-placeholder">본문을 입력하면 미리보기가 표시됩니다.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                {activeTab === "message" ? "아이폰 메시지 예시" : "카카오톡 알림톡 예시"} (치환 변수는 샘플 값)
              </p>
            </section>
          </div>

          {/* ── 우측: 편집 영역 ── */}
          <div className="template-editor__right flex-1 min-w-0 flex flex-col gap-2 p-4">
            {/* 메시지/알림톡 탭 */}
            <div className="modal-tabs-elevated template-editor__tabs template-editor__tabs--top">
              <Tabs
                value={activeTab}
                onChange={(k) => setActiveTab(k as EditorTab)}
                items={editorTabItems}
              />
            </div>

            {/* 발송 방식 + 수신 대상 — 가로 배치 */}
            <div className="flex items-start gap-6">
              {/* 발송 방식: select dropdown */}
              <div className="shrink-0">
                <label className="template-editor__editor-title block mb-1">발송 방식</label>
                <select
                  value={sendMode}
                  onChange={(e) => setSendMode(e.target.value as SendMode)}
                  disabled={sending}
                  className="template-editor__textarea message-domain-input"
                  style={{
                    padding: "6px 12px",
                    fontSize: 14,
                    minWidth: 140,
                    cursor: "pointer",
                  }}
                >
                  <option value="both" disabled={!smsAllowed}>
                    둘 다 (모두){!smsAllowed ? " — SMS 미연동" : ""}
                  </option>
                  <option value="alimtalk">알림톡</option>
                  <option value="sms" disabled={!smsAllowed}>
                    SMS (메세지){!smsAllowed ? " — SMS 미연동" : ""}
                  </option>
                </select>
              </div>

              {/* 수신 대상 */}
              <div>
                <label className="template-editor__editor-title block mb-1">수신 대상</label>
                {isStaffMode ? (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                      color: "var(--color-primary)",
                    }}
                  >
                    직원
                  </span>
                ) : (
                  <div className="flex items-center gap-4" style={{ minHeight: 34 }}>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={sendToParent}
                        onChange={(e) => setSendToParent(e.target.checked)}
                        disabled={sending}
                      />
                      학부모
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={sendToStudent}
                        onChange={(e) => setSendToStudent(e.target.checked)}
                        disabled={sending}
                      />
                      학생
                    </label>
                    {sendToTargets.length === 0 && (
                      <span className="text-xs" style={{ color: "var(--color-status-warning, #d97706)" }}>
                        최소 1개 선택
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 내용 모드: 직접 입력 / 템플릿 불러오기 */}
            <div className="flex items-center gap-3">
              <label className="template-editor__editor-title shrink-0">내용</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    contentMode === "free"
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-fill-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-fill-tertiary)]"
                  }`}
                  onClick={() => {
                    setContentMode("free");
                    setSelectedTemplateId(null);
                  }}
                >
                  직접 입력
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    contentMode === "template"
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-fill-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-fill-tertiary)]"
                  }`}
                  onClick={() => setContentMode("template")}
                >
                  템플릿 불러오기
                </button>
              </div>
            </div>

            {/* 템플릿 선택 영역 */}
            {contentMode === "template" && templates.length > 0 && (
              <div className="p-3 rounded-lg" style={{ background: "var(--color-fill-secondary)" }}>
                <div className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>저장된 템플릿 선택</div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <Button
                      key={t.id}
                      intent={selectedTemplateId === t.id ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => handleLoadTemplate(t)}
                    >
                      {t.name}
                      {t.category !== "default" && (
                        <span className="ml-1 opacity-80">
                          ({TEMPLATE_CATEGORY_LABELS[t.category as MessageTemplateCategory]})
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* 제목 (알림톡 탭에서만 표시) — 고정 높이 슬롯 */}
            <div className={`template-editor__subject-slot ${showSubject ? "template-editor__subject-slot--has-subject" : ""}`}>
              {showSubject ? (
                <>
                  <label className="template-editor__editor-title block mb-1">제목 (알림톡)</label>
                  <Input
                    placeholder="알림톡 제목"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={sending}
                    className="template-editor__textarea message-domain-input"
                  />
                </>
              ) : (
                <div className="template-editor__subject-placeholder" aria-hidden />
              )}
            </div>

            {/* 본문 — 2패널: 좌측 입력 | 우측 삽입 블록 (TemplateEditModal 패턴) */}
            <div className="template-editor__body-row flex-1 min-h-0 flex gap-4">
              <div ref={bodyWrapRef} className="template-editor__body-input flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <label className="template-editor__editor-title">
                    본문
                  </label>
                  {(() => {
                    const info = getCharLabel(body.length);
                    if (!info) return null;
                    return (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color:
                            info.tone === "ok"
                              ? "var(--color-text-muted)"
                              : info.tone === "lms"
                              ? "var(--color-primary)"
                              : "var(--color-error)",
                        }}
                      >
                        {info.label}
                      </span>
                    );
                  })()}
                </div>
                <Input.TextArea
                  placeholder="내용을 입력하세요. 오른쪽 블록을 클릭하면 치환 변수가 삽입됩니다."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  disabled={sending}
                  className="template-editor__textarea message-domain-input w-full p-3"
                  style={{ resize: "vertical", fontFamily: "inherit", minHeight: 200 }}
                />
              </div>
              <div className="template-editor__body-blocks shrink-0 flex flex-col" style={{ width: 220 }}>
                <div className="template-editor__blocks-title mb-2">삽입 블록</div>
                <div className="template-editor__block-list flex flex-wrap gap-2 content-start overflow-auto p-1">
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
                        style={{ background: bc.bg, color: bc.color, borderColor: bc.border }}
                      >
                        {block.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={sending}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={handleSend}
              disabled={!canSend || sending}
            >
              {sending ? "발송 중…" : "발송하기"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
