// PATH: src/dev_app/hooks/useBilling.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTenantSubscriptions,
  extendSubscription,
  changePlan,
  getInvoices,
  markInvoicePaid,
  getDashboard,
} from "@dev/domains/billing/api/billing.api";

const KEYS = {
  tenants: ["dev", "billing", "tenants"] as const,
  invoices: (params?: Record<string, string>) => ["dev", "billing", "invoices", params] as const,
  dashboard: ["dev", "billing", "dashboard"] as const,
};

export function useBillingTenants() {
  return useQuery({
    queryKey: KEYS.tenants,
    queryFn: getTenantSubscriptions,
    staleTime: 15_000,
  });
}

export function useBillingDashboard() {
  return useQuery({
    queryKey: KEYS.dashboard,
    queryFn: getDashboard,
    staleTime: 15_000,
  });
}

export function useBillingInvoices(params?: { status?: string; tenant?: string }) {
  return useQuery({
    queryKey: KEYS.invoices(params as Record<string, string>),
    queryFn: () => getInvoices(params),
    staleTime: 15_000,
  });
}

export function useExtendSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programId, days }: { programId: number; days: number }) =>
      extendSubscription(programId, days),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.tenants });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programId, plan }: { programId: number; plan: string }) =>
      changePlan(programId, plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.tenants });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: number) => markInvoicePaid(invoiceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.tenants });
      qc.invalidateQueries({ queryKey: KEYS.invoices() });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}
