// PATH: src/app_admin/domains/fees/components/FeesInvoicesTab.tsx
// 청구서 목록 + 생성/상세/수납 기록 모달

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";
import AdminModal from "@/shared/ui/modal/AdminModal";
import { ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { MODAL_WIDTH } from "@/shared/ui/modal/constants";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { StatusBadge } from "./FeesDashboardTab";
import styles from "./FeesInvoicesTab.module.css";
import {
  fetchInvoices,
  fetchInvoiceDetail,
  generateInvoices,
  cancelInvoice,
  recordPayment,
  cancelPayment,
  fetchLectureOptions,
  type StudentInvoice,
  type PaymentMethod,
} from "../api/fees.api";

function formatKRW(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export default function FeesInvoicesTab() {
  const qc = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState("");
  const [feeTypeFilter, setFeeTypeFilter] = useState("");
  const [lectureFilter, setLectureFilter] = useState("");
  const [search, setSearch] = useState("");
  const [unpaidFirst, setUnpaidFirst] = useState(true);

  // Modals
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<StudentInvoice | null>(null);

  // Generate form
  const [genDueDate, setGenDueDate] = useState(() => {
    const d = new Date(year, month, 0); // last day of month
    return d.toISOString().split("T")[0];
  });

  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payNote, setPayNote] = useState("");

  const params: Record<string, string> = {
    billing_year: String(year),
    billing_month: String(month),
  };
  if (statusFilter) params.status = statusFilter;
  if (feeTypeFilter) params.fee_type = feeTypeFilter;
  if (lectureFilter) params.lecture = lectureFilter;
  if (search) params.search = search;
  if (unpaidFirst) params.ordering = "unpaid_first";

  // 강의 목록 (필터용)
  const { data: lectures } = useQuery({
    queryKey: ["fees", "lecture-options"],
    queryFn: fetchLectureOptions,
    staleTime: 60_000,
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["fees", "invoices", params],
    queryFn: () => fetchInvoices(params),
    staleTime: 5_000,
  });

  const genMutation = useMutation({
    mutationFn: generateInvoices,
    onSuccess: (r) => {
      feedback.success(`청구서 ${r.created}건 생성 (${r.skipped}건 skip)`);
      if (r.errors.length) feedback.warning(`오류: ${r.errors.join(", ")}`);
      qc.invalidateQueries({ queryKey: ["fees"] });
      setGenerateOpen(false);
    },
    onError: () => feedback.error("청구서 생성 실패"),
  });

  const payMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      feedback.success("수납이 기록되었습니다");
      qc.invalidateQueries({ queryKey: ["fees"] });
      setPaymentOpen(false);
      setDetailOpen(false);
      setPayAmount("");
      setPayNote("");
    },
    onError: (e: unknown) => feedback.error(extractApiError(e, "수납 기록 실패")),
  });

  const cancelInvMutation = useMutation({
    mutationFn: cancelInvoice,
    onSuccess: () => {
      feedback.success("청구서가 취소되었습니다");
      qc.invalidateQueries({ queryKey: ["fees"] });
      setDetailOpen(false);
    },
    onError: (e: unknown) => feedback.error(extractApiError(e, "취소 실패")),
  });

  const cancelPayMutation = useMutation({
    mutationFn: cancelPayment,
    onSuccess: () => {
      feedback.success("수납이 취소되었습니다");
      qc.invalidateQueries({ queryKey: ["fees"] });
      // reload detail
      if (selectedInvoice) openDetail(selectedInvoice.id);
    },
    onError: (e: unknown) => feedback.error(extractApiError(e, "수납 취소 실패")),
  });

  const openDetail = useCallback(async (invoiceId: number) => {
    try {
      const detail = await fetchInvoiceDetail(invoiceId);
      setSelectedInvoice(detail);
      setDetailOpen(true);
    } catch {
      feedback.error("청구서 상세 조회 실패");
    }
  }, []);

  const openPayment = () => {
    if (!selectedInvoice) return;
    setPayAmount(String(selectedInvoice.outstanding_amount));
    setPayMethod("CASH");
    setPayNote("");
    setPaymentOpen(true);
  };

  // 요약 카운트
  const counts = {
    total: invoices?.length ?? 0,
    paid: invoices?.filter((i) => i.status === "PAID").length ?? 0,
    unpaid: invoices?.filter((i) => ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status)).length ?? 0,
    overdue: invoices?.filter((i) => i.status === "OVERDUE").length ?? 0,
  };

  return (
    <div className={styles.page}>
      {/* Quick Filter Chips */}
      {!isLoading && invoices && invoices.length > 0 && (
        <div className={styles.quickFilters}>
          {([
            { label: `전체 ${counts.total}`, value: "", tone: "muted" },
            { label: `미납/부분납 ${counts.unpaid}`, value: "UNPAID", tone: "warning" },
            { label: `연체 ${counts.overdue}`, value: "OVERDUE", tone: "danger" },
            { label: `완납 ${counts.paid}`, value: "PAID", tone: "success" },
          ] as const).map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={styles.filterChip}
              data-active={statusFilter === chip.value || (!statusFilter && chip.value === "") ? "true" : "false"}
              data-tone={chip.tone}
              onClick={() => {
                if (chip.value === "UNPAID") {
                  // 미납+부분납+연체 모두 보기 — 상태 필터 해제하고 정렬로 처리
                  setStatusFilter("");
                } else {
                  setStatusFilter(chip.value);
                }
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <select
          className={`ds-select ${styles.periodSelect}`}
          value={`${year}-${month}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setYear(y);
            setMonth(m);
          }}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            return (
              <option key={`${y}-${m}`} value={`${y}-${m}`}>
                {y}년 {m}월
              </option>
            );
          })}
        </select>

        <select
          className={`ds-select ${styles.statusSelect}`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">전체 상태</option>
          <option value="PENDING">미납</option>
          <option value="PARTIAL">부분납</option>
          <option value="PAID">완납</option>
          <option value="OVERDUE">연체</option>
        </select>

        <select
          className={`ds-select ${styles.feeTypeSelect}`}
          value={feeTypeFilter}
          onChange={(e) => setFeeTypeFilter(e.target.value)}
        >
          <option value="">전체 비목</option>
          <option value="TUITION">수강료</option>
          <option value="TEXTBOOK">교재비</option>
          <option value="HANDOUT">판서/프린트</option>
          <option value="REGISTRATION">등록비</option>
          <option value="MATERIAL">재료비</option>
          <option value="OTHER">기타</option>
        </select>

        <select
          className={`ds-select ${styles.lectureSelect}`}
          value={lectureFilter}
          onChange={(e) => setLectureFilter(e.target.value)}
        >
          <option value="">전체 강의</option>
          {lectures?.map((lec) => (
            <option key={lec.id} value={String(lec.id)}>{lec.title}</option>
          ))}
        </select>

        <input
          className={`ds-input ${styles.searchInput}`}
          placeholder="학생 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={unpaidFirst}
            onChange={(e) => setUnpaidFirst(e.target.checked)}
          />
          미납 우선
        </label>

        <div className={styles.toolbarAction}>
          <Button intent="primary" onClick={() => setGenerateOpen(true)}>
            월 청구서 생성
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className={styles.loading}>불러오는 중...</div>
      ) : !invoices?.length ? (
        <EmptyState title="해당 월의 청구서가 없습니다" />
      ) : (
        <DomainTable>
          <table className="ds-table">
            <thead>
              <tr>
                <th>학생</th>
                <th>청구번호</th>
                <th className={styles.alignRight}>청구액</th>
                <th className={styles.alignRight}>납부액</th>
                <th className={styles.alignRight}>미납액</th>
                <th>상태</th>
                <th>납부기한</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => openDetail(inv.id)}
                  className={styles.invoiceRow}
                  data-status={inv.status}
                >
                  <td>{inv.student_name}</td>
                  <td className={styles.invoiceNumber}>{inv.invoice_number}</td>
                  <td className={styles.alignRight}>{formatKRW(inv.total_amount)}</td>
                  <td className={styles.alignRight}>{formatKRW(inv.paid_amount)}</td>
                  <td className={`${styles.alignRight} ${styles.outstanding}`} data-due={inv.outstanding_amount > 0 ? "true" : "false"}>
                    {formatKRW(inv.outstanding_amount)}
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td>{inv.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DomainTable>
      )}

      {/* ===== Generate Modal ===== */}
      <AdminModal open={generateOpen} onClose={() => setGenerateOpen(false)} type="action" width={MODAL_WIDTH.sm}>
        <ModalHeader title="월 청구서 생성" type="action" />
        <ModalBody>
          <div className="modal-scroll-body">
            <div className="modal-form-group">
              <label className="modal-section-label">청구 기간</label>
              <div className="modal-form-row--2">
                <div>
                  <label>연도</label>
                  <input className="ds-input" type="number" value={year} readOnly />
                </div>
                <div>
                  <label>월</label>
                  <input className="ds-input" type="number" value={month} readOnly />
                </div>
              </div>
            </div>
            <div className="modal-form-group">
              <label className="modal-section-label">납부 기한</label>
              <input
                className="ds-input"
                type="date"
                value={genDueDate}
                onChange={(e) => setGenDueDate(e.target.value)}
              />
            </div>
            <p className={`modal-hint ${styles.modalHint}`}>
              활성 비목(월납)이 할당된 학생에게 청구서가 생성됩니다. 이미 생성된 학생은 건너뜁니다.
            </p>
          </div>
        </ModalBody>
        <ModalFooter
          right={
            <>
              <Button intent="secondary" onClick={() => setGenerateOpen(false)}>취소</Button>
              <Button
                intent="primary"
                onClick={() => genMutation.mutate({ billing_year: year, billing_month: month, due_date: genDueDate })}
                disabled={genMutation.isPending}
              >
                {genMutation.isPending ? "생성 중..." : "생성"}
              </Button>
            </>
          }
        />
      </AdminModal>

      {/* ===== Detail Modal ===== */}
      <AdminModal open={detailOpen} onClose={() => setDetailOpen(false)} type="inspect" width={MODAL_WIDTH.wide}>
        {selectedInvoice && (
          <>
            <ModalHeader
              title={`청구서 ${selectedInvoice.invoice_number}`}
              description={`${selectedInvoice.student_name} · ${selectedInvoice.billing_year}년 ${selectedInvoice.billing_month}월`}
              type="inspect"
            />
            <ModalBody>
              <div className={`modal-scroll-body ${styles.detailBody}`}>
                {/* Summary */}
                <div className={styles.summaryGrid}>
                  <div>
                    <div className={styles.metricLabel}>청구액</div>
                    <div className={styles.metricValue}>{formatKRW(selectedInvoice.total_amount)}</div>
                  </div>
                  <div>
                    <div className={styles.metricLabel}>납부액</div>
                    <div className={`${styles.metricValue} ${styles.metricValueSuccess}`}>
                      {formatKRW(selectedInvoice.paid_amount)}
                    </div>
                  </div>
                  <div>
                    <div className={styles.metricLabel}>미납액</div>
                    <div className={`${styles.metricValue} ${selectedInvoice.outstanding_amount > 0 ? styles.metricValueDanger : ""}`}>
                      {formatKRW(selectedInvoice.outstanding_amount)}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className={styles.sectionTitle}>청구 항목</h4>
                  <table className={`ds-table ${styles.compactTable}`}>
                    <thead>
                      <tr>
                        <th>항목</th>
                        <th className={styles.alignRight}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items?.map((item) => (
                        <tr key={item.id}>
                          <td>{item.description}</td>
                          <td className={styles.alignRight}>{formatKRW(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Payments */}
                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <div>
                    <h4 className={styles.sectionTitle}>납부 내역</h4>
                    <table className={`ds-table ${styles.compactTable}`}>
                      <thead>
                        <tr>
                          <th>일시</th>
                          <th>수단</th>
                          <th className={styles.alignRight}>금액</th>
                          <th>메모</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.payments.map((pay) => (
                          <tr key={pay.id}>
                            <td>{new Date(pay.paid_at).toLocaleDateString("ko-KR")}</td>
                            <td>{pay.payment_method_display}</td>
                            <td className={styles.alignRight}>{formatKRW(pay.amount)}</td>
                            <td>{pay.receipt_note || pay.memo || "-"}</td>
                            <td>
                              <Button
                                size="sm"
                                intent="ghost"
                                onClick={() => {
                                  if (confirm("이 수납을 취소하시겠습니까?")) {
                                    cancelPayMutation.mutate(pay.id);
                                  }
                                }}
                              >
                                취소
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter
              left={
                selectedInvoice.status !== "PAID" && selectedInvoice.status !== "CANCELLED" ? (
                  <Button
                    intent="danger"
                    size="sm"
                    onClick={() => {
                      if (confirm("이 청구서를 취소하시겠습니까?")) {
                        cancelInvMutation.mutate(selectedInvoice.id);
                      }
                    }}
                  >
                    청구서 취소
                  </Button>
                ) : undefined
              }
              right={
                selectedInvoice.outstanding_amount > 0 ? (
                  <Button intent="primary" onClick={openPayment}>
                    수납 기록
                  </Button>
                ) : undefined
              }
            />
          </>
        )}
      </AdminModal>

      {/* ===== Payment Modal ===== */}
      <AdminModal open={paymentOpen} onClose={() => setPaymentOpen(false)} type="action" width={MODAL_WIDTH.sm}>
        <ModalHeader title="수납 기록" description={selectedInvoice?.student_name} type="action" />
        <ModalBody>
          <div className="modal-scroll-body">
            <div className="modal-form-group">
              <label className="modal-section-label">납부 금액 (원)</label>
              <input
                className="ds-input"
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                min={1}
                max={selectedInvoice?.outstanding_amount}
              />
              <div className="modal-hint">미납 잔액: {formatKRW(selectedInvoice?.outstanding_amount ?? 0)}</div>
            </div>
            <div className="modal-form-group">
              <label className="modal-section-label">결제 수단</label>
              <select className="ds-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                <option value="CASH">현금</option>
                <option value="BANK_TRANSFER">계좌이체</option>
                <option value="CARD">카드</option>
                <option value="OTHER">기타</option>
              </select>
            </div>
            <div className="modal-form-group">
              <label className="modal-section-label">메모 / 입금자명</label>
              <input
                className="ds-input"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="선택 입력"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter
          right={
            <>
              <Button intent="secondary" onClick={() => setPaymentOpen(false)}>취소</Button>
              <Button
                intent="primary"
                disabled={!payAmount || Number(payAmount) <= 0 || payMutation.isPending}
                onClick={() => {
                  if (!selectedInvoice) return;
                  payMutation.mutate({
                    invoice_id: selectedInvoice.id,
                    amount: Number(payAmount),
                    payment_method: payMethod,
                    receipt_note: payNote,
                  });
                }}
              >
                {payMutation.isPending ? "처리 중..." : "수납 기록"}
              </Button>
            </>
          }
        />
      </AdminModal>
    </div>
  );
}
