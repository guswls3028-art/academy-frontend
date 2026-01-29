// PATH: src/features/staff/components/StaffDeleteButton.tsx
import api from "@/shared/api/axios";

type Props = {
  staffId: number;
  staffName: string;
  payType: "HOURLY" | "MONTHLY"; // MONTHLY = 강사
  onDeleted: () => void;
};

export default function StaffDeleteButton({
  staffId,
  staffName,
  payType,
  onDeleted,
}: Props) {
  const onDelete = async () => {
    const isTeacher = payType === "MONTHLY";

    const message = isTeacher
      ? [
          `⚠️ 강사 삭제 경고`,
          ``,
          `강사 "${staffName}"를 삭제하면`,
          `- 연결된 강사(Teacher) 정보`,
          `- 연결된 계정(User)`,
          `모두 함께 삭제됩니다.`,
          ``,
          `정말 삭제하시겠습니까?`,
        ].join("\n")
      : `조교 "${staffName}"를 삭제하시겠습니까?`;

    const ok = window.confirm(message);
    if (!ok) return;

    await api.delete(`/staffs/${staffId}/`);
    onDeleted();
  };

  return (
    <button
      onClick={onDelete}
      className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:opacity-90"
    >
      삭제
    </button>
  );
}
