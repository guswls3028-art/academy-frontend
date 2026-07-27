// PATH: src/dev_app/hooks/useBilling.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  getTenantSubscriptions,
  extendSubscription,
  getInvoices,
  markInvoicePaid,
  getDashboard,
  getBankTransferNotices,
  confirmBankTransferNotice,
  rejectBankTransferNotice,
  markTaxInvoiceIssued,
} from "@dev/domains/billing/api/billing.api";

const INVOICE_ROOT = ["dev", "billing", "invoices"] as const;
const BANK_TRANSFER_ROOT = ["dev", "billing", "bank-transfers"] as const;

const KEYS = {
  tenants: ["dev", "billing", "tenants"] as const,
  invoiceRoot: INVOICE_ROOT,
  invoices: (params?: Record<string, string>) =>
    [...INVOICE_ROOT, params] as const,
  dashboard: ["dev", "billing", "dashboard"] as const,
  bankTransferRoot: BANK_TRANSFER_ROOT,
  bankTransfers: (page: number) =>
    [...BANK_TRANSFER_ROOT, page] as const,
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

export function useBankTransferNotices(page: number) {
  return useQuery({
    queryKey: KEYS.bankTransfers(page),
    queryFn: () => getBankTransferNotices({ page, actionable: true }),
    staleTime: 5_000,
    refetchInterval: 30_000,
  });
}

function invalidateBilling(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: KEYS.bankTransferRoot });
  qc.invalidateQueries({ queryKey: KEYS.tenants });
  qc.invalidateQueries({ queryKey: KEYS.invoiceRoot });
  qc.invalidateQueries({ queryKey: KEYS.dashboard });
}

export function useConfirmBankTransferNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noticeId: number) => confirmBankTransferNotice(noticeId),
    onSuccess: () => invalidateBilling(qc),
  });
}

export function useRejectBankTransferNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      noticeId,
      reason,
    }: {
      noticeId: number;
      reason: string;
    }) => rejectBankTransferNotice(noticeId, reason),
    onSuccess: () => invalidateBilling(qc),
  });
}

export function useMarkTaxInvoiceIssued() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      issueNumber,
    }: {
      issueId: number;
      issueNumber: string;
    }) => markTaxInvoiceIssued(issueId, issueNumber),
    onSuccess: () => invalidateBilling(qc),
  });
}
