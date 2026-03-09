/**
 * 클리닉 패스카드 — 대시보드에서 열리는 오버레이(포탈)
 * 실시간 3색 변경 후 즉시 학생 앱에 반영
 */
import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import { MODAL_WIDTH } from "@/shared/ui/modal";
import ClinicRemoteControl from "./ClinicRemoteControl";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ClinicPasscardModal({ open, onClose }: Props) {
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      width={MODAL_WIDTH.wide}
      className="clinic-passcard-modal"
    >
      <ModalHeader title="클리닉 패스카드" onClose={onClose} />
      <ModalBody>
        <div className="p-4 sm:p-5">
          <ClinicRemoteControl embedded />
        </div>
      </ModalBody>
    </AdminModal>
  );
}
