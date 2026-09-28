import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { fetchSuppressedTemplateDefaults, restoreDefaultTemplates } from "../api/messages.api";
import { messageQueryKeys } from "../queryKeys";

export default function TemplateRestorePanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: messageQueryKeys.suppressedDefaults,
    queryFn: fetchSuppressedTemplateDefaults,
    enabled: open,
  });
  const restore = useMutation({
    mutationFn: restoreDefaultTemplates,
    onSuccess: () => {
      setSelected([]);
      void qc.invalidateQueries({ queryKey: messageQueryKeys.suppressedDefaults });
      void qc.invalidateQueries({ queryKey: messageQueryKeys.templates });
      void qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
      feedback.success("선택한 제공 문구를 복원했습니다. 기존 사용자 문구와 자동발송 켜짐·꺼짐은 유지됩니다.");
    },
    onError: (error) => feedback.error(extractApiError(error, "제공 문구를 복원하지 못했습니다. 선택한 항목을 유지했습니다.")),
  });
  return <details className="message-template-help" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>다시 쓸 제공 문구 선택 복원</summary>
    <p>삭제한 문구는 자동으로 다시 만들지 않습니다. 다시 쓸 제공 문구만 선택하세요.</p>
    {isLoading ? <p role="status">제공 문구를 확인하는 중…</p>
      : isError ? <div role="alert">목록을 확인하지 못했습니다. <Button size="sm" onClick={() => void refetch()}>다시 확인</Button></div>
        : data.length === 0 ? <p>복원할 제공 문구가 없습니다.</p>
          : <>
            {data.map((item) => <label className="message-template-restore" key={item.key}>
              <input type="checkbox" checked={selected.includes(item.key)} disabled={restore.isPending}
                onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.key] : current.filter((key) => key !== item.key))} />
              {item.name}
            </label>)}
            <Button size="sm" intent="secondary" disabled={selected.length === 0 || restore.isPending}
              onClick={() => restore.mutate(selected)}>{restore.isPending ? "복원 중…" : `선택한 ${selected.length}개 문구 복원`}</Button>
          </>}
  </details>;
}
