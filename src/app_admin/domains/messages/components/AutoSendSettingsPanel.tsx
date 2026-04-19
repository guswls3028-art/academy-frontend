// PATH: src/app_admin/domains/messages/components/AutoSendSettingsPanel.tsx
// 재사용 가능한 자동발송 설정 패널 — Clinic Settings, Community Settings, Staff Settings 등에서 사용

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "antd";
import { FiZap, FiEdit3 } from "react-icons/fi";
import { Eye } from "lucide-react";
import {
  fetchAutoSendConfigs,
  fetchMessageTemplates,
  fetchMessageTemplate,
  updateAutoSendConfigs,
  updateMessageTemplate,
  createMessageTemplate,
  deleteMessageTemplate,
  type AutoSendConfigItem,
  AUTO_SEND_TRIGGER_LABELS,
  type MessageTemplateItem,
  type MessageTemplatePayload,
} from "../api/messages.api";
import { useMessagingInfo } from "../hooks/useMessagingInfo";
import { MESSAGE_MODE_LABELS } from "../constants/messageSendOptions";
import { AUTO_SEND_SECTIONS } from "./AutoSendSectionTree";
import TemplateEditModal from "./TemplateEditModal";
import AutoSendPreviewPopup from "./AutoSendPreviewPopup";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import "../styles/templateEditor.css";

// ---------------------------------------------------------------------------
// 트리거 설명 (모든 트리거 포함)
// ---------------------------------------------------------------------------

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  registration_approved_student:
    "학생 등록·가입 승인 시 학생에게 아이디/비밀번호 및 접속 안내를 알림톡으로 발송합니다.",
  registration_approved_parent:
    "학생 등록·가입 승인 시 학부모에게 학부모+학생 로그인 정보를 알림톡으로 발송합니다.",
  withdrawal_complete:
    "퇴원 처리가 완료되면 학생·학부모에게 퇴원 확인 메시지를 발송합니다.",
  lecture_session_reminder:
    "수업 시작 전 학생·학부모에게 수업 일시/교실/강사를 리마인드합니다. 분 전 설정 필수.",
  check_in_complete:
    "입실(출석) 처리가 완료되면 학부모에게 출석 확인 알림을 발송합니다.",
  absent_occurred:
    "결석이 확인되면 학부모에게 결석 알림을 즉시 발송합니다.",
  exam_scheduled_days_before:
    "시험 예정일 N일 전에 학생·학부모에게 시험명/일정을 안내합니다.",
  exam_start_minutes_before:
    "시험 시작 N분 전에 학생에게 시험 시작 리마인드를 발송합니다.",
  exam_not_taken:
    "시험 미응시가 확인되면 학생·학부모에게 미응시 알림을 발송합니다.",
  exam_score_published:
    "성적이 공개되면 학생·학부모에게 성적/평균/등급을 안내합니다.",
  retake_assigned:
    "재시험 대상으로 지정되면 학생·학부모에게 재시험 일정을 안내합니다.",
  assignment_registered:
    "새 과제가 등록되면 학생에게 과제명/마감일을 안내합니다.",
  assignment_due_hours_before:
    "과제 마감 N시간 전에 학생에게 미제출 리마인드를 발송합니다.",
  assignment_not_submitted:
    "과제 미제출이 확인되면 학생·학부모에게 미제출 알림을 발송합니다.",
  monthly_report_generated:
    "월간 성적 리포트가 생성되면 학부모에게 성적 요약을 발송합니다.",
  clinic_reminder:
    "클리닉 시작 N분 전에 학생에게 예약 일시/장소를 리마인드합니다.",
  clinic_reservation_created:
    "클리닉 예약이 완료되면 학생·학부모에게 예약 일시를 확인 안내합니다.",
  clinic_reservation_changed:
    "클리닉 예약이 변경/취소되면 학생·학부모에게 변경 내용을 안내합니다.",
  clinic_check_in:
    "\"참석\" 버튼을 누르면 학부모에게 입실 알림을 발송합니다.",
  clinic_absent:
    "\"결석\" 처리 시 학부모에게 결석 알림을 발송합니다.",
  clinic_self_study_completed:
    "\"완료\" 버튼을 누르면 학부모에게 하원(완료) 안내를 발송합니다.",
  clinic_cancelled:
    "클리닉 예약이 취소되면 학부모에게 취소 안내를 발송합니다.",
  clinic_result_notification:
    "시험/과제 통과로 클리닉 대상이 해소되면 결과를 안내합니다.",
  counseling_reservation_created:
    "상담 예약이 완료되면 학부모에게 상담 일시/장소를 확인 안내합니다.",
  payment_complete:
    "결제가 완료되면 학부모에게 결제 금액/내역을 확인 안내합니다.",
  payment_due_days_before:
    "납부 예정일 N일 전에 학부모에게 납부 금액/기한을 안내합니다.",
  // urgent_notice: 카카오 알림톡 정책 위반으로 제거
  qna_answer_registered:
    "QnA 답변이 등록되면 질문 작성 학생·학부모에게 답변 안내를 발송합니다.",
  counsel_approved:
    "상담 신청이 승인되면 신청 학생·학부모에게 승인 안내를 발송합니다.",
  staff_attendance_summary:
    "근태 요약이 생성되면 해당 직원에게 근무 시간/일수 요약을 발송합니다.",
  staff_expense_report:
    "비용/경비 리포트가 생성되면 해당 직원에게 경비 내역을 발송합니다.",
  staff_month_close:
    "월 마감이 완료되면 해당 직원에게 마감 확인 안내를 발송합니다.",
  staff_payroll_snapshot:
    "급여 스냅샷이 생성되면 해당 직원에게 급여 요약을 발송합니다.",
  staff_payroll_report:
    "급여 명세서가 발행되면 해당 직원에게 명세서를 발송합니다.",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** 리마인더 트리거 — "N분/시간/일 전" 발송 시점 설정이 의미 있는 트리거만 */
const REMINDER_TRIGGERS = new Set([
  "clinic_reminder",
  "lecture_session_reminder",
  "exam_start_minutes_before",
  "exam_scheduled_days_before",
  "assignment_due_hours_before",
  "payment_due_days_before",
]);

/** 트리거별 시간 단위 라벨 */
const REMINDER_UNIT_LABEL: Record<string, string> = {
  exam_scheduled_days_before: "일 전",
  assignment_due_hours_before: "시간 전",
  payment_due_days_before: "일 전",
};

function getReminderUnit(trigger: string): string {
  return REMINDER_UNIT_LABEL[trigger] ?? "분 전";
}

export type AutoSendSettingsPanelProps = {
  /** Which triggers to show (filter from all auto-send configs) */
  triggerKeys: string[];
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /**
   * Channel filter mode. When set, the panel manages only the specified channel:
   * - "alimtalk": shows alimtalk channel state per trigger
   * - "sms": shows SMS channel state per trigger
   * - undefined: unified mode (original behavior with message_mode dropdown)
   */
  channelMode?: "alimtalk" | "sms";
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const QUERY_KEY = ["messaging", "auto-send"] as const;
const TEMPLATES_KEY = ["messaging", "templates"] as const;
const EMPTY_CONFIGS: AutoSendConfigItem[] = [];

// ---------------------------------------------------------------------------
// TriggerCard (inner component — same pattern as MessageAutoSendPage)
// ---------------------------------------------------------------------------

/** channel-aware 활성 상태 판별 — "both" 모드는 두 채널 모두 활성 */
function isChannelActive(mode: string, channel: "alimtalk" | "sms"): boolean {
  if (mode === "both") return true;
  return mode === channel;
}

/** channel toggle → message_mode 도출 */
function deriveMessageMode(
  currentMode: string,
  _currentEnabled: boolean,
  channel: "alimtalk" | "sms",
  turnOn: boolean,
): { message_mode: "sms" | "alimtalk" | "both"; enabled: boolean } {
  if (turnOn) {
    // 다른 채널이 이미 활성이면 "both"로, 아니면 해당 채널만
    const otherChannel = channel === "alimtalk" ? "sms" : "alimtalk";
    if (currentMode === otherChannel || currentMode === "both") {
      return { message_mode: "both", enabled: true };
    }
    return { message_mode: channel, enabled: true };
  } else {
    // 끄기: "both"에서 하나 빼면 나머지 채널만, 단일이면 비활성화
    if (currentMode === "both") {
      const remaining = channel === "alimtalk" ? "sms" : "alimtalk";
      return { message_mode: remaining, enabled: true };
    }
    return { message_mode: currentMode as "sms" | "alimtalk", enabled: false };
  }
}

function TriggerCard({
  config,
  templates,
  onUpdate,
  saving,
  onEditTemplate,
  smsConnected,
  channelMode,
}: {
  config: AutoSendConfigItem;
  templates: MessageTemplateItem[];
  onUpdate: (c: Partial<AutoSendConfigItem>, debounce?: boolean) => void;
  saving: boolean;
  onEditTemplate?: (trigger: string, templateId: number | null) => void;
  smsConnected: boolean;
  channelMode?: "alimtalk" | "sms";
}) {
  const [showPreview, setShowPreview] = useState(false);
  const hasTemplate = !!config.template;
  const status = config.template_solapi_status;

  const statusColor =
    status === "APPROVED"
      ? "var(--color-status-success, #16a34a)"
      : status === "PENDING"
        ? "var(--color-status-warning, #d97706)"
        : "var(--color-status-danger, #dc2626)";

  const statusBg =
    status === "APPROVED"
      ? "color-mix(in srgb, var(--color-status-success, #16a34a) 10%, transparent)"
      : status === "PENDING"
        ? "color-mix(in srgb, var(--color-status-warning, #d97706) 10%, transparent)"
        : "color-mix(in srgb, var(--color-status-danger, #dc2626) 10%, transparent)";

  const statusLabel =
    status === "APPROVED"
      ? "승인"
      : status === "PENDING"
        ? "검수대기"
        : status === "REJECTED"
          ? "반려"
          : status || "";

  const handleEditClick = () => {
    onEditTemplate?.(config.trigger, config.template);
  };

  // channel-aware: is THIS channel active for this trigger?
  const channelActive = channelMode
    ? config.enabled && isChannelActive(config.message_mode, channelMode)
    : config.enabled;

  const handleChannelToggle = (checked: boolean) => {
    if (!channelMode) {
      // unified mode — simple enable/disable
      onUpdate({ ...config, enabled: checked });
      return;
    }
    const { message_mode, enabled } = deriveMessageMode(
      config.message_mode,
      config.enabled,
      channelMode,
      checked,
    );
    onUpdate({ ...config, message_mode, enabled });
  };

  const isReminder = REMINDER_TRIGGERS.has(config.trigger);

  return (
    <div
      className={panelStyles.contentCard}
      style={{
        background: channelActive
          ? "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface))"
          : "var(--color-bg-surface-soft)",
        boxShadow: channelActive
          ? "inset 3px 0 0 var(--color-primary)"
          : undefined,
        transition: "background 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Header: trigger name + enable toggle */}
      <div className={panelStyles.contentCardHeader}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: channelActive
                ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                : "var(--color-bg-surface-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: channelActive
                ? "var(--color-primary)"
                : "var(--color-text-muted)",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <FiZap size={16} aria-hidden />
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.1px",
              }}
            >
              {AUTO_SEND_TRIGGER_LABELS[config.trigger] ?? config.trigger}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginTop: 2,
                lineHeight: 1.45,
              }}
            >
              {TRIGGER_DESCRIPTIONS[config.trigger] ??
                "해당 이벤트 발생 시 자동 발송합니다."}
            </div>
          </div>
        </div>

        {/* Enable/disable toggle */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <Switch
            checked={channelActive}
            onChange={handleChannelToggle}
            disabled={saving}
            size="small"
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: channelActive
                ? "var(--color-text-primary)"
                : "var(--color-text-muted)",
            }}
          >
            {channelActive ? "활성화" : "비활성화"}
          </span>
          {config.template_body && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              aria-label="미리보기"
              title="알림톡 미리보기"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-primary)",
                background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
                borderRadius: "var(--radius-sm, 4px)",
                cursor: "pointer",
                transition: "background 0.12s",
                whiteSpace: "nowrap",
              }}
            >
              <Eye size={12} />
              미리보기
            </button>
          )}
        </div>
      </div>

      {/* Controls area */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: channelMode
            ? isReminder ? "1fr 120px" : "1fr"
            : isReminder ? "1fr 120px 160px" : "1fr 160px",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Template — click to open edit modal */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              marginBottom: 6,
              textTransform: "uppercase" as const,
              letterSpacing: "0.04em",
            }}
          >
            템플릿
          </div>
          <button
            type="button"
            onClick={handleEditClick}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              height: 36,
              padding: "0 12px",
              fontSize: 13,
              fontWeight: 500,
              textAlign: "left",
              color: "var(--color-text-primary)",
              background:
                "color-mix(in srgb, var(--color-border-divider) 10%, var(--color-bg-surface))",
              border: "1px solid var(--color-border-divider)",
              borderRadius: "var(--radius-md)",
              boxShadow:
                "inset 0 2px 4px rgba(0,0,0,.06), inset 0 -1px 0 0 rgba(255,255,255,.04)",
              cursor: "pointer",
              transition: "border-color 120ms, box-shadow 120ms",
            }}
          >
            <FiEdit3
              size={13}
              style={{ flexShrink: 0, color: "var(--color-primary)" }}
              aria-hidden
            />
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              수정하기
            </span>
            {hasTemplate && status && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                  padding: "3px 7px",
                  borderRadius: 10,
                  flexShrink: 0,
                  background: statusBg,
                  color: statusColor,
                  letterSpacing: "-0.01em",
                }}
              >
                {statusLabel}
              </span>
            )}
          </button>
        </div>

        {/* Send timing (minutes before) — only for reminder triggers */}
        {isReminder && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                marginBottom: 6,
                textTransform: "uppercase" as const,
                letterSpacing: "0.04em",
              }}
            >
              발송 시점
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                min={0}
                step={5}
                placeholder="0"
                className="ds-input"
                style={{
                  width: 72,
                  fontSize: 13,
                  textAlign: "right",
                  paddingRight: 8,
                }}
                value={config.minutes_before ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdate(
                    {
                      ...config,
                      minutes_before:
                        v === ""
                          ? null
                          : Math.max(0, parseInt(v, 10) || 0),
                    },
                    true,
                  );
                }}
                disabled={saving}
                aria-label={`발송 시점 (${getReminderUnit(config.trigger)})`}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {getReminderUnit(config.trigger)}
              </span>
            </div>
          </div>
        )}

        {/* Send mode (sms / alimtalk / both) — only in unified mode (no channelMode) */}
        {!channelMode && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                marginBottom: 6,
                textTransform: "uppercase" as const,
                letterSpacing: "0.04em",
              }}
            >
              발송 채널
            </div>
            <select
              className="ds-select"
              style={{ width: "100%", fontSize: 13 }}
              value={!smsConnected && config.message_mode !== "alimtalk" ? "alimtalk" : config.message_mode}
              onChange={(e) =>
                onUpdate({
                  ...config,
                  message_mode: e.target
                    .value as AutoSendConfigItem["message_mode"],
                })
              }
              disabled={saving}
            >
              <option value="alimtalk">
                {MESSAGE_MODE_LABELS.alimtalk}
              </option>
              {smsConnected && (
                <option value="sms">{MESSAGE_MODE_LABELS.sms}</option>
              )}
              {smsConnected && (
                <option value="both">{MESSAGE_MODE_LABELS.both}</option>
              )}
            </select>
          </div>
        )}
      </div>
      {/* 클리닉 출석/결석: 시간 표시 모드 토글 */}
      {(config.trigger === "clinic_check_in" || config.trigger === "clinic_absent") && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
            border: "1px solid color-mix(in srgb, var(--color-primary) 10%, transparent)",
          }}
        >
          <Switch
            size="small"
            checked={config.show_actual_time ?? false}
            onChange={(checked) => onUpdate({ ...config, show_actual_time: checked })}
            disabled={saving}
          />
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            알림톡 <strong>시간 항목</strong>에 실제 {config.trigger === "clinic_check_in" ? "도착" : "처리"} 시각 표시
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: config.show_actual_time ? "var(--color-primary)" : "var(--color-text-muted)",
            marginLeft: "auto",
            whiteSpace: "nowrap",
          }}>
            {config.show_actual_time ? "→ 버튼 누른 시각" : "→ 수업 예정 시간"}
          </span>
        </div>
      )}
      <AutoSendPreviewPopup
        open={showPreview}
        onClose={() => setShowPreview(false)}
        trigger={config.trigger}
        subject={config.template_subject ?? ""}
        body={config.template_body ?? ""}
        previewContext={{}}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutoSendSettingsPanel (main exported component)
// ---------------------------------------------------------------------------

export default function AutoSendSettingsPanel({
  triggerKeys,
  title = "자동발송 설정",
  description = "이벤트 발생 시 자동 발송하는 메시지를 설정합니다.",
  channelMode,
}: AutoSendSettingsPanelProps) {
  const qc = useQueryClient();
  const { data: messagingInfo } = useMessagingInfo();
  const smsConnected = !!messagingInfo?.sms_allowed;

  // ---- Data fetching ----
  const { data: allConfigs = EMPTY_CONFIGS, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAutoSendConfigs,
    staleTime: 30_000,
  });

  const { data: templates = [] } = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => fetchMessageTemplates(),
    staleTime: 30_000,
  });

  // ---- Local state (optimistic updates) ----
  const [localConfigs, setLocalConfigs] = useState<AutoSendConfigItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalConfigs(allConfigs);
  }, [allConfigs]);

  // Filter to only the triggers this panel cares about
  const filteredConfigs = localConfigs.filter((c) =>
    triggerKeys.includes(c.trigger),
  );

  const sectionEnabled = channelMode
    ? filteredConfigs.length > 0 && filteredConfigs.some((c) => c.enabled && isChannelActive(c.message_mode, channelMode))
    : filteredConfigs.length > 0 && filteredConfigs.some((c) => c.enabled);

  // ---- Mutations ----
  const updateMut = useMutation({
    mutationFn: updateAutoSendConfigs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      feedback.success("자동발송 설정이 저장되었습니다.");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : null;
      feedback.error(msg || "저장에 실패했습니다.");
    },
  });

  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplateItem | null>(null);
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null);
  const [creatingForTrigger, setCreatingForTrigger] = useState<string | null>(
    null,
  );

  const editTemplateMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) => {
      if (!editingTemplate) throw new Error("no template");
      return updateMessageTemplate(editingTemplate.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setEditingTemplate(null);
      feedback.success(
        "템플릿이 수정되었습니다. 알림톡은 재검수가 필요할 수 있습니다.",
      );
    },
    onError: () => {
      feedback.error("템플릿 수정에 실패했습니다.");
    },
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: number) => deleteMessageTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setEditingTemplate(null);
      feedback.success("템플릿이 삭제되었습니다.");
    },
    onError: () => {
      feedback.error("삭제에 실패했습니다.");
    },
  });

  const createTemplateMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) =>
      createMessageTemplate(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      if (creatingForTrigger && created?.id) {
        const next = localConfigs.map((c) =>
          c.trigger === creatingForTrigger
            ? { ...c, template: created.id }
            : c,
        );
        setLocalConfigs(next);
        updateMut.mutate(next);
      }
      setCreatingForTrigger(null);
      feedback.success("템플릿이 생성되었습니다.");
    },
    onError: () => {
      feedback.error("템플릿 생성에 실패했습니다.");
    },
  });

  // ---- Handlers ----
  const handleUpdate = (
    updated: Partial<AutoSendConfigItem>,
    debounce = false,
  ) => {
    const next = localConfigs.map((c) =>
      c.trigger === updated.trigger ? { ...c, ...updated } : c,
    );
    setLocalConfigs(next);
    if (debounce) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => updateMut.mutate(next), 600);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      updateMut.mutate(next);
    }
  };

  const handleSectionToggle = (checked: boolean) => {
    const next = localConfigs.map((c) => {
      if (!triggerKeys.includes(c.trigger)) return c;
      if (!channelMode) {
        // unified mode: simple enable/disable
        return { ...c, enabled: checked };
      }
      // channel mode: toggle this channel for all triggers
      const { message_mode, enabled } = deriveMessageMode(
        c.message_mode,
        c.enabled,
        channelMode,
        checked,
      );
      return { ...c, message_mode, enabled };
    });
    setLocalConfigs(next);
    updateMut.mutate(next);
  };

  const handleEditTemplate = (trigger: string, templateId: number | null) => {
    if (!templateId) {
      setCreatingForTrigger(trigger);
      return;
    }
    setEditingTrigger(trigger);
    const cached = templates.find((t) => t.id === templateId);
    if (cached) {
      setEditingTemplate(cached);
    } else {
      fetchMessageTemplate(templateId)
        .then((tpl) => setEditingTemplate(tpl))
        .catch(() => feedback.error("템플릿 정보를 불러올 수 없습니다."));
    }
  };

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>{title}</h2>
          <p className={panelStyles.headerDesc}>{description}</p>
        </div>
        <div style={{ padding: "var(--space-5)" }}>
          <div className={panelStyles.contentInner}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={panelStyles.skeletonCard} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Empty state (no matching triggers) ----
  if (filteredConfigs.length === 0) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>{title}</h2>
          <p className={panelStyles.headerDesc}>{description}</p>
        </div>
        <div className={panelStyles.placeholder}>
          <FiZap
            size={36}
            style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
          />
          <p className={panelStyles.placeholderTitle} style={{ marginTop: 16 }}>
            자동발송 설정이 아직 구성되지 않았습니다
          </p>
          <p className={panelStyles.placeholderDesc}>
            메시지 &gt; 자동발송 페이지에서 기본 템플릿을 먼저 생성해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // ---- Main render ----
  return (
    <>
      <div className={panelStyles.root}>
        {/* Section header with title, description, and master toggle */}
        <div className={panelStyles.header}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <h2 className={panelStyles.headerTitle}>{title}</h2>
              <p className={panelStyles.headerDesc}>{description}</p>
            </div>

            {/* Section-level on/off toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                background: sectionEnabled
                  ? "color-mix(in srgb, var(--color-status-success, #16a34a) 8%, var(--color-bg-surface))"
                  : "var(--color-bg-surface-soft)",
                border: `1px solid ${
                  sectionEnabled
                    ? "color-mix(in srgb, var(--color-status-success, #16a34a) 25%, var(--color-border-divider))"
                    : "var(--color-border-divider)"
                }`,
                borderRadius: "var(--radius-md)",
                flexShrink: 0,
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <Switch
                checked={sectionEnabled}
                onChange={handleSectionToggle}
                disabled={
                  updateMut.isPending || filteredConfigs.length === 0
                }
                size="small"
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: sectionEnabled
                    ? "var(--color-status-success, #16a34a)"
                    : "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {sectionEnabled ? "전체 활성화" : "전체 비활성화"}
              </span>
            </div>
          </div>
        </div>

        {/* Trigger cards */}
        <div style={{ padding: "var(--space-5)" }}>
          <div className={panelStyles.contentInner}>
            {filteredConfigs.map((config) => (
              <TriggerCard
                key={config.trigger}
                config={config}
                templates={templates}
                onUpdate={handleUpdate}
                saving={updateMut.isPending}
                onEditTemplate={handleEditTemplate}
                smsConnected={smsConnected}
                channelMode={channelMode}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Edit template modal */}
      <TemplateEditModal
        open={editingTemplate !== null}
        onClose={() => { setEditingTemplate(null); setEditingTrigger(null); }}
        category={editingTemplate?.category ?? "default"}
        initial={editingTemplate}
        onSubmit={(payload) => editTemplateMut.mutate(payload)}
        isPending={editTemplateMut.isPending}
        smsConnected={smsConnected}
        onDelete={(id) => deleteTemplateMut.mutate(id)}
        isDeleting={deleteTemplateMut.isPending}
        trigger={editingTrigger ?? undefined}
      />

      {/* Create template modal (for triggers without a linked template) */}
      <TemplateEditModal
        open={creatingForTrigger !== null}
        onClose={() => setCreatingForTrigger(null)}
        category={
          AUTO_SEND_SECTIONS.find((s) =>
            s.triggers.includes(creatingForTrigger ?? ""),
          )?.id ?? "default"
        }
        initial={null}
        onSubmit={(payload) => createTemplateMut.mutate(payload)}
        isPending={createTemplateMut.isPending}
        smsConnected={smsConnected}
        trigger={creatingForTrigger ?? undefined}
      />
    </>
  );
}
