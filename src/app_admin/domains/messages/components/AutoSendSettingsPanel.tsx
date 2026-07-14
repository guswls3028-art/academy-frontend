// PATH: src/app_admin/domains/messages/components/AutoSendSettingsPanel.tsx
// 재사용 가능한 자동발송 설정 패널 — Clinic Settings, Community Settings, Staff Settings 등에서 사용

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { AUTO_SEND_SECTIONS } from "./AutoSendSectionTree";
import TemplateEditModal from "./TemplateEditModal";
import AutoSendPreviewPopup from "./AutoSendPreviewPopup";
import AutoSendTimingControl from "./AutoSendTimingControl";
import { AlimtalkEnvelopeGuide, AlimtalkTriggerEnvelope } from "./AlimtalkEnvelopeGuide";
import { getAlimtalkTemplateType } from "../constants/alimtalkEnvelope";
import {
  canUseDelayTiming,
  isReminderTrigger,
} from "../utils/autoSendTiming";
import {
  canBulkToggleAutoSendConfig,
  getEffectiveTemplateStatus,
  getEffectiveTemplateStatusLabel,
  getAutoSendSummary,
  isAllToggleableEnabled,
  type AutoSendSummary,
} from "../utils/autoSendConfigState";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { messageQueryKeys } from "../queryKeys";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import "../styles/templateEditor.css";
import styles from "./AutoSendSettingsPanel.module.css";

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
  qna_answered:
    "QnA 답변이 등록되면 질문 작성 학생·학부모에게 답변 안내를 발송합니다.",
  counsel_answered:
    "상담 답변이 등록되면 신청 학생·학부모에게 답변 안내를 발송합니다.",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AutoSendSettingsPanelProps = {
  /** Which triggers to show (filter from all auto-send configs) */
  triggerKeys: string[];
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /**
   * Channel filter mode. Kept for settings pages; alimtalk is the only active channel.
   */
  channelMode?: "alimtalk";
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const EMPTY_CONFIGS: AutoSendConfigItem[] = [];

// ---------------------------------------------------------------------------
// TriggerCard (inner component — same pattern as MessageAutoSendPage)
// ---------------------------------------------------------------------------

/** channel-aware 활성 상태 판별 — 알림톡 전용 */
function isChannelActive(mode: string, _channel: "alimtalk"): boolean {
  void _channel;
  return mode === "alimtalk";
}

/** channel toggle → message_mode 도출 */
function deriveMessageMode(
  _currentMode: string,
  _currentEnabled: boolean,
  _channel: "alimtalk",
  turnOn: boolean,
): { message_mode: "alimtalk"; enabled: boolean } {
  return { message_mode: "alimtalk", enabled: turnOn };
}

function TriggerCard({
  config,
  onUpdate,
  saving,
  onEditTemplate,
  channelMode,
  operationalDisabled,
}: {
  config: AutoSendConfigItem;
  onUpdate: (c: Partial<AutoSendConfigItem>, debounce?: boolean) => void;
  saving: boolean;
  onEditTemplate?: (trigger: string, templateId: number | null) => void;
  channelMode?: "alimtalk";
  operationalDisabled: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const hasTemplate = Boolean(config.template || config.effective_template_is_approved);
  const status = getEffectiveTemplateStatus(config);
  const statusLabel = getEffectiveTemplateStatusLabel(config);
  const isSystem = config.policy_mode === "SYSTEM_AUTO";
  const deliveryReady = !operationalDisabled && Boolean(config.effective_template_is_approved);

  const handleEditClick = () => {
    onEditTemplate?.(config.trigger, config.template);
  };

  // channel-aware: is THIS channel active for this trigger?
  const channelActive = channelMode
    ? deliveryReady && config.enabled && isChannelActive(config.message_mode, channelMode)
    : deliveryReady && (isSystem || config.enabled);

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

  const isReminder = isReminderTrigger(config.trigger);
  const implStatus = config.implementation_status;
  const isUnimplemented = implStatus === "manual_only" || implStatus === "disabled";
  const unimplementedHint = implStatus === "disabled"
    ? "정책상 비활성 — 발송되지 않습니다"
    : implStatus === "manual_only"
      ? "직접 발송에서만 사용할 수 있습니다"
      : "";
  const hasTimingControl = isReminder || canUseDelayTiming(config);
  const controlsLayout = channelMode
    ? hasTimingControl ? "channel-reminder" : "channel"
    : hasTimingControl ? "unified-reminder" : "unified";
  const envelopeType = config.effective_template_type || getAlimtalkTemplateType(config.trigger);

  return (
    <div
      className={`${panelStyles.contentCard} ${styles.triggerCard}`}
      data-channel-active={channelActive ? "true" : "false"}
      data-unimplemented={isUnimplemented ? "true" : "false"}
    >
      {/* Header: trigger name + enable toggle */}
      <div className={panelStyles.contentCardHeader}>
        <div className={styles.triggerHeaderInfo}>
          <div
            className={styles.triggerIcon}
            data-channel-active={channelActive ? "true" : "false"}
          >
            <FiZap size={16} aria-hidden />
          </div>
          <div>
            <div className={styles.triggerTitle}>
              {AUTO_SEND_TRIGGER_LABELS[config.trigger] ?? config.trigger}
            </div>
            <div className={styles.triggerDescription}>
              {TRIGGER_DESCRIPTIONS[config.trigger] ??
                "해당 이벤트 발생 시 자동 발송합니다."}
            </div>
            {isUnimplemented && (
              <div className={styles.unimplementedHint}>
                ⚠ {unimplementedHint}
              </div>
            )}
          </div>
        </div>

        {/* Enable/disable toggle */}
        <div className={styles.cardActions}>
          <Switch
            checked={channelActive}
            onChange={handleChannelToggle}
            disabled={operationalDisabled || saving || isUnimplemented || isSystem || !config.effective_template_is_approved}
            aria-label={`${AUTO_SEND_TRIGGER_LABELS[config.trigger] ?? config.trigger} 자동 발송`}
            size="small"
          />
          <span
            className={styles.channelState}
            data-channel-active={channelActive ? "true" : "false"}
          >
            {operationalDisabled ? "운영 중지" : !deliveryReady ? "발송 준비 필요" : isSystem ? "항상 활성" : channelActive ? "활성화" : "비활성화"}
          </span>
          {config.template_body && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              aria-label="미리보기"
              title="알림톡 미리보기"
              className={styles.previewButton}
            >
              <Eye size={12} />
              미리보기
            </button>
          )}
        </div>
      </div>

      {/* Controls area */}
      <AlimtalkTriggerEnvelope
        templateType={envelopeType}
        fallbackTrigger={AUTO_SEND_TRIGGER_LABELS[config.trigger] ?? config.trigger}
        body={config.template_body}
        templateName={config.template_name}
        templateReady={deliveryReady}
        templateSource={config.effective_template_source}
      />
      <div
        className={styles.controls}
        data-layout={controlsLayout}
      >
        {/* Template — click to open edit modal */}
        <div>
          <div className={styles.fieldLabel}>
            보낼 내용
          </div>
          <button
            type="button"
            onClick={handleEditClick}
            disabled={saving}
            className={styles.templateButton}
          >
            {config.template_is_system
              ? <Eye size={13} className={styles.templateEditIcon} aria-hidden />
              : <FiEdit3 size={13} className={styles.templateEditIcon} aria-hidden />}
            <span className={styles.templateButtonText}>
              {config.template_is_system ? "내용 보기" : "수정하기"}
            </span>
            {hasTemplate && status && (
              <span
                className={styles.statusBadge}
                data-status={status}
                title={
                  config.effective_template_source === "unified"
                    ? "현재 설정으로 발송됩니다."
                    : status === "MISSING"
                      ? "승인된 알림톡 양식이 연결되어야 발송할 수 있습니다."
                    : undefined
                }
              >
                {statusLabel}
              </span>
            )}
          </button>
        </div>

        {hasTimingControl && (
          <div>
            <div className={styles.fieldLabel}>
              발송 시점
            </div>
            <AutoSendTimingControl
              config={config}
              onUpdate={onUpdate}
              disabled={saving || isUnimplemented}
            />
          </div>
        )}

        {/* Send mode — only in unified mode (no channelMode) */}
        {!channelMode && (
          <div>
            <div className={styles.fieldLabel}>
              발송 채널
            </div>
            <select
              className={`ds-select ${styles.channelSelect}`}
              value="alimtalk"
              onChange={() =>
                onUpdate({
                  ...config,
                  message_mode: "alimtalk",
                })
              }
              disabled={saving || isUnimplemented}
            >
              <option value="alimtalk">알림톡</option>
            </select>
          </div>
        )}
      </div>
      {/* 클리닉 출석/결석: 시간 표시 모드 토글 */}
      {(config.trigger === "clinic_check_in" || config.trigger === "clinic_absent") && (
        <div className={styles.clinicTimeToggle}>
          <Switch
            size="small"
            checked={config.show_actual_time ?? false}
            onChange={(checked) => onUpdate({ ...config, show_actual_time: checked })}
            disabled={saving}
            aria-label={`${AUTO_SEND_TRIGGER_LABELS[config.trigger] ?? config.trigger} 실제 처리 시각 표시`}
          />
          <span className={styles.clinicTimeText}>
            알림톡 <strong>시간 항목</strong>에 실제 {config.trigger === "clinic_check_in" ? "도착" : "처리"} 시각 표시
          </span>
          <span
            className={styles.clinicTimeMode}
            data-show-actual-time={config.show_actual_time ? "true" : "false"}
          >
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

function getMasterToggleLabel(summary: AutoSendSummary): string {
  if (summary.toggleable === 0) return "변경 가능 항목 없음";
  if (isAllToggleableEnabled(summary)) return "설정 가능 항목 모두 활성";
  if (summary.enabledToggleable === 0) return "설정 가능 항목 모두 비활성";
  return `${summary.enabledToggleable}/${summary.toggleable} 활성`;
}

function AutoSendSummaryStrip({
  summary,
  saving,
}: {
  summary: AutoSendSummary;
  saving: boolean;
}) {
  return (
    <div className={styles.summaryStrip}>
      <span className={styles.summaryItem}>
        <span className={styles.summaryLabel}>활성</span>
        <strong>{summary.enabledToggleable}</strong>
        <span>/ {summary.toggleable}</span>
      </span>
      {summary.reviewWaiting > 0 && (
        <span className={styles.summaryItem} data-tone="warning">
          <span className={styles.summaryLabel}>확인 필요</span>
          <strong>{summary.reviewWaiting}</strong>
        </span>
      )}
      {summary.templateMissing > 0 && (
        <span className={styles.summaryItem} data-tone="warning">
          <span className={styles.summaryLabel}>내용 없음</span>
          <strong>{summary.templateMissing}</strong>
        </span>
      )}
      {summary.manualOnly > 0 && (
        <span className={styles.summaryItem}>
          <span className={styles.summaryLabel}>수동 전용</span>
          <strong>{summary.manualOnly}</strong>
        </span>
      )}
      {saving && <span className={styles.savingBadge}>저장 중</span>}
    </div>
  );
}

export default function AutoSendSettingsPanel({
  triggerKeys,
  title = "자동발송 설정",
  description = "이벤트 발생 시 자동 발송하는 메시지를 설정합니다.",
  channelMode,
}: AutoSendSettingsPanelProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: messagingInfo } = useMessagingInfo();
  const operationalDisabled = Boolean(messagingInfo?.messaging_disabled);

  // ---- Data fetching ----
  const { data: allConfigs = EMPTY_CONFIGS, isLoading, isError, refetch } = useQuery({
    queryKey: messageQueryKeys.autoSend,
    queryFn: fetchAutoSendConfigs,
    staleTime: 30_000,
  });

  const { data: templates = [] } = useQuery({
    queryKey: messageQueryKeys.templates,
    queryFn: () => fetchMessageTemplates(),
    staleTime: 30_000,
  });

  // ---- Local state (optimistic updates) ----
  const [localConfigs, setLocalConfigs] = useState<AutoSendConfigItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConfigsRef = useRef<Partial<AutoSendConfigItem>[]>([]);
  const hasPendingDebouncedSaveRef = useRef(false);

  useEffect(() => {
    setLocalConfigs(allConfigs);
  }, [allConfigs]);

  useEffect(() => {
    return () => {
      if (!hasPendingDebouncedSaveRef.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      hasPendingDebouncedSaveRef.current = false;
      if (pendingConfigsRef.current.length > 0) {
        void updateAutoSendConfigs(pendingConfigsRef.current).catch(() => undefined);
      }
    };
  }, []);

  // Filter to only the triggers this panel cares about
  const filteredConfigs = localConfigs.filter((c) =>
    triggerKeys.includes(c.trigger),
  );

  const isConfigEnabled = (config: AutoSendConfigItem) =>
    channelMode
      ? config.enabled && isChannelActive(config.message_mode, channelMode)
      : config.enabled;
  const sectionSummary = getAutoSendSummary(filteredConfigs, isConfigEnabled);
  const sectionEnabled = isAllToggleableEnabled(sectionSummary);

  // ---- Mutations ----
  const updateMut = useMutation({
    mutationFn: updateAutoSendConfigs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
      feedback.success("자동발송 설정이 저장되었습니다.");
    },
    onError: (err: unknown) => {
      pendingConfigsRef.current = [];
      hasPendingDebouncedSaveRef.current = false;
      setLocalConfigs(allConfigs);
      void qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
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
      qc.invalidateQueries({ queryKey: messageQueryKeys.templates });
      qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
      setEditingTemplate(null);
      feedback.success("보낼 내용이 수정되었습니다.");
    },
    onError: () => {
      feedback.error("내용 수정에 실패했습니다.");
    },
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: number) => deleteMessageTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageQueryKeys.templates });
      qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
      setEditingTemplate(null);
      feedback.success("보낼 내용이 삭제되었습니다.");
    },
    onError: () => {
      feedback.error("삭제에 실패했습니다.");
    },
  });

  const createTemplateMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) =>
      createMessageTemplate(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: messageQueryKeys.templates });
      if (creatingForTrigger && created?.id) {
        const next = localConfigs.map((c) =>
          c.trigger === creatingForTrigger
            ? { ...c, template: created.id }
            : c,
        );
        setLocalConfigs(next);
        updateMut.mutate([{ trigger: creatingForTrigger, template: created.id }]);
      }
      setCreatingForTrigger(null);
      feedback.success("보낼 내용이 생성되었습니다.");
    },
    onError: () => {
      feedback.error("내용 생성에 실패했습니다.");
    },
  });

  // ---- Handlers ----
  const queuePatch = (patch: Partial<AutoSendConfigItem>) => {
    if (!patch.trigger) return;
    const existing = pendingConfigsRef.current.find((c) => c.trigger === patch.trigger);
    pendingConfigsRef.current = [
      ...pendingConfigsRef.current.filter((c) => c.trigger !== patch.trigger),
      { ...existing, ...patch },
    ];
  };

  const takeQueuedPatches = () => {
    const patches = pendingConfigsRef.current;
    pendingConfigsRef.current = [];
    return patches;
  };

  const handleUpdate = (
    updated: Partial<AutoSendConfigItem>,
    debounce = false,
  ) => {
    const next = localConfigs.map((c) =>
      c.trigger === updated.trigger ? { ...c, ...updated } : c,
    );
    setLocalConfigs(next);
    queuePatch(updated);
    if (debounce) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      hasPendingDebouncedSaveRef.current = true;
      debounceRef.current = setTimeout(() => {
        hasPendingDebouncedSaveRef.current = false;
        updateMut.mutate(takeQueuedPatches());
      }, 600);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      hasPendingDebouncedSaveRef.current = false;
      updateMut.mutate(takeQueuedPatches());
    }
  };

  const handleSectionToggle = (checked: boolean) => {
    const next = localConfigs.map((c) => {
      if (!triggerKeys.includes(c.trigger)) return c;
      if (!canBulkToggleAutoSendConfig(c)) return c;
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
    const patches = next.flatMap((c, index) => {
      const prev = localConfigs[index];
      if (!prev || !triggerKeys.includes(c.trigger)) return [];
      const patch: Partial<AutoSendConfigItem> = { trigger: c.trigger };
      if (c.enabled !== prev.enabled) patch.enabled = c.enabled;
      if (c.message_mode !== prev.message_mode) patch.message_mode = c.message_mode;
      return Object.keys(patch).length > 1 ? [patch] : [];
    });
    setLocalConfigs(next);
    if (patches.length > 0) updateMut.mutate(patches);
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
        .catch(() => feedback.error("내용을 불러올 수 없습니다."));
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
        <div className={styles.cardsBody}>
          <div className={panelStyles.contentInner}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={panelStyles.skeletonCard} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>{title}</h2>
          <p className={panelStyles.headerDesc}>자동발송 설정을 불러오지 못했습니다.</p>
          <Button intent="secondary" onClick={() => void refetch()}>다시 시도</Button>
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
            className={styles.placeholderIcon}
          />
          <p className={`${panelStyles.placeholderTitle} ${styles.placeholderTitle}`}>
            자동발송 설정이 아직 구성되지 않았습니다
          </p>
          <p className={panelStyles.placeholderDesc}>
            메시지 &gt; 자동발송 페이지에서 기본 내용을 먼저 생성해 주세요.
          </p>
          <div className={panelStyles.placeholderAction}>
            <Button
              type="button"
              intent="primary"
              size="sm"
              onClick={() => navigate("/admin/message/auto-send")}
            >
              자동발송 페이지로 이동
            </Button>
          </div>
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
          <div className={styles.sectionHeaderRow}>
            <div>
              <h2 className={panelStyles.headerTitle}>{title}</h2>
              <p className={panelStyles.headerDesc}>{description}</p>
            </div>

            {/* Section-level on/off toggle */}
            <div
              className={styles.masterToggle}
              data-enabled={sectionEnabled ? "true" : "false"}
            >
              <Switch
                checked={sectionEnabled}
                onChange={handleSectionToggle}
                disabled={
                  operationalDisabled || updateMut.isPending || sectionSummary.toggleable === 0
                }
                aria-label={`${title} 전체 자동 발송`}
                size="small"
              />
              <span
                className={styles.masterToggleText}
                data-enabled={sectionEnabled ? "true" : "false"}
              >
                {operationalDisabled ? "운영 중지" : getMasterToggleLabel(sectionSummary)}
              </span>
            </div>
          </div>
          <AlimtalkEnvelopeGuide variant="compact" />
        </div>

        {/* Trigger cards */}
        <div className={styles.cardsBody}>
          <div className={panelStyles.contentInner}>
            <AutoSendSummaryStrip
              summary={sectionSummary}
              saving={updateMut.isPending}
            />
            {filteredConfigs.map((config) => (
              <TriggerCard
                key={config.trigger}
                config={config}
                onUpdate={handleUpdate}
                saving={updateMut.isPending}
                operationalDisabled={operationalDisabled}
                onEditTemplate={handleEditTemplate}
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
        trigger={creatingForTrigger ?? undefined}
      />
    </>
  );
}
