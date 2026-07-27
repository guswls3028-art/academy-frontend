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
  type BusinessProfile,
} from "../api/billing.api";
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
    message?: string;
  };
  const detail = candidate.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  const fieldError = candidate.response?.data
    ? Object.values(candidate.response.data).find(Array.isArray)
    : null;
  if (Array.isArray(fieldError) && typeof fieldError[0] === "string") {
    return fieldError[0];
  }
  return candidate.message || "요청을 처리하지 못했습니다.";
}

export default function BankTransferSection() {
  const queryClient = useQueryClient();
  const profileHydrated = useRef(false);
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

  const { data, isLoading, isError } = useQuery({
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

  const activeInvoice = useMemo(
    () =>
      data?.invoices.find((invoice) =>
        ["PENDING", "OVERDUE"].includes(invoice.status),
      ) ?? data?.invoices[0],
    [data?.invoices],
  );
  const notice = activeInvoice?.bank_transfer_notice;
  const canSubmit =
    activeInvoice &&
    ["PENDING", "OVERDUE"].includes(activeInvoice.status) &&
    (!notice || notice.status === "REJECTED");

  const activateMutation = useMutation({
    mutationFn: activateBankTransfer,
    onSuccess: (summary) => {
      queryClient.setQueryData(adminSettingsQueryKeys.bankTransfer, summary);
      queryClient.invalidateQueries({
        queryKey: adminSettingsQueryKeys.subscriptionInfo,
      });
      setMessage({
        tone: "success",
        text: "계좌이체 청구가 준비되었습니다. 아래 계좌로 이체해 주세요.",
      });
    },
    onError: (error) => {
      setMessage({ tone: "error", text: errorMessage(error) });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!activeInvoice) throw new Error("입금할 청구서가 없습니다.");
      if (taxInvoiceRequested) {
        await saveBusinessProfile(profile);
      }
      return submitBankTransferNotice({
        invoice_id: activeInvoice.id,
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
        text: "입금 확인을 요청했습니다. 확인이 끝나면 구독에 자동 반영됩니다.",
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
        <p className={styles.errorBox}>계좌이체 정보를 불러오지 못했습니다.</p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="bank-transfer-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>BANK TRANSFER</span>
          <h3 id="bank-transfer-title">계좌이체 결제</h3>
          <p>PG 가입비 없이 바로 이체하고, 입금 확인을 요청할 수 있습니다.</p>
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
              aria-label="계좌번호 복사"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "복사됨" : "번호 복사"}
            </button>
          </div>

          {data.billing_mode !== "INVOICE_REQUEST" && (
            <div className={styles.activation}>
              <div>
                <strong>계좌이체로 납부하시겠어요?</strong>
                <p>현재 예정된 카드 청구를 계좌이체 청구로 변경합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending}
              >
                {activateMutation.isPending
                  ? "청구서 준비 중..."
                  : "계좌이체로 결제하기"}
              </button>
            </div>
          )}

          {activeInvoice && data.billing_mode === "INVOICE_REQUEST" && (
            <div className={styles.invoiceBand}>
              <div>
                <span>납부할 금액</span>
                <strong>{formatWon(activeInvoice.total_amount)}</strong>
                <small>
                  공급가 {formatWon(activeInvoice.supply_amount)} · 부가세{" "}
                  {formatWon(activeInvoice.tax_amount)}
                </small>
              </div>
              <dl>
                <div>
                  <dt>청구번호</dt>
                  <dd>{activeInvoice.invoice_number}</dd>
                </div>
                <div>
                  <dt>납부기한</dt>
                  <dd>{activeInvoice.due_date}</dd>
                </div>
              </dl>
            </div>
          )}

          {!activeInvoice && data.billing_mode === "INVOICE_REQUEST" && (
            <div className={styles.unavailable}>
              현재 납부할 청구서가 없습니다. 다음 청구일에 자동으로 표시됩니다.
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

          {canSubmit && (
            <form
              className={styles.form}
              onSubmit={handleSubmit}
              aria-busy={submitMutation.isPending}
            >
              <div className={styles.formHeading}>
                <div className={styles.stepNumber}>1</div>
                <div>
                  <h4>이체 후 입금 정보를 알려주세요</h4>
                  <p>실제 계좌 입금 내역과 대조한 뒤 이용 기간이 갱신됩니다.</p>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <label>
                  <span>입금자명</span>
                  <input
                    value={depositorName}
                    onChange={(event) => setDepositorName(event.target.value)}
                    maxLength={100}
                    required
                    placeholder="통장에 표시되는 이름"
                  />
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
                  <strong>전자세금계산서 발행 요청</strong>
                  <small>입금 확인 후 아래 이메일로 발행합니다.</small>
                </span>
              </label>

              {taxInvoiceRequested && (
                <div className={styles.businessPanel}>
                  <div className={styles.formHeading}>
                    <div className={styles.stepNumber}>2</div>
                    <div>
                      <h4>사업자 정보</h4>
                      <p>국세청 발행 정보이므로 사업자등록증과 같게 입력해 주세요.</p>
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
                      />
                    </label>
                    <label className={styles.wideField}>
                      <span>사업장 주소</span>
                      <input
                        value={profile.address}
                        onChange={(event) =>
                          updateProfile("address", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>업태</span>
                      <input
                        value={profile.business_type}
                        onChange={(event) =>
                          updateProfile("business_type", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>종목</span>
                      <input
                        value={profile.business_item}
                        onChange={(event) =>
                          updateProfile("business_item", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>담당자명</span>
                      <input
                        value={profile.manager_name}
                        onChange={(event) =>
                          updateProfile("manager_name", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>담당자 연락처</span>
                      <input
                        value={profile.manager_phone}
                        onChange={(event) =>
                          updateProfile("manager_phone", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>담당자 이메일</span>
                      <input
                        type="email"
                        value={profile.manager_email}
                        onChange={(event) =>
                          updateProfile("manager_email", event.target.value)
                        }
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
                  : "입금 확인 요청"}
              </button>
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
  taxStatus: string;
  rejectionReason: string;
}) {
  const isRejected = status === "REJECTED";
  const isConfirmed = status === "CONFIRMED";
  const taxIssued = taxStatus === "ISSUED";
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
              : "입금 확인 중입니다"}
        </strong>
        <p>
          {isRejected
            ? rejectionReason || "입금 내역을 찾지 못했습니다."
            : isConfirmed
              ? taxRequested
                ? taxIssued
                  ? "전자세금계산서 발행이 완료되었습니다."
                  : "전자세금계산서 발행을 준비하고 있습니다."
                : "구독 기간에 결제가 반영되었습니다."
              : "운영 계좌 입금 내역과 대조하고 있습니다."}
        </p>
      </div>
    </div>
  );
}
