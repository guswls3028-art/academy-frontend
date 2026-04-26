// PATH: src/app_dev/domains/dashboard/api/dashboard.api.ts
// /dev 운영 콘솔 종합 대시보드 KPI API

import api from "@/shared/api/axios";

export type DashboardAuditEntry = {
  id: number;
  created_at: string | null;
  actor: string;
  action: string;
  summary: string;
  result: "success" | "failed";
  tenant_code: string | null;
  tenant_name: string | null;
};

export type DashboardSummary = {
  tenants: {
    total: number;
    active: number;
    inactive: number;
    new_7d: number;
    signup_series_30d: Array<{ date: string; count: number }>;
  };
  billing: {
    mrr: number;
    expiring_7d: number;
    overdue_invoices: number;
    paid_30d: number;
  };
  inbox: {
    total: number;
    unanswered: number;
  };
  users: {
    total: number;
    signups_7d: number;
  };
  audit: {
    failed_24h: number;
    recent: DashboardAuditEntry[];
  };
  maintenance: {
    enabled_for_all: boolean;
    enabled_count: number;
    total: number;
  };
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await api.get<DashboardSummary>("/core/dev/dashboard/");
  return res.data;
}
