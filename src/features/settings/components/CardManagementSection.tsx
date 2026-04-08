// PATH: src/features/settings/components/CardManagementSection.tsx
// 결제 카드 관리 섹션 — 등록된 카드 조회, 삭제, 새 카드 등록 (Toss Payments)

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm/useConfirm";
import {
  fetchCards,
  deleteCard,
  prepareCardRegistration,
  type BillingCard,
} from "../api/billing.api";
import { requestBillingAuth } from "../api/toss.helper";
import styles from "./CardManagementSection.module.css";

export default function CardManagementSection() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [registerError, setRegisterError] = useState<string | null>(null);

  // ── 카드 목록 조회 ──
  const {
    data: cards,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["billing-cards"],
    queryFn: fetchCards,
    staleTime: 30_000,
    retry: 1,
  });

  // ── 카드 삭제 ──
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-cards"] });
    },
  });

  // ── 카드 등록 준비 + Toss SDK 호출 ──
  const registerMut = useMutation({
    mutationFn: prepareCardRegistration,
    onSuccess: async (params) => {
      try {
        setRegisterError(null);
        await requestBillingAuth(params);
        // Toss가 successUrl로 리다이렉트 — 여기 이후 코드는 실행되지 않음
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "카드 등록 중 오류가 발생했습니다.";
        setRegisterError(message);
      }
    },
    onError: () => {
      setRegisterError("카드 등록 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });

  const handleDelete = async (card: BillingCard) => {
    const ok = await confirm({
      title: "카드 삭제",
      message: `${card.card_company} ${card.card_number_masked}\n이 카드를 삭제하시겠습니까?`,
      confirmText: "삭제",
      cancelText: "취소",
      danger: true,
    });
    if (ok) {
      deleteMut.mutate(card.id);
    }
  };

  const handleRegister = () => {
    setRegisterError(null);
    registerMut.mutate();
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>결제 카드</h3>
        </div>
        <div className={styles.loadingBox}>불러오는 중...</div>
      </div>
    );
  }

  // ── Error state ──
  if (isError) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>결제 카드</h3>
        </div>
        <div className={styles.errorBox}>
          카드 정보를 불러오지 못했습니다.
        </div>
      </div>
    );
  }

  const activeCards = cards?.filter((c) => c.is_active) ?? [];
  const hasCards = activeCards.length > 0;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>결제 카드</h3>
        <p className={styles.sectionDescription}>
          자동결제에 사용할 카드를 관리합니다.
        </p>
      </div>

      {/* ── 등록된 카드 목록 ── */}
      {hasCards ? (
        <div className={styles.cardList}>
          {activeCards.map((card) => (
            <div key={card.id} className={styles.cardItem}>
              <div className={styles.cardInfo}>
                <span className={styles.cardIcon}>
                  <CreditCardIcon />
                </span>
                <div className={styles.cardDetails}>
                  <span className={styles.cardNumber}>
                    {card.card_number_masked}
                  </span>
                  <span className={styles.cardCompany}>{card.card_company}</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDelete(card)}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending && deleteMut.variables === card.id
                  ? "삭제 중..."
                  : "삭제"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyBox}>
          <span className={styles.emptyIcon}>
            <CreditCardIcon />
          </span>
          <p className={styles.emptyText}>등록된 카드가 없습니다.</p>
          <p className={styles.emptySubtext}>
            자동결제를 위해 카드를 등록해 주세요.
          </p>
        </div>
      )}

      {/* ── 에러 메시지 ── */}
      {(registerError || deleteMut.isError) && (
        <div className={styles.errorMessage}>
          {registerError ??
            "카드 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요."}
        </div>
      )}

      {/* ── 카드 등록 버튼 ── */}
      <button
        type="button"
        className={styles.registerBtn}
        onClick={handleRegister}
        disabled={registerMut.isPending}
      >
        {registerMut.isPending ? (
          <span className={styles.registerBtnLoading}>준비 중...</span>
        ) : (
          <>
            <PlusIcon />
            카드 등록
          </>
        )}
      </button>
    </div>
  );
}

// ── Inline SVG icons ──

function CreditCardIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
