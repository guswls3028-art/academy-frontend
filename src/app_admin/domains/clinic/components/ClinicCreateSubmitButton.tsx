import { Button } from "@/shared/ui/ds";

type Props = {
  disabled: boolean;
  isEdit: boolean;
  isPastDate: boolean;
  loading: boolean;
  maxParticipants: number;
  selectedCount: number;
  onClick: () => void;
};

export default function ClinicCreateSubmitButton({
  disabled,
  isEdit,
  isPastDate,
  loading,
  maxParticipants,
  selectedCount,
  onClick,
}: Props) {
  const label = isPastDate
    ? "지난 날짜입니다"
    : isEdit
      ? "클리닉 수정"
      : selectedCount > 0
        ? `${selectedCount}명 배정하고 클리닉 만들기`
        : `클리닉 만들기 (정원 ${maxParticipants}명)`;

  return (
    <Button type="button" intent="primary" size="lg" loading={loading} onClick={onClick} className="w-full" disabled={disabled}>
      {label}
    </Button>
  );
}
