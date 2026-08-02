import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Copy, Landmark, ReceiptText } from "lucide-react";
import {
  activateBankTransfer,
  fetchBankTransferSummary,
  saveBusinessProfile,
  submitBankTransferNotice,
  type BankTransferNotice,
  type BusinessProfile,
} from "../api/billing.api";
import { useConfirm } from "@/shared/ui/confirm/useConfirm";
import { adminSettingsQueryKeys } from "../queryKeys";
import styles from "./BankTransferSection.module.css";

const EMPTY_PROFILE: Omit<BusinessProfile, "id"> = {
  business_name: "",
  representative_name: "",
  business_registration_number: "",
  address: "",
  business_type: "",
  business_item: "",
  tax_invoice_email: "",
  manager_name: "",
  manager_phone: "",
  manager_email: "",
};

function localDateTimeValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

function errorMessage(error: unknown): string {
  const candidate = error as {
    response?: { data?: { detail?: string; [key: string]: unknown } };
  };
  const detail = candidate.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  const fieldError = candidate.response?.data
    ? Object.values(candidate.response.data).find(Array.isArray)
    : null;
  if (Array.isArray(fieldError) && typeof fieldError[0] === "string") {
    return fieldError[0];
  }
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function BankTransferSection() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const profileHydrated = useRef(false);
  const rejectedNoticeHydrated = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [depositorName, setDepositorName] = useState("");
  const [depositedAt, setDepositedAt] = useState(localDateTimeValue);
  const [taxInvoiceRequested, setTaxInvoiceRequested] = useState(true);
  const [profile, setProfile] =
    useState<Omit<BusinessProfile, "id">>(EMPTY_PROFILE);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: adminSettingsQueryKeys.bankTransfer,
    queryFn: fetchBankTransferSummary,
    staleTime: 15_000,
    retry: 1,
  });

  useEffect(() => {
    if (!data?.business_profile || profileHydrated.current) return;
    profileHydrated.current = true;
    setProfile({
      business_name: data.business_profile.business_name,
      representative_name: data.business_profile.representative_name,
      business_registration_number:
        data.business_profile.business_registration_number,
      address: data.business_profile.address,
      business_type: data.business_profile.business_type,
      business_item: data.business_profile.business_item,
      tax_invoice_email: data.business_profile.tax_invoice_email,
      manager_name: data.business_profile.manager_name,
      manager_phone: data.business_profile.manager_phone,
      manager_email: data.business_profile.manager_email,
    });
  }, [data?.business_profile]);

  const payableInvoice = useMemo(
    () =>
      data?.invoices.find((invoice) =>
        ["PENDING", "OVERDUE"].includes(invoice.status),
      ),
    [data?.invoices],
  );
  const latestNoticeInvoice = useMemo(
    () => data?.invoices.find((invoice) => invoice.bank_transfer_notice),
    [data?.invoices],
  );
  const notice =
    data?.billing_mode === "INVOICE_REQUEST"
      ? payableInvoice
        ? payableInvoice.bank_transfer_notice
        : latestNoticeInvoice?.bank_transfer_notice
      : null;
  const guideStep =
    data?.billing_mode !== "INVOICE_REQUEST" ? 1 : notice ? 3 : 2;
  const guideComplete =
    notice?.status === "SUBMITTED" || notice?.status === "CONFIRMED";
  const guidePaused =
    data?.billing_mode === "INVOICE_REQUEST" && !payableInvoice && !notice;
  const canSubmit = Boolean(
    payableInvoice && (!notice || notice.status === "REJECTED"),
  );
  const canTransfer =
    data?.billing_mode === "INVOICE_REQUEST" &&
    Boolean(payableInvoice) &&
    !notice;

  useEffect(() => {
    if (
      notice?.status !== "REJECTED" ||
      rejectedNoticeHydrated.current === notice.id
    ) {
      return;
    }
    rejectedNoticeHydrated.current = notice.id;
    setDepositorName(notice.depositor_name);
    setDepositedAt(localDateTimeValue(new Date(notice.deposited_at)));
    setTaxInvoiceRequested(notice.tax_invoice_requested);
  }, [notice]);

  const activateMutation = useMutation({
    mutationFn: activateBankTransfer,
    onSuccess: (summary) => {
      queryClient.setQueryData(adminSettingsQueryKeys.bankTransfer, summary);
      queryClient.invalidateQueries({
        queryKey: adminSettingsQueryKeys.subscriptionInfo,
      });
      setMessage({
        tone: "success",
        text: "계좌이체 청구서가 준비되었습니다. 금액을 확인하고 아래 계좌로 이체해 주세요.",
      });
    },
    onError: (error) => {
      setMessage({ tone: "error", text: errorMessage(error) });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!payableInvoice) throw new Error("입금할 청구서가 없습니다.");
      if (taxInvoiceRequested) {
        await saveBusinessProfile(profile);
      }
      return submitBankTransferNotice({
        invoice_id: payableInvoice.id,
        depositor_name: depositorName.trim(),
        deposited_at: new Date(depositedAt).toISOString(),
        tax_invoice_requested: taxInvoiceRequested,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminSettingsQueryKeys.bankTransfer,
      });
      setMessage({
        tone: "success",
        text: "입금 확인 요청이 접수되었습니다. 확인 결과는 이 화면에 표시됩니다.",
      });
    },
    onError: (error) => {
      setMessage({ tone: "error", text: errorMessage(error) });
    },
  });

  function updateProfile<K extends keyof typeof profile>(
    key: K,
    value: (typeof profile)[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function copyAccount() {
    if (!data?.bank_account.account_number) return;
    try {
      await navigator.clipboard.writeText(
        data.bank_account.account_number.replace(/-/g, ""),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage({
        tone: "error",
        text: "계좌번호를 복사하지 못했습니다. 번호를 직접 선택해 주세요.",
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    submitMutation.mutate();
  }

  async function handleActivate() {
    const accepted = await confirm({
      title: "계좌이체로 변경",
      message:
        "앞으로 이용료 청구 방식이 계좌이체로 변경됩니다. 청구서를 만든 뒤 안내 계좌로 납부해 주세요.",
      confirmText: "계좌이체로 변경",
      cancelText: "취소",
    });
    if (accepted) {
      setMessage(null);
      activateMutation.mutate();
    }
  }

  if (isLoading) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        계좌이체 정보를 불러오는 중...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.section}>
        <h3>계좌이체 결제</h3>
        <div className={styles.errorBox} role="alert">
          <strong>계좌이체 정보를 불러오지 못했습니다.</strong>
          <span>잠시 후 다시 시도해 주세요.</span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? "다시 불러오는 중..." : "다시 불러오기"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="bank-transfer-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>BANK TRANSFER</span>
          <h3 id="bank-transfer-title">계좌이체로 이용료 납부</h3>
          <p>
            안내 계좌로 보내고, 입금 정보를 알려주시면 됩니다.
          </p>
        </div>
        <span className={styles.secureBadge}>
          <Landmark size={15} aria-hidden />
          운영 계좌
        </span>
      </header>

      {!data.bank_account.enabled ? (
        <div className={styles.unavailable}>
          운영 계좌를 준비 중입니다. 학원플러스 운영팀에 문의해 주세요.
        </div>
      ) : (
        <>
          <ol className={styles.paymentGuide} aria-label="계좌이체 납부 순서">
            {[
              ["계좌이체 선택", "납부할 청구서를 먼저 준비합니다."],
              ["정확한 금액 이체", "안내 계좌로 이용료를 보냅니다."],
              ["입금 정보 제출", "입금자명과 이체 시각을 알려주세요."],
            ].map(([title, description], index) => {
              const step = index + 1;
              const state = guideComplete
                ? "done"
                : guidePaused
                  ? step === 1
                    ? "done"
                    : "upcoming"
                : step < guideStep
                  ? "done"
                  : step === guideStep
                    ? "current"
                    : "upcoming";
              return (
                <li key={title} data-state={state}>
                  <span className={styles.guideNumber}>
                    {state === "done" ? <Check size={14} aria-hidden /> : step}
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </div>
                </li>
              );
            })}
          </ol>

          {data.billing_mode !== "INVOICE_REQUEST" && (
            <div className={styles.activation}>
              <div>
                <strong>앞으로 계좌이체로 납부할게요</strong>
                <p>
                  선택하면 이번 납부 대상 금액이 표시됩니다. 이 단계에서
                  돈이 빠져나가지는 않습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleActivate}
                disabled={activateMutation.isPending}
              >
                {activateMutation.isPending
                  ? "청구서 준비 중..."
                  : "계좌이체 선택하기"}
              </button>
            </div>
          )}

          {payableInvoice && data.billing_mode === "INVOICE_REQUEST" && (
            <div className={styles.invoiceBand}>
              <div>
                <span>이번 납부 대상 금액</span>
                <strong>{formatWon(payableInvoice.total_amount)}</strong>
                <small>
                  공급가 {formatWon(payableInvoice.supply_amount)} · 부가세{" "}
                  {formatWon(payableInvoice.tax_amount)}
                </small>
              </div>
              <dl>
                <div>
                  <dt>청구 기간</dt>
                  <dd>
                    {payableInvoice.period_start} ~ {payableInvoice.period_end}
                  </dd>
                </div>
                <div>
                  <dt>청구번호</dt>
                  <dd>{payableInvoice.invoice_number}</dd>
                </div>
                <div>
                  <dt>납부기한</dt>
                  <dd>{payableInvoice.due_date}</dd>
                </div>
              </dl>
            </div>
          )}

          {canTransfer && (
            <div className={styles.accountSlip}>
              <div className={styles.accountBank}>
                <span>입금 은행</span>
                <strong>{data.bank_account.bank_name}</strong>
              </div>
              <div className={styles.accountNumber}>
                <span>계좌번호</span>
                <strong>{data.bank_account.account_number}</strong>
              </div>
              <div className={styles.accountHolder}>
                <span>예금주</span>
                <strong>{data.bank_account.account_holder}</strong>
              </div>
              <button
                type="button"
                className={styles.copyButton}
                onClick={copyAccount}
                aria-label={
                  copied
                    ? "계좌번호가 복사되었습니다"
                    : "계좌번호 복사"
                }
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span aria-live="polite">
                  {copied ? "복사됨" : "번호 복사"}
                </span>
              </button>
            </div>
          )}

          {!payableInvoice && data.billing_mode === "INVOICE_REQUEST" && (
            <div className={styles.unavailable}>
              현재 납부할 청구서가 없습니다. 계좌로 송금하지 마시고, 다음
              청구서가 표시된 뒤 이체해 주세요.
            </div>
          )}

          {notice && (
            <NoticeStatus
              status={notice.status}
              taxRequested={notice.tax_invoice_requested}
              taxStatus={notice.tax_invoice_status}
              rejectionReason={notice.rejection_reason}
            />
          )}

          {canSubmit && payableInvoice && (
            <form
              className={styles.form}
              onSubmit={handleSubmit}
              aria-busy={submitMutation.isPending}
            >
              <div className={styles.formHeading}>
                <div className={styles.stepNumber}>3</div>
                <div>
                  <h4>이체를 마쳤다면 입금 정보를 알려주세요</h4>
                  <p>
                    통장에 실제로 표시된 내용과 같아야 빠르게 확인할 수
                    있습니다.
                  </p>
                </div>
              </div>

              <div className={styles.transferReminder}>
                {notice?.status === "REJECTED" ? (
                  <>
                    <strong>추가로 이체하지 말고 입금 정보만 고쳐 주세요.</strong>
                    <span>
                      반려 사유를 확인해 실제 입금자명과 이체 시각을 다시
                      입력해 주세요. 실제 송금하지 않았다면 운영팀에 먼저
                      문의해 주세요.
                    </span>
                  </>
                ) : (
                  <>
                    <strong>
                      {formatWon(payableInvoice.total_amount)}을 먼저 이체해
                      주세요.
                    </strong>
                    <span>
                      금액을 다르게 보내셨다면 입금 확인을 요청하기 전에
                      운영팀에 문의해 주세요.
                    </span>
                  </>
                )}
              </div>

              <div className={styles.fieldGrid}>
                <label>
                  <span>입금자명 (통장 표시 이름)</span>
                  <input
                    value={depositorName}
                    onChange={(event) => setDepositorName(event.target.value)}
                    maxLength={100}
                    required
                    autoComplete="name"
                    placeholder="예: 홍길동 또는 OO학원"
                  />
                  <small className={styles.fieldHint}>
                    보낸 계좌의 출금 내역에 표시된 이름을 입력해 주세요.
                  </small>
                </label>
                <label>
                  <span>이체 시각</span>
                  <input
                    type="datetime-local"
                    value={depositedAt}
                    onChange={(event) => setDepositedAt(event.target.value)}
                    max={localDateTimeValue()}
                    required
                  />
                  <small className={styles.fieldHint}>
                    은행 앱의 이체 완료 시각을 확인해 주세요.
                  </small>
                </label>
              </div>

              <label className={styles.taxToggle}>
                <input
                  type="checkbox"
                  checked={taxInvoiceRequested}
                  onChange={(event) =>
                    setTaxInvoiceRequested(event.target.checked)
                  }
                />
                <span>
                  <ReceiptText size={18} aria-hidden />
                  <strong>전자세금계산서가 필요해요</strong>
                  <small>
                    입금 확인 후 발행을 준비합니다. 필요하지 않으면 체크를
                    해제하세요.
                  </small>
                </span>
              </label>

              {taxInvoiceRequested && (
                <div className={styles.businessPanel}>
                  <div className={styles.formHeading}>
                    <div className={styles.formIcon}>
                      <ReceiptText size={15} aria-hidden />
                    </div>
                    <div>
                      <h4>세금계산서 받을 사업자 정보</h4>
                      <p>
                        필수 항목은 사업자등록증과 같게 입력해 주세요. 나머지는
                        선택 사항입니다.
                      </p>
                    </div>
                  </div>
                  <div className={styles.fieldGrid}>
                    <label>
                      <span>상호</span>
                      <input
                        value={profile.business_name}
                        onChange={(event) =>
                          updateProfile("business_name", event.target.value)
                        }
                        required
                        autoComplete="organization"
                        placeholder="사업자등록증의 상호"
                      />
                    </label>
                    <label>
                      <span>대표자명</span>
                      <input
                        value={profile.representative_name}
                        onChange={(event) =>
                          updateProfile(
                            "representative_name",
                            event.target.value,
                          )
                        }
                        required
                        autoComplete="name"
                        placeholder="사업자등록증의 대표자명"
                      />
                    </label>
                    <label>
                      <span>사업자등록번호</span>
                      <input
                        inputMode="numeric"
                        value={profile.business_registration_number}
                        onChange={(event) =>
                          updateProfile(
                            "business_registration_number",
                            event.target.value,
                          )
                        }
                        placeholder="000-00-00000"
                        required
                      />
                    </label>
                    <label>
                      <span>수신 이메일</span>
                      <input
                        type="email"
                        value={profile.tax_invoice_email}
                        onChange={(event) =>
                          updateProfile(
                            "tax_invoice_email",
                            event.target.value,
                          )
                        }
                        required
                        autoComplete="email"
                        placeholder="세금계산서를 받을 이메일"
                      />
                    </label>
                    <label className={styles.wideField}>
                      <span>사업장 주소 (선택)</span>
                      <input
                        value={profile.address}
                        onChange={(event) =>
                          updateProfile("address", event.target.value)
                        }
                        autoComplete="street-address"
                        placeholder="사업자등록증의 사업장 주소"
                      />
                    </label>
                    <label>
                      <span>업태 (선택)</span>
                      <input
                        value={profile.business_type}
                        onChange={(event) =>
                          updateProfile("business_type", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>종목 (선택)</span>
                      <input
                        value={profile.business_item}
                        onChange={(event) =>
                          updateProfile("business_item", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>담당자명 (선택)</span>
                      <input
                        value={profile.manager_name}
                        onChange={(event) =>
                          updateProfile("manager_name", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>담당자 연락처 (선택)</span>
                      <input
                        value={profile.manager_phone}
                        onChange={(event) =>
                          updateProfile("manager_phone", event.target.value)
                        }
                        autoComplete="tel"
                      />
                    </label>
                    <label>
                      <span>담당자 이메일 (선택)</span>
                      <input
                        type="email"
                        value={profile.manager_email}
                        onChange={(event) =>
                          updateProfile("manager_email", event.target.value)
                        }
                        autoComplete="email"
                      />
                    </label>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending
                  ? "입금 확인 요청 중..."
                  : "입금 확인 요청하기"}
              </button>
              <p className={styles.submitHelp}>
                운영팀이 실제 입금 내역을 확인하면 수납 및 세금계산서 상태가
                이 화면에 반영됩니다.
              </p>
            </form>
          )}
        </>
      )}

      {message && (
        <p
          className={styles.feedback}
          data-tone={message.tone}
          role={message.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message.text}
        </p>
      )}
    </section>
  );
}

function NoticeStatus({
  status,
  taxRequested,
  taxStatus,
  rejectionReason,
}: {
  status: "SUBMITTED" | "CONFIRMED" | "REJECTED";
  taxRequested: boolean;
  taxStatus: BankTransferNotice["tax_invoice_status"];
  rejectionReason: string;
}) {
  const isRejected = status === "REJECTED";
  const isConfirmed = status === "CONFIRMED";
  const taxIssued = taxStatus === "ISSUED";
  const taxFailed = taxStatus === "FAILED";
  return (
    <div
      className={styles.statusPanel}
      data-status={status.toLowerCase()}
      role="status"
      aria-live="polite"
    >
      <div className={styles.statusIcon}>
        {isRejected ? (
          "!"
        ) : isConfirmed ? (
          <Check size={20} />
        ) : (
          <Clock3 size={20} />
        )}
      </div>
      <div>
        <strong>
          {isRejected
            ? "입금 내역을 다시 확인해 주세요"
            : isConfirmed
              ? "입금이 확인되었습니다"
              : "입금 확인 요청이 접수되었습니다"}
        </strong>
        <p>
          {isRejected
            ? `${rejectionReason || "입금 내역을 찾지 못했습니다."} 사유를 확인한 뒤 입금자명과 이체 시각을 다시 입력해 주세요.`
            : isConfirmed
              ? taxRequested
                ? taxIssued
                  ? "입금 수납과 전자세금계산서 발행이 모두 완료되었습니다."
                  : taxFailed
                    ? "입금은 수납 처리되었지만 전자세금계산서 발행 중 문제가 발생했습니다. 운영팀이 다시 확인합니다."
                    : "입금은 수납 처리되었고, 전자세금계산서 발행을 준비하고 있습니다."
                : "입금이 수납 처리되었습니다."
              : "운영팀이 계좌 내역을 확인 중입니다. 결과는 이 화면에 표시됩니다."}
        </p>
      </div>
    </div>
  );
}
