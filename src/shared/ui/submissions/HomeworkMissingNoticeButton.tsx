import { useState } from "react";
import useAuth from "@/auth/hooks/useAuth";
import { canSendManualAlimtalk } from "@/shared/messaging/messagePermissions";
import { Button } from "@/shared/ui/ds";
import NotificationPreviewModal from "@/shared/ui/notifications/NotificationPreviewModal";

export default function HomeworkMissingNoticeButton({ homeworkId }: { homeworkId: number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!canSendManualAlimtalk(user?.tenantRole)) return null;

  return (
    <>
      <Button type="button" intent="ghost" size="sm" onClick={() => setOpen(true)}>
        미제출 알림 발송
      </Button>
      {open && (
        <NotificationPreviewModal
          open
          onClose={() => setOpen(false)}
          mode="manual"
          trigger="assignment_not_submitted"
          contextSource={{ type: "assignment_not_submitted", homework_id: homeworkId }}
          label="과제 미제출 알림"
          sendTo="parent"
        />
      )}
    </>
  );
}
