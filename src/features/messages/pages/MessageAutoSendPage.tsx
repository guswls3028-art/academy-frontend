// PATH: src/features/messages/pages/MessageAutoSendPage.tsx
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
import { MESSAGE_MODE_LABELS } from "../constants/messageSendOptions";
import TemplateEditModal from "../components/TemplateEditModal";
import AutoSendPreviewPopup from "../components/AutoSendPreviewPopup";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import "../styles/templateEditor.css";

const QUERY_KEY = ["messaging", "auto-send"] as const;

const EMPTY_CONFIGS: AutoSendConfigItem[] = [];

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
  clinic_reservation_created: "클리닉 예약이 완료되면 학부모에게 예약 일시를 확인 안내합니다.",
  clinic_reservation_changed: "클리닉 예약이 변경되면 학부모에게 변경 내용을 안내합니다.",
  clinic_cancelled: "클리닉 예약이 취소되면 학부모에게 취소 안내를 발송합니다.",
  clinic_check_in: "클리닉에 입실하면 학부모에게 입실 알림을 발송합니다.",
  clinic_check_out: "클리닉 자율학습이 완료(퇴실)되면 학부모에게 퇴실 알림을 발송합니다.",
  clinic_absent: "클리닉에 결석하면 학부모에게 결석 알림을 발송합니다.",
  counseling_reservation_created: "상담 예약이 완료되면 학부모에게 상담 일시/장소를 확인 안내합니다.",
  payment_complete: "결제가 완료되면 학부모에게 결제 금액/내역을 확인 안내합니다.",
  payment_due_days_before: "납부 예정일 N일 전에 학부모에게 납부 금액/기한을 안내합니다.",
  urgent_notice: "긴급 공지 발송 시 전체 학생·학부모에게 즉시 안내합니다.",
  // 커뮤니티
  qna_answer_registered: "QnA 답변이 등록되면 질문 작성 학생·학부모에게 답변 안내를 발송합니다.",
  counsel_approved: "상담 신청이 승인되면 신청 학생·학부모에게 승인 안내를 발송합니다.",
  // 직원
  staff_attendance_summary: "근태 요약이 생성되면 해당 직원에게 근무 시간/일수 요약을 발송합니다.",
  staff_expense_report: "비용/경비 리포트가 생성되면 해당 직원에게 경비 내역을 발송합니다.",
  staff_month_close: "월 마감이 완료되면 해당 직원에게 마감 확인 안내를 발송합니다.",
  staff_payroll_snapshot: "급여 스냅샷이 생성되면 해당 직원에게 급여 요약을 발송합니다.",
  staff_payroll_report: "급여 명세서가 발행되면 해당 직원에게 명세서를 발송합니다.",
};

const SECTION_DESCRIPTIONS: Record<AutoSendSectionId, string> = {
  default: "사용자가 직접 만든 커스텀 예약 발송용 템플릿입니다. 모든 블록을 자유롭게 사용할 수 있습니다.",
  signup: "회원가입, 가입 승인, 퇴원 등 등록 관련 이벤트를 설정합니다.",
  attendance: "수업 시작 N분 전 리마인드, 입실(출석) 확인, 결석 발생 알림을 설정합니다.",
  lecture: "강의·차시 관련 알림을 설정합니다. 수업 리마인드는 출결 구간에서도 설정 가능합니다.",
  exam: "시험 예정 안내, 시작 전 리마인드, 미응시, 성적 공개, 재시험 대상 지정을 설정합니다.",
  assignment: "과제 등록 안내, 마감 전 리마인드, 미제출 알림을 설정합니다.",
  grades: "성적 공개 안내, 월간 성적 리포트 발송을 설정합니다.",
  clinic: "클리닉 예약 완료/변경, 시작 전 리마인드, 상담 예약 완료 알림을 설정합니다.",
  payment: "결제 완료 확인, 납부 예정일 리마인드를 설정합니다.",
  notice: "휴강, 보강, 강의실 변경, 시간표 변경, 긴급 공지 등 운영 공지를 설정합니다.",
  community: "QnA 답변 등록, 상담 신청 승인 시 학생·학부모에게 자동 발송합니다.",
  staff: "근태 요약, 비용/경비, 월 마감, 급여 스냅샷, 급여 명세서 발송을 설정합니다.",
};

function TriggerCard({
  config,
  templates,
  onUpdate,
  saving,
  onEditTemplate,
  smsConnected,
}: {
  config: AutoSendConfigItem;
  templates: MessageTemplateItem[];
  onUpdate: (c: Partial<AutoSendConfigItem>, debounce?: boolean) => void;
  saving: boolean;
  onEditTemplate?: (trigger: string, templateId: number | null) => void;
  smsConnected: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);

  const policy = (config as AutoSendConfigItem & { policy_mode?: string }).policy_mode || "DISABLED";
  const isSystem = policy === "SYSTEM_AUTO";
  const isDisabled = policy === "DISABLED";

  const POLICY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    SYSTEM_AUTO: { label: "시스템", color: "#6366f1", bg: "rgba(99,102,241,.1)" },
    AUTO_DEFAULT: { label: "자동", color: "#16a34a", bg: "rgba(22,163,74,.1)" },
    MANUAL_DEFAULT: { label: "수동", color: "#d97706", bg: "rgba(217,119,6,.1)" },
    DISABLED: { label: "비활성", color: "#9ca3af", bg: "rgba(156,163,175,.1)" },
  };
  const badge = POLICY_BADGE[policy] || POLICY_BADGE.DISABLED;

  if (isDisabled) return null;

  return (
    <div
      className={panelStyles.contentCard}
      style={{
        background: config.enabled
          ? "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface))"
          : "var(--color-bg-surface-soft)",
        boxShadow: config.enabled
          ? "inset 3px 0 0 var(--color-primary)"
          : undefined,
        transition: "background 0.15s, box-shadow 0.15s, opacity 0.15s",
      }}
    >
      {/* 헤더: 트리거 이름 + 정책 배지 + 활성화 토글 */}
      <div className={panelStyles.contentCardHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: config.enabled
                ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                : "var(--color-bg-surface-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: config.enabled ? "var(--color-primary)" : "var(--color-text-muted)",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <FiZap size={16} aria-hidden />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.1px" }}>
                {AUTO_SEND_TRIGGER_LABELS[config.trigger] ?? config.trigger}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 8,
                color: badge.color, background: badge.bg, lineHeight: 1,
              }}>
                {badge.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2, lineHeight: 1.45 }}>
              {TRIGGER_DESCRIPTIONS[config.trigger] ?? "해당 이벤트 발생 시 자동 발송합니다."}
            </div>
          </div>
        </div>

        {/* 활성화 토글 — SYSTEM_AUTO는 항상 켜짐, 토글 비활성화 */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Switch
            checked={isSystem ? true : config.enabled}
            onChange={(checked) => onUpdate({ ...config, enabled: checked })}
            disabled={saving || isSystem}
            size="small"
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: (isSystem || config.enabled)
                ? "var(--color-text-primary)"
                : "var(--color-text-muted)",
            }}
          >
            {isSystem ? "항상 활성" : config.enabled ? "활성화" : "비활성화"}
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

      {/* 컨트롤 영역 */}
      {!isComingSoon && (() => {
        const hasTemplate = !!config.template;
        const status = config.template_solapi_status;

        const statusColor =
          status === "APPROVED" ? "var(--color-status-success, #16a34a)"
          : status === "PENDING" ? "var(--color-status-warning, #d97706)"
          : "var(--color-status-danger, #dc2626)";

        const statusBg =
          status === "APPROVED" ? "color-mix(in srgb, var(--color-status-success, #16a34a) 10%, transparent)"
          : status === "PENDING" ? "color-mix(in srgb, var(--color-status-warning, #d97706) 10%, transparent)"
          : "color-mix(in srgb, var(--color-status-danger, #dc2626) 10%, transparent)";

        const statusLabel =
          status === "APPROVED" ? "승인"
          : status === "PENDING" ? "검수대기"
          : status === "REJECTED" ? "반려"
          : status || "";

        const handleEditClick = () => {
          onEditTemplate?.(config.trigger, config.template);
        };

        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 160px",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* 템플릿 — 읽기 전용 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                템플릿
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  height: 36,
                  padding: "0 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  background: "color-mix(in srgb, var(--color-border-divider) 10%, var(--color-bg-surface))",
                  border: "1px solid var(--color-border-divider)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {config.template_name || "(템플릿 없음)"}
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
              </div>
            </div>

            {/* 발송 시점 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                발송 시점
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  min={0}
                  step={5}
                  placeholder="0"
                  className="ds-input"
                  style={{ width: 72, fontSize: 13, textAlign: "right", paddingRight: 8 }}
                  value={config.minutes_before ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdate(
                      {
                        ...config,
                        minutes_before: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
                      },
                      true,
                    );
                  }}
                  disabled={saving}
                  aria-label="발송 시점 (분 전)"
                />
                <span style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>분 전</span>
              </div>
            </div>

            {/* 발송 방식 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                발송 방식
              </div>
              <select
                className="ds-select"
                style={{ width: "100%", fontSize: 13 }}
                value={config.message_mode}
                onChange={(e) =>
                  onUpdate({
                    ...config,
                    message_mode: e.target.value as AutoSendConfigItem["message_mode"],
                  })
                }
                disabled={saving}
              >
                {smsConnected && <option value="sms">{MESSAGE_MODE_LABELS.sms}</option>}
                <option value="alimtalk">{MESSAGE_MODE_LABELS.alimtalk}</option>
                {smsConnected && <option value="both">{MESSAGE_MODE_LABELS.both}</option>}
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
  const [creatingForTrigger, setCreatingForTrigger] = useState<string | null>(null);
  const { data: messagingInfo } = useMessagingInfo();
  const smsConnected = !!(messagingInfo?.sms_allowed);

  const { data: configs = EMPTY_CONFIGS, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAutoSendConfigs,
    staleTime: 30 * 1000,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["messaging", "templates"],
    queryFn: () => fetchMessageTemplates(),
    staleTime: 30 * 1000,
  });
  const { data: customTemplates = [] } = useQuery({
    queryKey: ["messaging", "templates", "custom-default"],
    queryFn: () => fetchMessageTemplates("default"),
    staleTime: 30 * 1000,
  });

  const [localConfigs, setLocalConfigs] = useState<AutoSendConfigItem[]>([]);
  const globalEnabled = localConfigs.length > 0 && localConfigs.some((c) => c.enabled);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoProvisionedRef = useRef(false);
  useEffect(() => {
    setLocalConfigs(configs);
  }, [configs]);

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
      qc.invalidateQueries({ queryKey: QUERY_KEY });
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
      qc.invalidateQueries({ queryKey: ["messaging", "templates"] });
      qc.invalidateQueries({ queryKey: QUERY_KEY });
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
      qc.invalidateQueries({ queryKey: ["messaging", "templates"] });
      if (creatingForTrigger && created?.id) {
        const next = localConfigs.map((c) =>
          c.trigger === creatingForTrigger ? { ...c, template: created.id } : c,
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

  const provisionMut = useMutation({
    mutationFn: provisionDefaultTemplates,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["messaging", "templates"] });
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

  const handleUpdate = (updated: Partial<AutoSendConfigItem>, debounce = false) => {
    const next = localConfigs.map((c) =>
      c.trigger === updated.trigger ? { ...c, ...updated } : c
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

  if (isLoading) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>자동발송</h2>
          <p className={panelStyles.headerDesc}>
            학원 운영 이벤트 발생 시 학생·학부모에게 알림톡/SMS를 자동 발송합니다.
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 className={panelStyles.headerTitle}>자동발송</h2>
            <p className={panelStyles.headerDesc}>
              학원 운영 이벤트(가입·출결·시험·과제·클리닉·결제·커뮤니티·직원 등) 발생 시 알림톡/SMS를 자동 발송합니다.
              좌측에서 구간을 선택하고 각 트리거별로 템플릿·발송 시점·방식을 설정하세요.
            </p>
          </div>
          {/* 전체 자동발송 ON/OFF 토글 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              background: globalEnabled
                ? "color-mix(in srgb, var(--color-status-success, #16a34a) 8%, var(--color-bg-surface))"
                : "var(--color-bg-surface-soft)",
              border: `1px solid ${globalEnabled ? "color-mix(in srgb, var(--color-status-success, #16a34a) 25%, var(--color-border-divider))" : "var(--color-border-divider)"}`,
              borderRadius: "var(--radius-md)",
              flexShrink: 0,
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <Switch
              checked={globalEnabled}
              onChange={(checked) => {
                const next = localConfigs.map((c) => ({ ...c, enabled: checked }));
                setLocalConfigs(next);
                updateMut.mutate(next);
              }}
              disabled={updateMut.isPending || localConfigs.length === 0}
              size="small"
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: globalEnabled ? "var(--color-status-success, #16a34a)" : "var(--color-text-muted)", whiteSpace: "nowrap" }}>
              {globalEnabled ? "전체 활성화" : "전체 비활성화"}
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
                    className={panelStyles.contentCard}
                    style={{
                      background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
                      cursor: "pointer",
                    }}
                    onClick={() => setEditingTemplate(t)}
                  >
                    <div className={panelStyles.contentCardHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-primary) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)", flexShrink: 0 }}>
                          <FiZap size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{t.name}</span>
                          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
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
                  + 새 커스텀 템플릿 추가
                </button>
              </>
            ) : hasNoDefaults ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  padding: "60px 24px",
                  textAlign: "center",
                }}
              >
                <FiZap size={36} style={{ color: "var(--color-text-muted)", opacity: 0.5 }} />
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>
                    자동발송 템플릿이 아직 설정되지 않았습니다
                  </p>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                    기본 템플릿을 생성하면 자동발송 트리거에 대한<br />
                    알림톡/SMS 템플릿과 발송 설정이 자동으로 구성됩니다.
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
                {configsInSection.map((config) => (
                  <TriggerCard
                    key={config.trigger}
                    config={config}
                    templates={templates}
                    onUpdate={handleUpdate}
                    saving={updateMut.isPending}
                    onEditTemplate={(trigger, templateId) => {
                      if (!templateId) {
                        setCreatingForTrigger(trigger);
                        return;
                      }
                      const cached = templates.find((t) => t.id === templateId);
                      if (cached) {
                        setEditingTemplate(cached);
                      } else {
                        fetchMessageTemplate(templateId)
                          .then((tpl) => setEditingTemplate(tpl))
                          .catch(() => feedback.error("템플릿 정보를 불러올 수 없습니다."));
                      }
                    }}
                    smsConnected={smsConnected}
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
      onClose={() => setEditingTemplate(null)}
      category={editingTemplate?.category ?? "default"}
      initial={editingTemplate}
      onSubmit={(payload) => editTemplateMut.mutate(payload)}
      isPending={editTemplateMut.isPending}
      smsConnected={smsConnected}
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
      smsConnected={smsConnected}
    />
  </>
  );
}
