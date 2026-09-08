import type { ReactNode } from "react";

import { useConfirm } from "@/shared/ui/confirm";
import type { ClinicBookingRequest } from "../api/clinicBooking.api";
import styles from "./ClinicSelfCancelControl.module.css";

type Props = {
  booking: Pick<ClinicBookingRequest, "id" | "can_self_cancel" | "self_cancel_reason">;
  isPending: boolean;
  onCancel: (id: number) => void;
  children?: ReactNode;
};

export default function ClinicSelfCancelControl({
  booking,
  isPending,
  onCancel,
  children,
}: Props) {
  const confirm = useConfirm();
  const helpId = `clinic-cancel-help-${booking.id}`;

  return (
    <div className={styles.root}>
      <div className={styles.actions}>
        {children}
        <button
          type="button"
          className={styles.dangerAction}
          disabled={isPending || !booking.can_self_cancel}
          aria-describedby={helpId}
          onClick={async () => {
            if (await confirm({
              title: "예약 취소",
              message: "이 예약을 취소할까요? 학생과 학부모님께 취소 알림톡이 요청됩니다.",
              confirmText: "예약 취소",
              danger: true,
            })) {
              onCancel(booking.id);
            }
          }}
        >
          {booking.can_self_cancel ? "예약 취소" : "취소 불가"}
        </button>
      </div>
      <p id={helpId} className={styles.help}>
        {booking.self_cancel_reason}
      </p>
    </div>
  );
}
