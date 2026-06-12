import type { AutoSendConfigItem } from "../api/messages.api";

export type AutoSendSummary = {
  total: number;
  toggleable: number;
  enabledToggleable: number;
  systemAuto: number;
  manualOnly: number;
  disabled: number;
  templateMissing: number;
  reviewWaiting: number;
};

export function canBulkToggleAutoSendConfig(config: AutoSendConfigItem): boolean {
  return config.policy_mode !== "SYSTEM_AUTO"
    && config.implementation_status !== "manual_only"
    && config.implementation_status !== "disabled";
}

export function getEffectiveTemplateStatus(config: AutoSendConfigItem): string {
  return config.effective_template_solapi_status || config.template_solapi_status || "";
}

function hasEffectiveTemplate(config: AutoSendConfigItem): boolean {
  return Boolean(config.effective_solapi_template_id || config.template);
}

export function getEffectiveTemplateStatusLabel(config: AutoSendConfigItem): string {
  const status = getEffectiveTemplateStatus(config);
  if (status === "APPROVED") {
    return config.effective_template_source === "unified" ? "승인(공용)" : "승인";
  }
  if (status === "PENDING") return "검수대기";
  if (status === "REJECTED") return "반려";
  return status;
}

export function getAutoSendSummary(
  configs: AutoSendConfigItem[],
  isEnabled: (config: AutoSendConfigItem) => boolean = (config) => config.enabled,
): AutoSendSummary {
  const toggleableConfigs = configs.filter(canBulkToggleAutoSendConfig);

  return {
    total: configs.length,
    toggleable: toggleableConfigs.length,
    enabledToggleable: toggleableConfigs.filter(isEnabled).length,
    systemAuto: configs.filter((config) => config.policy_mode === "SYSTEM_AUTO").length,
    manualOnly: configs.filter((config) => config.implementation_status === "manual_only").length,
    disabled: configs.filter((config) => config.implementation_status === "disabled" || config.policy_mode === "DISABLED").length,
    templateMissing: configs.filter((config) => config.implementation_status !== "disabled" && !hasEffectiveTemplate(config)).length,
    reviewWaiting: configs.filter((config) => {
      const status = getEffectiveTemplateStatus(config);
      return hasEffectiveTemplate(config) && Boolean(status) && status !== "APPROVED";
    }).length,
  };
}

export function isAllToggleableEnabled(summary: AutoSendSummary): boolean {
  return summary.toggleable > 0 && summary.enabledToggleable === summary.toggleable;
}
