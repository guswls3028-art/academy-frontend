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
  createMessageTemplate,
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
  signup: "가입·반 등록·수강 변경·만료 예정 등 등록 관련 이벤트의 자동 발송을 설정합니다.",
  attendance: "수업 시작 N분 전, 입실/결석 등 출결 이벤트의 자동 발송을 설정합니다.",
  lecture: "강의(차시) 관련 알림을 설정합니다.",
  exam: "시험 예정·시작 전·미응시·성적 공개·재시험 대상 등 시험 lifecycle 자동 발송을 설정합니다.",
  assignment: "과제 등록·마감 전·미제출 등 과제 관련 자동 발송을 설정합니다.",
  grades: "성적 공개·월간 리포트 등 성적/리포트 자동 발송을 설정합니다.",
  clinic: "클리닉·상담 예약/변경/시작 전 알림을 설정합니다.",
  payment: "결제 완료·납부 예정일 등 결제/행정 자동 발송을 설정합니다.",
  notice: "휴강·보강·긴급 공지 등 운영 공지 발송을 설정합니다.",
};

function TriggerCard({
  config,
  templates,
  onUpdate,
  saving,
  smsAllowed,
  onOpenCreateTemplate,
}: {
  config: AutoSendConfigItem;
  templates: MessageTemplateItem[];
  onUpdate: (c: Partial<AutoSendConfigItem>, debounce?: boolean) => void;
  saving: boolean;
  smsAllowed: boolean;
  onOpenCreateTemplate?: (trigger: string) => void;
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
          {/* 템플릿 선택 */}
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
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                className="ds-input"
                style={{ flex: 1, fontSize: 13 }}
                value={config.template ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdate({ ...config, template: v ? Number(v) : null });
                }}
                disabled={saving}
              >
                <option value="">— 템플릿 선택 —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.solapi_status === "APPROVED"
                      ? " ✓"
                      : t.solapi_status === "PENDING"
                      ? " (검수대기)"
                      : ""}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                intent="secondary"
                size="sm"
                onClick={() => onOpenCreateTemplate?.(config.trigger)}
                disabled={saving}
              >
                템플릿 생성하기
              </Button>
            </div>
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
  const [createTemplateForTrigger, setCreateTemplateForTrigger] = useState<string | null>(null);
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
  const localConfigsRef = useRef<AutoSendConfigItem[]>([]);
  localConfigsRef.current = localConfigs;
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

  const createTemplateMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) => createMessageTemplate(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["messaging", "templates"] });
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      if (createTemplateForTrigger && created?.id) {
        const configs = localConfigsRef.current;
        const prev = configs.find((c) => c.trigger === createTemplateForTrigger);
        if (prev) {
          const next = configs.map((c) =>
            c.trigger === createTemplateForTrigger ? { ...c, template: created.id } : c
          );
          setLocalConfigs(next);
          updateMut.mutate(next);
        }
      }
      setCreateTemplateForTrigger(null);
      feedback.success("템플릿이 생성되었습니다. 해당 트리거에 연결했습니다.");
    },
    onError: () => {
      feedback.error("템플릿 생성에 실패했습니다.");
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
          <p className={panelStyles.headerDesc}>특정 상황 발생 시 설정한 템플릿으로 자동 발송됩니다.</p>
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
        <p className={panelStyles.headerDesc}>특정 상황 발생 시 설정한 템플릿으로 자동 발송됩니다.</p>
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
                    onOpenCreateTemplate={(trigger) => setCreateTemplateForTrigger(trigger)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    <TemplateEditModal
      open={createTemplateForTrigger !== null}
      onClose={() => setCreateTemplateForTrigger(null)}
      category="default"
      initial={null}
      onSubmit={(payload) => createTemplateMut.mutate(payload)}
      isPending={createTemplateMut.isPending}
    />
  </>
  );
}
