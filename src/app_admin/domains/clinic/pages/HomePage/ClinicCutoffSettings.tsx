import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { updateClinicSettings, type ClinicCutoffPolicy, type ClinicSettings } from "../../api/clinicSettings.api";
import { clinicQueryKeys } from "../../queryKeys";
import styles from "./ClinicApprovalPanel.module.css";

export default function ClinicCutoffSettings({ settings }: { settings: ClinicSettings }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<ClinicCutoffPolicy>>({});
  const mode = draft.booking_cutoff_mode ?? settings.booking_cutoff_mode;
  const time = draft.booking_cutoff_time ?? settings.booking_cutoff_time;
  const minutes = draft.booking_cutoff_minutes ?? settings.booking_cutoff_minutes;
  const allowLate = draft.allow_late_requests ?? settings.allow_late_requests;
  const existing = settings.booking_cutoff_mode === "previous_day" ? `전날 ${settings.booking_cutoff_time}`
    : settings.booking_cutoff_mode === "before_start" ? `시작 ${settings.booking_cutoff_minutes}분 전` : "마감 없음";
  const save = useMutation({
    mutationFn: (policy: ClinicCutoffPolicy) => updateClinicSettings(undefined, undefined, undefined, policy),
    onSuccess: (updated) => {
      qc.setQueryData(clinicQueryKeys.settings, updated);
      setDraft({});
      void qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree });
    },
  });
  const change = (patch: Partial<ClinicCutoffPolicy>) => {
    save.reset();
    setDraft((values) => ({ ...values, ...patch }));
  };
  return <details className={`${styles.queue} ${styles.cutoff}`}>
    <summary>학생 예약 마감 <small>{existing}</small></summary>
    <p>마감 기준은 학원 전체 일정에 적용됩니다. 선생님은 마감 후에도 운영 화면에서 학생을 직접 등록할 수 있습니다.</p>
    {settings.capabilities.booking_policy.write ? <form onSubmit={(event) => {
      event.preventDefault();
      if (save.isPending) return;
      save.mutate({
        booking_cutoff_mode: mode,
        booking_cutoff_time: mode === "previous_day" ? time : settings.booking_cutoff_time,
        booking_cutoff_minutes: mode === "before_start" ? minutes : settings.booking_cutoff_minutes,
        allow_late_requests: allowLate,
      });
    }}>
      <label>마감 기준
        <select disabled={save.isPending} value={mode} onChange={(event) => change({ booking_cutoff_mode: event.target.value as ClinicCutoffPolicy["booking_cutoff_mode"] })}>
          <option value="none">마감 없음</option>
          <option value="previous_day">이용 전날 지정 시각</option>
          <option value="before_start">이용 시작 몇 분 전</option>
        </select>
      </label>
      {mode === "previous_day" && <label>전날 마감 시각 (한국 시간)
        <input type="time" required disabled={save.isPending} value={time} onChange={(event) => change({ booking_cutoff_time: event.target.value })} />
      </label>}
      {mode === "before_start" && <label>이용 시작 몇 분 전까지
        <input type="number" required min={1} max={525600} step={1} disabled={save.isPending} value={minutes || ""}
          onChange={(event) => change({ booking_cutoff_minutes: Number(event.target.value) })} />
      </label>}
      {mode !== "none" && <label><input type="checkbox" disabled={save.isPending} checked={allowLate}
        onChange={(event) => change({ allow_late_requests: event.target.checked })} />
        마감 후에도 시작 전까지 승인 대기로 신청 받기
      </label>}
      <Button type="submit" size="sm" intent="primary" disabled={!Object.keys(draft).length || save.isPending}>마감 설정 저장</Button>
      {save.isError && <span role="alert">{getApiErrorMessage(save.error, "마감 설정을 저장하지 못했습니다. 수정 후 다시 저장해 주세요.")}</span>}
      {save.isSuccess && <span role="status">마감 설정을 저장했습니다.</span>}
    </form> : <p>{settings.booking_cutoff_mode !== "none" && (settings.allow_late_requests ? "마감 후에도 시작 전까지 승인 대기로 신청할 수 있습니다. " : "마감 후에는 학생 신청이 종료됩니다. ")}학원 관리자에게 변경 권한이 있습니다.</p>}
  </details>;
}
