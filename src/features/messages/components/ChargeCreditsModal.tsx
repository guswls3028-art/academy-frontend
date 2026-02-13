// PATH: src/features/messages/components/ChargeCreditsModal.tsx
// 크레딧 충전 모달 — 결제 완료 후 잔액 업데이트

import { useState } from "react";
import { Input } from "antd";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { useChargeCredits } from "../hooks/useMessagingInfo";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ChargeCreditsModal({ open, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const { mutateAsync: charge, isPending } = useChargeCredits();

  const handleSubmit = async () => {
    const value = amount.trim();
    if (!value || Number(value) <= 0) return;
    try {
      await charge(value);
      setAmount("");
      onClose();
    } catch {
      // 에러 토스트는 mutation/전역에서 처리 가능
    }
  };

  return (
    <AdminModal open={open} onClose={onClose} width={400}>
      <ModalHeader title="알림톡 크레딧 충전" />
      <ModalBody>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          결제를 완료한 후, 충전할 금액을 입력하고 확인하세요.
        </p>
        <Input
          type="number"
          min={1}
          placeholder="충전 금액 (원)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onPressEnter={handleSubmit}
          disabled={isPending}
          style={{ width: "100%" }}
        />
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={handleSubmit}
              disabled={!amount.trim() || Number(amount) <= 0 || isPending}
            >
              {isPending ? "처리 중…" : "결제 후 충전"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
