// PATH: src/features/messages/pages/MessageAutoSendPage.tsx
// 자동발송 — 좌측 구간 폴더 트리 + 우측 설정 (템플릿 저장과 동일한 흐름)

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FiZap, FiInfo } from "react-icons/fi";
import {
  fetchAutoSendConfigs,
  fetchMessageTemplates,
  updateAutoSendConfigs,
  type AutoSendConfigItem,
  type AutoSendTrigger,
  AUTO_SEND_TRIGGER_LABELS,
  type MessageTemplateItem,
} from "../api/messages.api";
import { useMessagingInfo } from "../hooks/useMessagingInfo";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import AutoSendSectionTree, {
  AUTO_SEND_SECTIONS,
  type AutoSendSectionId,
} from "../components/AutoSendSectionTree";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

const QUERY_KEY = ["messaging", "auto-send"] as const;

const EMPTY_CONFIGS: AutoSendConfigItem[] = [];

const TRIGGER_DESCRIPTIONS: Record<AutoSendTrigger, string> = {
  student_signup: "학생이 가입 완료하면 자동 발송합니다. 학부모 정보가 있으면 학부모에게도 발송합니다.",
  lecture_session_reminder: "강의(차시) 시작 N분 전에 자동으로 알림을 발송합니다. (추후 지원 예정)",
  clinic_reminder: "클리닉 세션 N분 전에 자동으로 알림을 발송합니다. 스케줄러 연동 시 사용됩니다.",
  clinic_reservation_created: "클리닉 예약이 생성될 때 발송합니다. (추후 지원 예정)",
  clinic_reservation_changed: "클리닉 예약이 변경될 때 발송합니다. (추후 지원 예정)",
};

const SECTION_DESCRIPTIONS: Record<AutoSendSectionId, string> = {
  signup: "가입 완료 시 자동 발송 메시지를 설정합니다.",
  lecture: "강의(차시) 시작 알림 등 강의 관련 자동 발송을 이 구간에서 관리할 수 있습니다.",
  clinic: "클리닉 알림(N분 전), 예약 생성·변경 시 자동 발송을 이 구간에서 한 번에 관리할 수 있습니다.",
};

function TriggerCard({
  config,
  templates,
  onUpdate,
  saving,
  smsAllowed,
}: {
  config: AutoSendConfigItem;
  templates: MessageTemplateItem[];
  onUpdate: (c: Partial<AutoSendConfigItem>, debounce?: boolean) => void;
  saving: boolean;
  smsAllowed: boolean;
}) {
  const effectiveMode =
    !smsAllowed && (config.message_mode === "sms" || config.message_mode === "both")
      ? "alimtalk"
      : config.message_mode;

  const isComingSoon =
    config.trigger === "lecture_session_reminder" ||
    config.trigger === "clinic_reservation_created" ||
    config.trigger === "clinic_reservation_changed";

  return (
    <div
      className={panelStyles.contentCard}
      style={{
        background: config.enabled
          ? "var(--color-bg-surface)"
          : "var(--color-bg-surface-soft)",
        opacity: isComingSoon ? 0.65 : 1,
        transition: "background 0.15s, opacity 0.15s",
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
              {AUTO_SEND_TRIGGER_LABELS[config.trigger as AutoSendTrigger]}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginTop: 2,
                lineHeight: 1.45,
              }}
            >
              {TRIGGER_DESCRIPTIONS[config.trigger as AutoSendTrigger]}
            </div>
          </div>
        </div>

        {/* 활성화 토글 */}
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: isComingSoon || saving ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onUpdate({ ...config, enabled: e.target.checked })}
            disabled={saving || isComingSoon}
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
        </label>
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
            <select
              className="ds-input"
              style={{ width: "100%", fontSize: 13 }}
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
                placeholder="—"
                className="ds-input"
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
                SMS만
              </option>
              <option value="alimtalk">알림톡만</option>
              <option value="both" disabled={!smsAllowed}>
                알림톡→SMS 폴백
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
    onSuccess: (data) => {
      setLocalConfigs(data);
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
  const configsInSection = localConfigs.filter((c) =>
    sectionTriggers.includes(c.trigger as AutoSendTrigger)
  );

  return (
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
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
