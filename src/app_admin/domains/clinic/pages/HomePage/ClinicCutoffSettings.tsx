import { useId, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { updateClinicSettings, type ClinicCutoffPolicy, type ClinicSettings } from "../../api/clinicSettings.api";
import { clinicQueryKeys } from "../../queryKeys";
import styles from "./ClinicCutoffSettings.module.css";

export default function ClinicCutoffSettings({ settings }: { settings: ClinicSettings }) {
  const qc = useQueryClient();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ClinicCutoffPolicy>>({});
  const mode = draft.booking_cutoff_mode ?? settings.booking_cutoff_mode;
  const time = draft.booking_cutoff_time ?? settings.booking_cutoff_time;
  const minutes = draft.booking_cutoff_minutes ?? settings.booking_cutoff_minutes;
  const allowLate = draft.allow_late_requests ?? settings.allow_late_requests;
  const existing = settings.booking_cutoff_mode === "previous_day" ? `전날 ${settings.booking_cutoff_time} (한국 시간)`
    : settings.booking_cutoff_mode === "before_start" ? `시작 ${settings.booking_cutoff_minutes}분 전` : "마감 없음";
  const lateRule = settings.booking_cutoff_mode === "none" ? "해당 없음"
    : settings.allow_late_requests ? "시작 전까지 승인 대기로 접수" : "신청 종료";
  const changed = mode !== settings.booking_cutoff_mode || allowLate !== settings.allow_late_requests
    || (mode === "previous_day" && time !== settings.booking_cutoff_time)
    || (mode === "before_start" && minutes !== settings.booking_cutoff_minutes);
  const restoreEditFocus = useRef(false);
  useLayoutEffect(() => {
    if (editing || !restoreEditFocus.current) return;
    restoreEditFocus.current = false;
    document.getElementById(id + "-edit")?.focus({ preventScroll: true });
  }, [editing, id]);

  const closeEditor = () => {
    restoreEditFocus.current = true;
    setEditing(false);
    setDraft({});
  };
  const save = useMutation({
    mutationFn: (policy: ClinicCutoffPolicy) => updateClinicSettings(undefined, undefined, undefined, policy),
    onSuccess: (updated) => {
      qc.setQueryData(clinicQueryKeys.settings, updated);
      closeEditor();
      void qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree });
    },
  });
  const change = (patch: Partial<ClinicCutoffPolicy>) => {
    save.reset();
    setDraft((values) => ({ ...values, ...patch }));
  };
  const canEdit = settings.capabilities.booking_policy.write;

  return (
    <section className={styles.panel} aria-labelledby={id + "-title"}>
      <header className={styles.heading}>
        <div>
          <h3 id={id + "-title"}>학생 예약 마감</h3>
          <p>학원 전체 클리닉 일정에 적용합니다.</p>
        </div>
        {canEdit && !editing && (
          <Button id={id + "-edit"} size="sm" onClick={() => { save.reset(); setEditing(true); }}>
            마감 설정 변경
          </Button>
        )}
      </header>
      <dl className={styles.overview} aria-label="현재 예약 정책">
        <div><dt>마감 기준</dt><dd>{existing}</dd></div>
        <div><dt>마감 후 학생 신청</dt><dd>{lateRule}</dd></div>
        <div><dt>교직원 직접 등록</dt><dd>마감 후에도 가능</dd></div>
      </dl>
      {!canEdit && <p className={styles.hint}>학원 관리자에게 변경 권한이 있습니다.</p>}
      <div role="status" className={styles.feedback}>{save.isSuccess && "마감 설정을 저장했습니다."}</div>
      {canEdit && editing && (
        <form className={styles.form} aria-label="학생 예약 마감 편집" onSubmit={(event) => {
          event.preventDefault();
          if (!changed || save.isPending) return;
          save.mutate({
            booking_cutoff_mode: mode,
            booking_cutoff_time: mode === "previous_day" ? time : settings.booking_cutoff_time,
            booking_cutoff_minutes: mode === "before_start" ? minutes : settings.booking_cutoff_minutes,
            allow_late_requests: allowLate,
          });
        }}>
          <h4>변경할 설정</h4>
          <div className={styles.fields}>
            <label className={styles.field}>마감 기준
              <select autoFocus disabled={save.isPending} value={mode} onChange={(event) => change({ booking_cutoff_mode: event.target.value as ClinicCutoffPolicy["booking_cutoff_mode"] })}>
                <option value="none">마감 없음</option>
                <option value="previous_day">이용 전날 지정 시각</option>
                <option value="before_start">이용 시작 몇 분 전</option>
              </select>
            </label>
            {mode === "previous_day" && <label className={styles.field}>전날 마감 시각 (한국 시간)
              <input type="time" required disabled={save.isPending} value={time} onChange={(event) => change({ booking_cutoff_time: event.target.value })} />
            </label>}
            {mode === "before_start" && <label className={styles.field}>이용 시작 몇 분 전까지
              <input type="number" required min={1} max={525600} step={1} disabled={save.isPending} value={minutes || ""}
                onChange={(event) => change({ booking_cutoff_minutes: Number(event.target.value) })} />
            </label>}
            {mode !== "none" && <label className={styles.late}>
              <span>마감 후 학생 신청</span>
              <span><input type="checkbox" disabled={save.isPending} checked={allowLate}
                onChange={(event) => change({ allow_late_requests: event.target.checked })} />시작 전까지 승인 대기로 받기</span>
            </label>}
          </div>
          {save.isError && <p className={styles.error} role="alert">{getApiErrorMessage(save.error, "마감 설정을 저장하지 못했습니다. 다시 저장해 주세요.")}</p>}
          <div className={styles.actions}>
            <Button size="sm" disabled={save.isPending} onClick={() => { save.reset(); closeEditor(); }}>취소</Button>
            <Button type="submit" size="sm" intent="primary" disabled={!changed} loading={save.isPending}>마감 설정 저장</Button>
          </div>
        </form>
      )}
    </section>
  );
}
