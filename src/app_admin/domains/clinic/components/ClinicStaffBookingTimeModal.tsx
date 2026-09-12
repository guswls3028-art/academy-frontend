import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { ClinicActualTimePicker } from "@/shared/ui/clinic/ClinicActualTimePicker";
import { fetchClinicAvailability, type ClinicSessionTreeNode } from "../api/clinicSessions.api";

type Props = {
  open: boolean;
  session: ClinicSessionTreeNode | null;
  selectionCount: number;
  onClose: () => void;
  onConfirm: (bookingStart: string, bookingEnd: string) => Promise<boolean>;
};

export default function ClinicStaffBookingTimeModal({
  open,
  session,
  selectionCount,
  onClose,
  onConfirm,
}: Props) {
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [pending, setPending] = useState(false);
  const availabilityQ = useQuery({
    queryKey: ["clinic", "availability", session?.id],
    queryFn: () => fetchClinicAvailability(session!.id),
    enabled: open && session?.booking_mode === "time_range",
    retry: 0,
  });

  useEffect(() => {
    if (!open) return;
    setBookingStart("");
    setBookingEnd("");
  }, [open, session?.id]);

  const submit = async () => {
    if (!bookingStart || !bookingEnd || pending) return;
    setPending(true);
    try {
      if (await onConfirm(bookingStart, bookingEnd)) onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <AdminModal open={open} onClose={pending ? () => {} : onClose} type="action" width={620}>
      <ModalHeader
        type="action"
        title="실제 예약 시간 선택"
        description="학원이 정한 운영 시간은 그대로 두고, 선택한 학생이 실제 이용할 공통 구간을 정합니다. 다른 시간은 나누어 추가해 주세요."
      />
      <ModalBody>
        <ClinicActualTimePicker
          availability={availabilityQ.data}
          loading={availabilityQ.isLoading}
          error={availabilityQ.isError}
          bookingStart={bookingStart}
          bookingEnd={bookingEnd}
          onBookingStartChange={setBookingStart}
          onBookingEndChange={setBookingEnd}
          onRetry={() => void availabilityQ.refetch()}
          tone="admin"
          selectionCount={selectionCount}
        />
      </ModalBody>
      <ModalFooter
        right={(
          <>
            <Button intent="secondary" onClick={onClose} disabled={pending}>취소</Button>
            <Button
              intent="primary"
              onClick={() => void submit()}
              disabled={!bookingStart || !bookingEnd || pending || availabilityQ.isLoading || availabilityQ.isError}
            >
              {pending ? "추가 중…" : `이 시간으로 ${selectionCount}명 추가`}
            </Button>
          </>
        )}
      />
    </AdminModal>
  );
}
