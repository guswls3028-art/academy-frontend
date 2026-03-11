// PATH: src/features/messages/pages/MessageAutoSendPage.tsx
// 자동발송 — 좌측 구간 폴더 트리 + 우측 설정 (템플릿 저장과 동일한 흐름)

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FiZap, FiInfo } from "react-icons/fi";
import { Switch } from "antd";
import {
  fetchAutoSendConfigs,
  fetchMessageTemplates,
  updateAutoSendConfigs,
  updateMessageTemplate,
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
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import "../styles/templateEditor.css";

const QUERY_KEY = ["messaging", "auto-send"] as const;

const EMPTY_CONFIGS: AutoSendConfigItem[] = [];

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  student_signup: "학생이 가입하면 학생·학부모에게 ID/비밀번호 및 접속 안내를 자동 발송합니다.",
  registration_approved_student: "가입 신청 승인 시 학생에게 ID/비밀번호 및 접속 안내를 발송합니다.",
  registration_approved_parent: "가입 신청 승인 시 학부모에게 ID/비밀번호 및 접속 안내를 발송합니다.",
  class_enrollment_complete: "반 등록이 완료되면 학생·학부모에게 반명/강의명/강사명을 안내합니다.",
  enrollment_expiring_soon: "등록 만료 예정일이 도래하면 학생·학부모에게 재등록을 안내합니다. 발송 시점을 설정하세요.",
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
  clinic_reservation_changed: "클리닉 예약이 변경/취소되면 학생·학부모에게 변경 내용을 안내합니다.",
  counseling_reservation_created: "상담 예약이 완료되면 학부모에게 상담 일시/장소를 확인 안내합니다.",
  payment_complete: "결제가 완료되면 학부모에게 결제 금액/내역을 확인 안내합니다.",
  payment_due_days_before: "납부 예정일 N일 전에 학부모에게 납부 금액/기한을 안내합니다.",
  urgent_notice: "긴급 공지 발송 시 전체 학생·학부모에게 즉시 안내합니다.",
};

const SECTION_DESCRIPTIONS: Record<AutoSendSectionId, string> = {
  signup: "회원가입, 가입 승인, 반 등록, 등록 만료 예정, 퇴원 등 등록 관련 이벤트를 설정합니다.",
  attendance: "수업 시작 N분 전 리마인드, 입실(출석) 확인, 결석 발생 알림을 설정합니다.",
  lecture: "강의·차시 관련 알림을 설정합니다. 수업 리마인드는 출결 구간에서도 설정 가능합니다.",
  exam: "시험 예정 안내, 시작 전 리마인드, 미응시, 성적 공개, 재시험 대상 지정을 설정합니다.",
  assignment: "과제 등록 안내, 마감 전 리마인드, 미제출 알림을 설정합니다.",
  grades: "성적 공개 안내, 월간 성적 리포트 발송을 설정합니다.",
  clinic: "클리닉 예약 완료/변경, 시작 전 리마인드, 상담 예약 완료 알림을 설정합니다.",
  payment: "결제 완료 확인, 납부 예정일 리마인드를 설정합니다.",
  notice: "휴강, 보강, 강의실 변경, 시간표 변경, 긴급 공지 등 운영 공지를 설정합니다.",
};

function TriggerCard({
  config,
  templates,
  onUpdate,
  saving,
  smsAllowed,
  onEditTemplate,
}: {
  config: AutoSendConfigItem;
  templates: MessageTemplateItem[];
  onUpdate: (c: Partial<AutoSendConfigItem>, debounce?: boolean) => void;
  saving: boolean;
  smsAllowed: boolean;
  onEditTemplate?: (template: MessageTemplateItem) => void;
}) {
  const effectiveMode =
    !smsAllowed && (config.message_mode === "sms" || config.message_mode === "both")
      ? "alimtalk"
      : config.message_mode;

  const isComingSoon = false;

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
        opacity: isComingSoon ? 0.65 : 1,
        transition: "background 0.15s, box-shadow 0.15s, opacity 0.15s",
      }}
    >
      {/* 헤더: 트리거 이름 + 활성화 토글 */}
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
              {TRIGGER_DESCRIPTIONS[config.trigger] ?? "해당 이벤트 발생 시 자동 발송합니다."}
            </div>
          </div>
        </div>

        {/* 활성화 토글 */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Switch
            checked={config.enabled}
            onChange={(checked) => onUpdate({ ...config, enabled: checked })}
            disabled={saving || isComingSoon}
            size="small"
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: config.enabled
                ? "var(--color-text-primary)"
                : "var(--color-text-muted)",
            }}
          >
            {config.enabled ? "활성화" : "비활성화"}
          </span>
        </div>
      </div>

      {/* 컨트롤 영역 */}
      {!isComingSoon && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: "var(--space-3)",
            alignItems: "end",
          }}
        >
          {/* 템플릿 (읽기 전용 + 수정 버튼) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                marginBottom: 5,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              템플릿
            </label>
            {(() => {
              const linked = config.template
                ? templates.find((t) => t.id === config.template)
                : null;
              return (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div
                    className="ds-input"
                    style={{
                      flex: 1,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "var(--color-bg-surface-soft)",
                      cursor: "default",
                      minHeight: 36,
                    }}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {linked ? linked.name : "기본 템플릿 미설정"}
                    </span>
                    {linked?.solapi_status && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: "var(--radius-sm)",
                          flexShrink: 0,
                          background:
                            linked.solapi_status === "APPROVED"
                              ? "color-mix(in srgb, var(--color-status-success, #16a34a) 12%, transparent)"
                              : linked.solapi_status === "PENDING"
                              ? "color-mix(in srgb, var(--color-status-warning, #d97706) 12%, transparent)"
                              : "color-mix(in srgb, var(--color-status-danger, #dc2626) 12%, transparent)",
                          color:
                            linked.solapi_status === "APPROVED"
                              ? "var(--color-status-success, #16a34a)"
                              : linked.solapi_status === "PENDING"
                              ? "var(--color-status-warning, #d97706)"
                              : "var(--color-status-danger, #dc2626)",
                        }}
                      >
                        {linked.solapi_status === "APPROVED"
                          ? "승인"
                          : linked.solapi_status === "PENDING"
                          ? "검수대기"
                          : linked.solapi_status === "REJECTED"
                          ? "반려"
                          : linked.solapi_status}
                      </span>
                    )}
                  </div>
                  {linked && (
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      onClick={() => onEditTemplate?.(linked)}
                      disabled={saving}
                    >
                      수정하기
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 발송 시점 (N분 전) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                marginBottom: 5,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              발송 시점
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min={0}
                step={5}
                placeholder="예: 10"
                className="ds-input message-domain-input"
                style={{ width: 72, fontSize: 13, textAlign: "right" }}
                value={config.minutes_before ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdate(
                    {
                      ...config,
                      minutes_before:
                        v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
                    },
                    true
                  );
                }}
                disabled={saving}
                aria-label="발송 시점 (분 전)"
              />
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                분 전
              </span>
            </div>
          </div>

          {/* 발송 방식 */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                marginBottom: 5,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              발송 방식
            </label>
            <select
              className="ds-input"
              style={{ width: "100%", fontSize: 13 }}
              value={effectiveMode}
              onChange={(e) =>
                onUpdate({
                  ...config,
                  message_mode: e.target.value as AutoSendConfigItem["message_mode"],
                })
              }
              disabled={saving}
            >
              <option value="sms" disabled={!smsAllowed}>
                {MESSAGE_MODE_LABELS.sms}
              </option>
              <option value="alimtalk">{MESSAGE_MODE_LABELS.alimtalk}</option>
              <option value="both" disabled={!smsAllowed}>
                {MESSAGE_MODE_LABELS.both}
              </option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessageAutoSendPage() {
  const qc = useQueryClient();
  const [selectedSection, setSelectedSection] = useState<AutoSendSectionId>("signup");
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplateItem | null>(null);
  const { data: messagingInfo } = useMessagingInfo();
  const smsAllowed = messagingInfo?.sms_allowed ?? true;

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

  const [localConfigs, setLocalConfigs] = useState<AutoSendConfigItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setLocalConfigs(configs);
  }, [configs]);

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
      setEditingTemplate(null);
      feedback.success("템플릿이 수정되었습니다. 알림톡은 재검수가 필요할 수 있습니다.");
    },
    onError: () => {
      feedback.error("템플릿 수정에 실패했습니다.");
    },
  });

  const handleUpdate = (updated: Partial<AutoSendConfigItem>, debounce = false) => {
    const next = localConfigs.map((c) =>
      c.trigger === updated.trigger ? { ...c, ...updated } : c
    );
    setLocalConfigs(next);
    const toSend = smsAllowed
      ? next
      : next.map((c) =>
          c.message_mode === "sms" || c.message_mode === "both"
            ? { ...c, message_mode: "alimtalk" as const }
            : c
        );
    if (debounce) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => updateMut.mutate(toSend), 600);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      updateMut.mutate(toSend);
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

  const section = AUTO_SEND_SECTIONS.find((s) => s.id === selectedSection);
  const sectionTriggers = section?.triggers ?? [];
  const configsInSection = localConfigs.filter((c) => sectionTriggers.includes(c.trigger));

  return (
    <>
    <div className={panelStyles.root}>
      <div className={panelStyles.header}>
        <h2 className={panelStyles.headerTitle}>자동발송</h2>
        <p className={panelStyles.headerDesc}>
          학원 운영 이벤트(가입·출결·시험·과제·클리닉·결제 등) 발생 시 학생·학부모에게 알림톡/SMS를 자동 발송합니다.
          좌측에서 구간을 선택하고 각 트리거별로 템플릿·발송 시점·방식을 설정하세요.
        </p>
        {!smsAllowed && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background:
                "color-mix(in srgb, var(--color-status-warning, #d97706) 8%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--color-status-warning, #d97706) 20%, transparent)",
              marginTop: "var(--space-3)",
            }}
          >
            <FiInfo
              size={14}
              style={{
                color: "var(--color-status-warning, #d97706)",
                flexShrink: 0,
                marginTop: 1,
              }}
              aria-hidden
            />
            <span
              style={{
                fontSize: 13,
                color: "var(--color-text-secondary)",
              }}
            >
              문자(SMS)는 이 학원 정책상 사용할 수 없습니다. SMS·알림톡→SMS 폴백은 선택할 수 없습니다.
            </span>
          </div>
        )}
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
            {section && (
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
                    smsAllowed={smsAllowed}
                    onEditTemplate={(tpl) => setEditingTemplate(tpl)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    <TemplateEditModal
      open={editingTemplate !== null}
      onClose={() => setEditingTemplate(null)}
      category={editingTemplate?.category ?? "default"}
      initial={editingTemplate}
      onSubmit={(payload) => editTemplateMut.mutate(payload)}
      isPending={editTemplateMut.isPending}
    />
  </>
  );
}
