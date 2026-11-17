import { useState } from "react";
import { useLocation } from "react-router";
import { Modal } from "antd";
import BugReportForm from "./BugReportForm";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function BugReportDialog({ open, onClose }: Props) {
  const { pathname } = useLocation();
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal
      title="버그 제보"
      open={open}
      onCancel={() => { if (!submitting) onClose(); }}
      closable={!submitting}
      keyboard={!submitting}
      footer={null}
      destroyOnHidden
      maskClosable={false}
      width={480}
    >
      <BugReportForm route={pathname} onClose={onClose} onSubmittingChange={setSubmitting} />
    </Modal>
  );
}
