import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback";
import styles from "./ClassGroupsPage.module.css";
import { dawonLectureEndpoint, dawonLectureKey, useDawonLecture, type DawonLecture } from "./useDawonLecture";

export default function DawonTopReferenceButton({ lectureId, onSaved }: {
  lectureId: number; onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const client = useQueryClient();
  const result = useDawonLecture(lectureId, open);
  const value = draft ?? String(result.data?.top_reference_percent ?? "");
  const valid = /^\d{1,3}$/.test(value) && +value >= 1 && +value <= 100;
  const save = useMutation({
    mutationFn: async () => (await api.patch<DawonLecture>(dawonLectureEndpoint(lectureId), { top_reference_percent: Number(value) })).data,
    onSuccess: (saved) => {
      client.setQueryData(dawonLectureKey(lectureId), saved);
      setOpen(false);
      onSaved?.();
      feedback.success(`이 강의의 비교 기준을 상위 ${saved.top_reference_percent}% 평균으로 저장했습니다.`);
    },
  });

  return <>
    <Button size="sm" intent="secondary" onClick={() => { setDraft(null); save.reset(); setOpen(true); }}>비교 기준</Button>
    {open && <AdminModal open onClose={() => setOpen(false)} width={460} noMinimize trapFocus closeDisabled={save.isPending}>
      <ModalHeader title="시험 성적 비교 기준" description={result.data?.name} />
      <ModalBody>
        {result.isPending ? <p role="status">비교 기준을 불러오는 중입니다.</p> : result.isError
          ? <p role="alert">비교 기준을 불러오지 못했습니다. <Button onClick={() => void result.refetch()}>다시 시도</Button></p>
          : result.data.top_reference_percent == null ? <p>반에 연결된 수업에서 비교 기준을 설정할 수 있습니다.</p> : <div className={styles.form}>
            <label>상위 학생 비율 (%)
              <input type="number" min={1} max={100} step={1} value={value} onChange={(event) => setDraft(event.target.value)}
                disabled={!result.data.can_edit_top_reference || save.isPending}
                aria-describedby="dawon-reference-help"
              />
            </label>
            <p id="dawon-reference-help">이 강의의 채점 완료 학생 중 상위 비율에 해당하는 학생들의 평균을 씁니다. 기본값은 30%입니다.</p>
            {!result.data.can_edit_top_reference && <p>담당 선생님이나 관리자가 기준을 변경할 수 있습니다.</p>}
            {draft !== null && !valid && <p role="alert">1부터 100 사이의 정수를 입력해 주세요.</p>}
            {save.isError && <p role="alert">{getApiErrorMessage(save.error, "저장하지 못했습니다. 다시 시도해 주세요.")}</p>}
          </div>}
      </ModalBody>
      <ModalFooter right={<>
        <Button onClick={() => setOpen(false)} disabled={save.isPending}>닫기</Button>
        {result.data?.can_edit_top_reference && <Button intent="primary" disabled={!valid || save.isPending || value === String(result.data.top_reference_percent)}
          loading={save.isPending} onClick={() => save.mutate()}>기준 저장</Button>}
      </>} />
    </AdminModal>}
  </>;
}
