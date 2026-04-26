// PATH: src/app_dev/domains/automation/api/automation.api.ts
// /dev 자동화 콘솔: 감사 로그 조회 + 크론 트리거

import api from "@/shared/api/axios";

export type AuditEntry = {
  id: number;
  created_at: string | null;
  actor: string;
  action: string;
  summary: string;
  result: "success" | "failed";
  error: string;
  tenant_code: string | null;
  tenant_name: string | null;
  target_user_id: number | null;
};

export type AuditFilters = {
  action?: string;
  actor?: string;
  tenant_code?: string;
  result?: "success" | "failed" | "";
  since?: string;
  until?: string;
  limit?: number;
};

export async function getAuditLog(filters: AuditFilters = {}): Promise<{ results: AuditEntry[]; count: number; limit: number }> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params[k] = String(v);
  }
  const res = await api.get<{ results: AuditEntry[]; count: number; limit: number }>(
    "/core/dev/audit/", { params },
  );
  return res.data;
}

export type CronEntry = {
  command: string;
  label: string;
  description: string;
  default_args: string[];
  danger: boolean;
  last_run_at: string | null;
  last_run_result: "success" | "failed" | null;
  last_run_summary: string | null;
};

export async function getCronList(): Promise<{ results: CronEntry[] }> {
  const res = await api.get<{ results: CronEntry[] }>("/core/dev/cron/");
  return res.data;
}

export async function triggerCron(command: string, args?: string[]): Promise<{ started: boolean; command: string; args: string[]; started_at: string }> {
  const res = await api.post<{ started: boolean; command: string; args: string[]; started_at: string }>(
    "/core/dev/cron/run/",
    { command, args: args ?? null },
  );
  return res.data;
}
