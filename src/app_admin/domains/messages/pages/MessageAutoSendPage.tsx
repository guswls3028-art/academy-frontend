// PATH: src/app_admin/domains/messages/pages/MessageAutoSendPage.tsx
// 자동발송 — 좌측 구간 폴더 트리 + 우측 설정 (템플릿 저장과 동일한 흐름)

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FiZap, FiEdit3 } from "react-icons/fi";
import { Eye } from "lucide-react";
import { Switch } from "antd";
import {
  fetchAutoSendConfigs,
  fetchMessageTemplates,
  fetchMessageTemplate,
  updateAutoSendConfigs,
  updateMessageTemplate,
  createMessageTemplate,
  provisionDefaultTemplates,
  type AutoSendConfigItem,
  AUTO_SEND_TRIGGER_LABELS,
  type MessageTemplateItem,
  type MessageTemplatePayload,
} from "../api/messages.api";
import { useMessagingInfo } from "../hooks/useMessagingInfo";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import AutoSendSectionTree, {
  AUTO_SEND_SECTIONS,
  type AutoSendSectionId,
} from "../components/AutoSendSectionTree";
import TemplateEditModal from "../components/TemplateEditModal";
import AutoSendPreviewPopup from "../components/AutoSendPreviewPopup";
import AutoSendTimingControl from "../components/AutoSendTimingControl";
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
import { messageQueryKeys } from "../queryKeys";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "./MessageAutoSendPage.module.css";
import "../styles/templateEditor.css";

const EMPTY_CONFIGS: AutoSendConfigItem[] = [];

const POLICY_LABELS = {
  SYSTEM_AUTO: "시스템",
  AUTO_DEFAULT: "자동",
  MANUAL_DEFAULT: "수동",
  DISABLED: "비활성",
} as const;

type PolicyKey = keyof typeof POLICY_LABELS;

function getPolicyKey(policy?: string): PolicyKey {
  return policy && policy in POLICY_LABELS ? (policy as PolicyKey) : "DISABLED";
}

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
      {summary.systemAuto > 0 && (
        <span className={styles.summaryItem}>
          <span className={styles.summaryLabel}>항상 활성</span>
          <strong>{summary.systemAuto}</strong>
        </span>
      )}
      {summary.reviewWaiting > 0 && (
        <span className={styles.summaryItem} data-tone="warning">
          <span className={styles.summaryLabel}>검수 확인</span>
          <strong>{summary.reviewWaiting}</strong>
        </span>
      )}
      {summary.templateMissing > 0 && (
        <span className={styles.summaryItem} data-tone="warning">
          <span className={styles.summaryLabel}>템플릿 없음</span>
          <strong>{summary.templateMissing}</strong>
        </span>
      )}
      {summary.manualOnly > 0 && (
        <span className={styles.summaryItem}>
          <span className={styles.summaryLabel}>수동 전용</span>
          <strong>{summary.manualOnly}</strong>
        </span>
      )}
      {summary.disabled > 0 && (
        <span className={styles.summaryItem}>
          <span className={styles.summaryLabel}>비활성 정책</span>
          <strong>{summary.disabled}</strong>
        </span>
      )}
      {saving && <span className={styles.savingBadge}>저장 중</span>}
    </div>
  );
}

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  registration_approved_student: "학생 등록·가입 승인 시 학생에게 아이디/비밀번호 및 접속 안내를 알림톡으로 발송합니다.",
  registration_approved_parent: "학생 등록·가입 승인 시 학부모에게 학부모+학생 로그인 정보를 알림톡으로 발송합니다.",
  withdrawal_complete: "퇴원 처리가 완료되면 학생·학부모에게 퇴원 확인 메시지를 발송합니다.",
  lecture_session_reminder: "수업 시작 전 학생·학부모에게 수업 일시/교실/강사를 리마인드합니다. 분 전 설정 필수.",
  check_in_complete: "입실(출석) 처리가 완료되면 학부모에게 출석 확인 알림을 발송합니다.",
  absent_occurred: "결석이 확인되면 학부모에게 결석 알림을 즉시 발송합니다.",
  exam_scheduled_days_before: "시험 예정일 N일 전에 학생·학부모에게 시험명/일정을 안내합니다.",
  exam_start_minutes_before: "시험 시작 N분 전에 학생에게 시험 시작 리마인드를 발송합니다.",
  exam_not_taken: "시험 미응시가 확인되면 학생·학부모에게 미응시 알림을 발송합니다.",
  exam_score_published: "성적이 공개되면 학생·학부모에게 성적/평균/등급을 안내합니다.",
  retake_assigned: "재시험 대상으로 지정되면 학생·학부모에게 재시험 일정을 안내합니다.",
  assignment_registered: "새 과제가 등록되면 학생에게 과제명/마감일을 안내합니다.",
  assignment_due_hours_before: "과제 마감 N시간 전에 학생에게 미제출 리마인드를 발송합니다.",
  assignment_not_submitted: "과제 미제출이 확인되면 학생·학부모에게 미제출 알림을 발송합니다.",
  monthly_report_generated: "월간 성적 리포트가 생성되면 학부모에게 성적 요약을 발송합니다.",
  clinic_reminder: "클리닉 시작 N분 전에 학생에게 예약 일시/장소를 리마인드합니다.",
  clinic_reservation_created: "클리닉 예약이 완료되면 학생·학부모에게 예약 일시를 확인 안내합니다.",
  clinic_reservation_changed: "클리닉 예약이 변경되면 학생·학부모에게 변경 내용을 안내합니다.",
  clinic_cancelled: "클리닉 예약이 취소되면 학생·학부모에게 취소 안내를 발송합니다.",
  clinic_check_in: "\"참석\" 버튼을 누르면 학부모에게 입실 알림을 발송합니다.",
  clinic_absent: "\"결석\" 처리 시 학부모에게 결석 알림을 발송합니다.",
  clinic_self_study_completed: "\"클리닉 완료\" 버튼을 누르면 학부모에게 하원 안내를 발송합니다.",
  clinic_result_notification: "시험/과제 통과로 클리닉 대상이 해소되면 결과를 안내합니다.",
  counseling_reservation_created: "상담 예약이 완료되면 학생·학부모에게 상담 일시/장소를 확인 안내합니다.",
  payment_complete: "결제가 완료되면 학부모에게 결제 금액/내역을 확인 안내합니다.",
  payment_due_days_before: "납부 예정일 N일 전에 학부모에게 납부 금액/기한을 안내합니다.",
  // 영상
  video_encoding_complete: "영상 인코딩이 완료되면 업로드한 선생님에게 완료 알림을 발송합니다.",
  matchup_report_submitted: "강사가 매치업 적중 보고서를 제출하면 대표·관리자에게 알림을 발송합니다.",
  // urgent_notice: 카카오 알림톡 정책 위반으로 제거
  // 커뮤니티
  qna_answered: "QnA 답변이 등록되면 질문을 작성한 학생에게 답변 안내를 발송합니다.",
  counsel_answered: "상담 답변이 등록되면 신청 학생과 학부모에게 답변 안내를 발송합니다.",
};

const SECTION_DESCRIPTIONS: Record<AutoSendSectionId, string> = {
  default: "사용자가 직접 만든 커스텀 알림톡 템플릿입니다. 모든 블록을 자유롭게 사용할 수 있습니다.",
  signup: "회원가입, 가입 승인, 퇴원 등 등록 관련 이벤트를 설정합니다.",
  attendance: "수업 시작 N분 전 리마인드, 입실(출석) 확인, 결석 발생 알림을 설정합니다.",
  lecture: "영상 인코딩 완료, 매치업 보고서 제출 등 강의·차시 관련 알림을 설정합니다.",
  exam: "시험 예정 안내, 시작 전 리마인드, 미응시, 성적 공개, 재시험 대상 지정을 설정합니다.",
  assignment: "과제 등록 안내, 마감 전 리마인드, 미제출 알림을 설정합니다.",
  grades: "성적 공개 안내, 월간 성적 리포트 발송을 설정합니다.",
  clinic: "클리닉 예약 완료/변경, 시작 전 리마인드, 상담 예약 완료 알림을 설정합니다.",
  payment: "결제 완료 확인, 납부 예정일 리마인드를 설정합니다.",
  // notice: 카카오 알림톡 정책 위반으로 제거
  community: "QnA·상담 답변 등록 시 학생·학부모에게 자동 발송합니다.",
};

function TriggerCard({
  config,
  onUpdate,
  saving,
  onEditTemplate,
}: {
  config: AutoSendConfigItem;
  onUpdate: (c: Partial<AutoSendConfigItem>, debounce?: boolean) => void;
  saving: boolean;
  onEditTemplate?: (trigger: string, templateId: number | null) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  const policy = getPolicyKey(config.policy_mode);
  const isSystem = policy === "SYSTEM_AUTO";
  const isDisabled = policy === "DISABLED";
  const implStatus = config.implementation_status;
  const isUnimplemented = implStatus === "manual_only" || implStatus === "disabled";
  const unimplementedHint = implStatus === "disabled"
    ? "정책상 비활성 — 발송되지 않습니다"
    : implStatus === "manual_only"
      ? "자동 발화 미구현 — 수동 발송 모달에서만 사용 가능"
      : "";
  const isActive = isSystem || (config.enabled && !isUnimplemented);
  const cardState = isDisabled ? "disabled" : isActive ? "active" : "inactive";
  const hasTimingControl = isReminderTrigger(config.trigger) || canUseDelayTiming(config);

  return (
    <div
      className={`${panelStyles.contentCard} ${styles.triggerCard}`}
      data-card-state={cardState}
    >
      {/* 헤더: 트리거 이름 + 정책 배지 + 활성화 토글 */}
      <div className={panelStyles.contentCardHeader}>
        <div className={styles.triggerHeaderInfo}>
          <div className={styles.triggerIcon} data-active={isActive}>
            <FiZap size={16} aria-hidden />
          </div>
          <div>
            <div className={styles.triggerTitleRow}>
              <span className={styles.triggerTitle}>
                {AUTO_SEND_TRIGGER_LABELS[config.trigger] ?? config.trigger}
              </span>
              <span className={styles.policyBadge} data-policy={policy}>
                {POLICY_LABELS[policy]}
              </span>
            </div>
            <div className={styles.triggerDescription}>
              {TRIGGER_DESCRIPTIONS[config.trigger] ?? "해당 이벤트 발생 시 자동 발송합니다."}
            </div>
            {isUnimplemented && (
              <div className={styles.unimplementedHint}>
                {unimplementedHint}
              </div>
            )}
          </div>
        </div>

        {/* 활성화 토글 — SYSTEM_AUTO는 항상 켜짐, 토글 비활성화 */}
        <div className={styles.cardActions}>
          <Switch
            checked={isSystem ? true : isUnimplemented ? false : config.enabled}
            onChange={(checked) => onUpdate({ ...config, enabled: checked })}
            disabled={saving || isSystem || isDisabled || isUnimplemented}
            size="small"
          />
          <span
            className={styles.triggerState}
            data-active={isActive && !isDisabled}
          >
            {isDisabled ? "정책상 비활성" : isSystem ? "항상 활성" : isUnimplemented ? "수동 발송 전용" : config.enabled ? "활성화" : "비활성화"}
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

      {/* 컨트롤 영역 — DISABLED는 표시 안 함 */}
      {!isDisabled && (() => {
        const hasTemplate = !!config.template;
        const status = getEffectiveTemplateStatus(config);
        const statusLabel = getEffectiveTemplateStatusLabel(config);

        const handleEditClick = () => {
          onEditTemplate?.(config.trigger, config.template);
        };

        return (
          <div className={styles.controls} data-has-timing={hasTimingControl ? "true" : "false"}>
            {/* 템플릿 — 읽기 전용 */}
            <div>
              <div className={styles.fieldLabel}>
                템플릿
              </div>
              <div className={styles.templateDisplay}>
                <span className={styles.templateName}>
                  {config.template_name || "(템플릿 없음)"}
                </span>
                <button
                  type="button"
                  onClick={handleEditClick}
                  className={styles.templateEditButton}
                  title="템플릿 편집"
                  aria-label="템플릿 편집"
                >
                  <FiEdit3 size={14} />
                </button>
                {hasTemplate && status && (
                  <span
                    className={styles.statusBadge}
                    data-status={status}
                    title={
                      config.effective_template_source === "unified"
                        ? "공용 승인 템플릿으로 실제 발송됩니다."
                        : undefined
                    }
                  >
                    {statusLabel}
                  </span>
                )}
              </div>
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

            {/* 발송 방식 */}
            <div>
              <div className={styles.fieldLabel}>
                발송 채널
              </div>
              <select
                className={`ds-select ${styles.channelSelect}`}
                value="alimtalk"
                onChange={() => onUpdate({ ...config, message_mode: "alimtalk" })}
                disabled={saving || isUnimplemented}
              >
                <option value="alimtalk">알림톡</option>
              </select>
            </div>
          </div>
        );
      })()}
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

export default function MessageAutoSendPage() {
  const qc = useQueryClient();
  const [selectedSection, setSelectedSection] = useState<AutoSendSectionId>("signup");
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplateItem | null>(null);
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null);
  const [creatingForTrigger, setCreatingForTrigger] = useState<string | null>(null);
  useMessagingInfo();

  const { data: configs = EMPTY_CONFIGS, isLoading } = useQuery({
    queryKey: messageQueryKeys.autoSend,
    queryFn: fetchAutoSendConfigs,
    staleTime: 30 * 1000,
  });
  const { data: templates = [] } = useQuery({
    queryKey: messageQueryKeys.templates,
    queryFn: () => fetchMessageTemplates(),
    staleTime: 30 * 1000,
  });
  const { data: customTemplates = [] } = useQuery({
    queryKey: messageQueryKeys.customDefaultTemplate,
    queryFn: () => fetchMessageTemplates("default"),
    staleTime: 30 * 1000,
  });

  const [localConfigs, setLocalConfigs] = useState<AutoSendConfigItem[]>([]);
  const globalSummary = getAutoSendSummary(localConfigs);
  const globalEnabled = isAllToggleableEnabled(globalSummary);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConfigsRef = useRef<Partial<AutoSendConfigItem>[]>([]);
  const hasPendingDebouncedSaveRef = useRef(false);
  const autoProvisionedRef = useRef(false);
  useEffect(() => {
    setLocalConfigs(configs);
  }, [configs]);

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

  // 기본 템플릿이 없으면 자동 프로비저닝 (1회)
  useEffect(() => {
    if (autoProvisionedRef.current) return;
    if (isLoading) return;
    const hasNoTemplates = configs.length === 0 || configs.every((c) => !c.template);
    if (hasNoTemplates && configs.length > 0) {
      autoProvisionedRef.current = true;
      provisionMut.mutate();
    }
  }, [configs, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMut = useMutation({
    mutationFn: updateAutoSendConfigs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
      feedback.success("자동발송 설정이 저장되었습니다.");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      feedback.error(msg || "저장에 실패했습니다.");
    },
  });

  const editTemplateMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) => {
      if (!editingTemplate) throw new Error("no template");
      return updateMessageTemplate(editingTemplate.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageQueryKeys.templates });
      qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
      setEditingTemplate(null);
      feedback.success("템플릿이 수정되었습니다. 알림톡은 재검수가 필요할 수 있습니다.");
    },
    onError: () => {
      feedback.error("템플릿 수정에 실패했습니다.");
    },
  });

  const createTemplateMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) => createMessageTemplate(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: messageQueryKeys.templates });
      if (creatingForTrigger && created?.id) {
        const next = localConfigs.map((c) =>
          c.trigger === creatingForTrigger ? { ...c, template: created.id } : c,
        );
        setLocalConfigs(next);
        updateMut.mutate([{ trigger: creatingForTrigger, template: created.id }]);
      }
      setCreatingForTrigger(null);
      feedback.success("템플릿이 생성되었습니다.");
    },
    onError: () => {
      feedback.error("템플릿 생성에 실패했습니다.");
    },
  });

  const provisionMut = useMutation({
    mutationFn: provisionDefaultTemplates,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
      qc.invalidateQueries({ queryKey: messageQueryKeys.templates });
      const parts: string[] = [];
      if (result.created_templates > 0) parts.push(`템플릿 ${result.created_templates}개 생성`);
      if (result.reset_templates > 0) parts.push(`${result.reset_templates}개 기본값 복원`);
      if (result.created_configs > 0) parts.push(`자동발송 ${result.created_configs}개 설정`);
      if (result.linked > 0) parts.push(`${result.linked}개 연결`);
      if (parts.length === 0) parts.push(`이미 모두 최신 상태입니다 (총 ${result.total_configs}개)`);
      feedback.success(parts.join(", "));
    },
    onError: () => {
      feedback.error("기본 템플릿 생성에 실패했습니다.");
    },
  });

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

  const handleUpdate = (updated: Partial<AutoSendConfigItem>, debounce = false) => {
    const next = localConfigs.map((c) =>
      c.trigger === updated.trigger ? { ...c, ...updated } : c
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

  if (isLoading) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>자동발송</h2>
            <p className={panelStyles.headerDesc}>
              학원 운영 이벤트 발생 시 학생·학부모에게 알림톡을 자동 발송합니다.
            </p>
        </div>
        <div className={panelStyles.body}>
          <aside className={panelStyles.tree}>
            <AutoSendSectionTree selectedSection="signup" onSelectSection={() => {}} />
          </aside>
          <div className={panelStyles.content}>
            <div className={panelStyles.contentInner}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={panelStyles.skeletonCard} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasNoDefaults = localConfigs.length === 0 || localConfigs.every((c) => !c.template);
  const section = AUTO_SEND_SECTIONS.find((s) => s.id === selectedSection);
  const sectionTriggers = section?.triggers ?? [];
  const configsInSection = localConfigs.filter((c) => sectionTriggers.includes(c.trigger));

  return (
    <>
    <div className={panelStyles.root}>
      <div className={panelStyles.header}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={panelStyles.headerTitle}>자동발송</h2>
            <p className={panelStyles.headerDesc}>
              학원 운영 이벤트(가입·출결·시험·과제·클리닉·결제·커뮤니티 등) 발생 시 알림톡을 자동 발송합니다.
              좌측에서 구간을 선택하고 각 트리거별로 템플릿·발송 시점·방식을 설정하세요.
            </p>
          </div>
          {/* 전체 자동발송 ON/OFF 토글 */}
          <div className={styles.masterToggle} data-enabled={globalEnabled}>
            <Switch
              checked={globalEnabled}
              onChange={(checked) => {
                const next = localConfigs.map((c) => (
                  canBulkToggleAutoSendConfig(c) ? { ...c, enabled: checked } : c
                ));
                const patches = next
                  .filter((c, index) => c.enabled !== localConfigs[index]?.enabled)
                  .map((c) => ({ trigger: c.trigger, enabled: c.enabled }));
                setLocalConfigs(next);
                if (patches.length > 0) updateMut.mutate(patches);
              }}
              disabled={updateMut.isPending || globalSummary.toggleable === 0}
              size="small"
            />
            <span className={styles.masterToggleText} data-enabled={globalEnabled}>
              {getMasterToggleLabel(globalSummary)}
            </span>
          </div>
        </div>
      </div>

      <div className={panelStyles.body}>
        <aside className={panelStyles.tree}>
          <AutoSendSectionTree
            selectedSection={selectedSection}
            onSelectSection={setSelectedSection}
          />
        </aside>
        <div className={panelStyles.content}>
          <div className={panelStyles.contentInner}>
            {selectedSection === "default" ? (
              <>
                <p className={panelStyles.sectionTitle}>
                  사용자 — {SECTION_DESCRIPTIONS.default}
                </p>
                {customTemplates.length > 0 && customTemplates.map((t) => (
                  <div
                    key={t.id}
                    className={`${panelStyles.contentCard} ${styles.customTemplateCard}`}
                    onClick={() => setEditingTemplate(t)}
                  >
                    <div className={panelStyles.contentCardHeader}>
                      <div className={styles.customTemplateInfo}>
                        <div className={styles.customTemplateIcon}>
                          <FiZap size={16} />
                        </div>
                        <div className={styles.customTemplateText}>
                          <span className={styles.customTemplateTitle}>{t.name}</span>
                          <div className={styles.customTemplateDescription}>
                            {t.subject ? `${t.subject} · ` : ""}커스텀 템플릿
                          </div>
                        </div>
                      </div>
                      <Button intent="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setEditingTemplate(t); }}>
                        수정하기
                      </Button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setCreatingForTrigger("custom_default")}
                  className={styles.addTemplateButton}
                >
                  + 새 커스텀 템플릿 추가
                </button>
              </>
            ) : hasNoDefaults ? (
              <div className={styles.emptyState}>
                <FiZap size={36} className={styles.emptyIcon} />
                <div>
                  <p className={styles.emptyTitle}>
                    자동발송 템플릿이 아직 설정되지 않았습니다
                  </p>
                  <p className={styles.emptyDescription}>
                    기본 템플릿을 생성하면 자동발송 트리거에 대한<br />
                    알림톡 템플릿과 발송 설정이 자동으로 구성됩니다.
                  </p>
                </div>
                <Button
                  intent="primary"
                  onClick={() => provisionMut.mutate()}
                  disabled={provisionMut.isPending}
                >
                  {provisionMut.isPending ? "생성 중…" : "기본 템플릿 생성하기"}
                </Button>
              </div>
            ) : section && (
              <>
                <p className={panelStyles.sectionTitle}>
                  {section.label} — {SECTION_DESCRIPTIONS[section.id]}
                </p>
                <AutoSendSummaryStrip
                  summary={getAutoSendSummary(configsInSection)}
                  saving={updateMut.isPending}
                />
                {configsInSection.map((config) => (
                  <TriggerCard
                    key={config.trigger}
                    config={config}
                    onUpdate={handleUpdate}
                    saving={updateMut.isPending}
                    onEditTemplate={(trigger, templateId) => {
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
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* 수정 모달 */}
    <TemplateEditModal
      open={editingTemplate !== null}
      onClose={() => { setEditingTemplate(null); setEditingTrigger(null); }}
      category={editingTemplate?.category ?? "default"}
      initial={editingTemplate}
      onSubmit={(payload) => editTemplateMut.mutate(payload)}
      isPending={editTemplateMut.isPending}
      trigger={editingTrigger ?? undefined}
    />

    {/* 생성 모달 (템플릿 미연결 trigger) */}
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
