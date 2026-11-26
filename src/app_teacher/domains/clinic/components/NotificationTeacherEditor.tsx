import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import ClinicNotificationTeacherField from "@/shared/ui/clinic/ClinicNotificationTeacherField";
import { extractApiError } from "@/shared/utils/extractApiError";
import { updateClinicSession, type TeacherClinicSession } from "../api";
import { teacherClinicQueryKeys } from "../queryKeys";
import { teacherToast } from "@teacher/shared/ui/teacherToast";

export default function NotificationTeacherEditor({ session }: { session: TeacherClinicSession }) {
  const qc = useQueryClient();
  const savedId = session.notification_teacher_id ?? null;
  const [value, setValue] = useState(savedId);
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: () => updateClinicSession(session.id, { notification_teacher_id: value }),
    onSuccess: async () => {
      teacherToast.success("예약 알림 담당 선생님을 저장했습니다.");
      setEditing(false);
      await qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.sessions });
    },
  });
  return <div className="px-4 pb-2">
    {!editing ? <Button size="sm" onClick={() => { setValue(savedId); save.reset(); setEditing(true); }}>예약 알림 담당 선생님 {savedId ? "변경" : "지정"}</Button>
      : <fieldset disabled={save.isPending} className="grid gap-2">
        <ClinicNotificationTeacherField value={value} onChange={setValue} />
        {save.isError && <p role="alert">{extractApiError(save.error, "담당 선생님을 저장하지 못했습니다. 다시 시도해 주세요.")}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setEditing(false)}>취소</Button>
          <Button size="sm" intent="primary" disabled={value === savedId} onClick={() => save.mutate()}>담당 선생님 저장</Button>
        </div>
      </fieldset>}
  </div>;
}
