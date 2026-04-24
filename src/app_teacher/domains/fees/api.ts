// PATH: src/app_teacher/domains/fees/api.ts
// 수납(Fees) API — 데스크톱 admin API 경로 그대로 재사용 (모바일 전용 엔드포인트 없음)
// 데스크톱 SSOT: src/app_admin/domains/fees/api/fees.api.ts
export {
  // types
  type FeeType,
  type BillingCycle,
  type InvoiceStatus,
  type PaymentMethod,
  type FeeTemplate,
  type StudentFee,
  type InvoiceItem,
  type FeePayment,
  type StudentInvoice,
  type FeeTypeStat,
  type DashboardStats,
  type LectureOption,
  // API calls
  fetchLectureOptions,
  fetchFeeTemplates,
  createFeeTemplate,
  updateFeeTemplate,
  deleteFeeTemplate,
  fetchStudentFees,
  createStudentFee,
  bulkAssignStudentFees,
  deleteStudentFee,
  fetchInvoices,
  fetchInvoiceDetail,
  generateInvoices,
  cancelInvoice,
  fetchPayments,
  recordPayment,
  cancelPayment,
  fetchDashboard,
  fetchOverdueInvoices,
} from "@admin/domains/fees/api/fees.api";
