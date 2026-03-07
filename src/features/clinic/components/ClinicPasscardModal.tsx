/**
 * 클리닉 패스카드 설정 모달 — 대시보드 바로가기 등에서 사용
 * 리모컨(실시간 3색 변경) + 저장을 모달로 제공
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
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.wide}>
      <ModalHeader title="클리닉 패스카드 설정" onClose={onClose} />
      <ModalBody>
        <div className="p-5">
          <ClinicRemoteControl />
        </div>
      </ModalBody>
    </AdminModal>
  );
}
