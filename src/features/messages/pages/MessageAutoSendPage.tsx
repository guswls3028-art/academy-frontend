// PATH: src/features/messages/pages/MessageAutoSendPage.tsx
// 자동발송 — 트리거별 템플릿 설정 (가입 완료, 클리닉 알림 등)

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FiZap } from "react-icons/fi";
import {
  fetchAutoSendConfigs,
  fetchMessageTemplates,
  updateAutoSendConfigs,
  type AutoSendConfigItem,
  type AutoSendTrigger,
  AUTO_SEND_TRIGGER_LABELS,
  type MessageTemplateItem,
} from "../api/messages.api";
import { Button, Panel } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

const QUERY_KEY = ["messaging", "auto-send"] as const;

function TriggerRow({
  config,
  templates,
  onUpdate,
  saving,
}: {
  config: AutoSendConfigItem;
  templates: MessageTemplateItem[];
  onUpdate: (c: Partial<AutoSendConfigItem>) => void;
  saving: boolean;
}) {
  const approvedTemplates = templates.filter((t) => t.solapi_status === "APPROVED");

  return (
    <div
      className="flex flex-wrap items-center gap-4 py-4 border-b border-[var(--color-border-divider)] last:border-b-0"
      style={{ alignItems: "center" }}
    >
      <div className="w-48 shrink-0">
        <div className="flex items-center gap-2">
          <FiZap size={16} style={{ color: "var(--color-primary)" }} aria-hidden />
          <span className="font-medium text-[var(--color-text-primary)]">
            {AUTO_SEND_TRIGGER_LABELS[config.trigger as AutoSendTrigger]}
          </span>
        </div>
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onUpdate({ ...config, enabled: e.target.checked })}
          disabled={saving}
        />
        <span className="text-sm text-[var(--color-text-secondary)]">활성화</span>
      </label>
      <select
        className="ds-input text-sm"
        value={config.template ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onUpdate({ ...config, template: v ? Number(v) : null });
        }}
        disabled={saving}
        style={{ minWidth: 180 }}
      >
        <option value="">템플릿 선택</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.solapi_status === "APPROVED" ? " ✓" : t.solapi_status === "PENDING" ? " (검수대기)" : ""}
          </option>
        ))}
      </select>
      <select
        className="ds-input text-sm"
        value={config.message_mode}
        onChange={(e) =>
          onUpdate({ ...config, message_mode: e.target.value as AutoSendConfigItem["message_mode"] })
        }
        disabled={saving}
        style={{ minWidth: 140 }}
      >
        <option value="sms">SMS만</option>
        <option value="alimtalk">알림톡만</option>
        <option value="both">알림톡→SMS 폴백</option>
      </select>
      {config.template_name && (
        <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[120px]">
          {config.template_name}
        </span>
      )}
    </div>
  );
}

export default function MessageAutoSendPage() {
  const qc = useQueryClient();
  const { data: configs = [], isLoading } = useQuery({
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

  const handleUpdate = (updated: Partial<AutoSendConfigItem>) => {
    const next = localConfigs.map((c) =>
      c.trigger === updated.trigger ? { ...c, ...updated } : c
    );
    setLocalConfigs(next);
    updateMut.mutate(next);
  };

  if (isLoading) {
    return (
      <Panel variant="primary" title="자동발송">
        <div className="py-12 text-center text-[var(--color-text-muted)] text-sm">
          불러오는 중…
        </div>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel
        variant="primary"
        title="자동발송"
        description="특정 상황 발생 시 설정한 템플릿으로 자동 발송됩니다. 트리거별로 템플릿과 발송 방식을 선택하세요."
      >
        <div className="divide-y divide-[var(--color-border-divider)]">
          {localConfigs.map((config) => (
            <TriggerRow
              key={config.trigger}
              config={config}
              templates={templates}
              onUpdate={handleUpdate}
              saving={updateMut.isPending}
            />
          ))}
        </div>
      </Panel>

      <div
        className="rounded-xl p-5 border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)]"
        style={{ fontSize: 13, color: "var(--color-text-muted)" }}
      >
        <div className="font-semibold text-[var(--color-text-primary)] mb-2">트리거 안내</div>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>가입 완료</strong>: 학생 가입 시 발송 (학부모 선택 시 학부모에게도 발송)</li>
          <li><strong>클리닉 알림</strong>: 클리닉 세션 알림 발송</li>
          <li><strong>클리닉 예약 생성</strong>: 클리닉 예약 시 발송 (추후 지원)</li>
          <li><strong>클리닉 예약 변경</strong>: 클리닉 예약 변경 시 발송 (추후 지원)</li>
        </ul>
      </div>
    </div>
  );
}
