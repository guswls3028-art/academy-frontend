import { useRef } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import ApprovalPolicyPanel from "@/shared/product/approvals/ApprovalPolicyPanel";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import { fetchClinicSettings, updateClinicSettings } from "../../api/clinicSettings.api";
import { patchClinicParticipantStatus, type ClinicParticipant } from "../../api/clinicParticipants.api";
import { clinicQueryKeys } from "../../queryKeys";
import { hhmmText } from "@/shared/ui/time/timeFormat";
import styles from "./ClinicApprovalPanel.module.css";

export default function ClinicApprovalPanel() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();
  const submitting = useRef(false);
  const { listQ } = useClinicParticipants({ status: "pending" });
  const settingsQ = useQuery({ queryKey: clinicQueryKeys.settings, queryFn: fetchClinicSettings, staleTime: 60_000 });
  const settingsM = useMutation({
    mutationFn: (enabled: boolean) => updateClinicSettings(undefined, undefined, enabled),
    onMutate: () => qc.cancelQueries({ queryKey: clinicQueryKeys.settings }),
    onSuccess: (settings) => qc.setQueryData(clinicQueryKeys.settings, settings),
  });
  const approvalM = useMutation({
    mutationFn: async (rows: ClinicParticipant[]) => {
      const failures: Array<{ name: string; detail: string }> = [];
      let approved = 0;
      // Keep large queues from issuing one request per student simultaneously.
      for (let start = 0; start < rows.length; start += 4) {
        const group = rows.slice(start, start + 4);
        const results = await Promise.allSettled(group.map((row) => patchClinicParticipantStatus(row.id, { status: "booked" })));
        results.forEach((result, index) => {
          if (result.status === "fulfilled") approved++;
          else failures.push({ name: group[index].student_name, detail: getApiErrorMessage(result.reason, "예약을 다시 확인해 주세요.") });
        });
      }
      return { approved, failures };
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: clinicQueryKeys.participants }),
        qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree }),
        qc.invalidateQueries({ queryKey: clinicQueryKeys.notificationCounts }),
      ]);
    },
  });
  const rows = listQ.data ?? [];
  const approveAll = async () => {
    if (submitting.current || approvalM.isPending || listQ.isError || !rows.length) return;
    submitting.current = true;
    const targets = [...rows];
    try {
      const ok = await confirm({ title: "예약 일괄 승인", message: `현재 대기 중인 ${targets.length}건을 승인합니다. 학생 화면에서도 예약이 확정됩니다. 신청별 시간과 요청사항은 ‘대기 신청 보기’에서 확인할 수 있습니다.`, confirmText: `${targets.length}건 승인` });
      if (ok) await approvalM.mutateAsync(targets).catch(() => undefined);
    } finally { submitting.current = false; }
  };
  return <div className={styles.root}>
    <ApprovalPolicyPanel title="예약 자동 승인" enabled={settingsQ.data?.auto_approve_booking === true}
      enabledDescription="학생이 예약을 신청하면 바로 확정됩니다."
      disabledDescription="학생의 예약은 대기 상태로 접수되며, 선생님이 승인하면 확정됩니다."
      loading={settingsQ.isLoading} loadError={settingsQ.isError} saving={settingsM.isPending} saved={settingsM.isSuccess}
      saveError={settingsM.isError ? getApiErrorMessage(settingsM.error, "설정을 저장하지 못했습니다.") : null}
      onChange={(enabled) => settingsM.mutate(enabled)} onReload={() => void settingsQ.refetch()}
      onRetry={() => { if (settingsM.variables !== undefined) settingsM.mutate(settingsM.variables); }} />
    <section className={styles.queue} aria-labelledby="clinic-approval-title">
      <div className={styles.heading}>
        <h3 id="clinic-approval-title">예약 승인 대기 {!listQ.isLoading && !listQ.isError && <Badge tone={rows.length ? "warning" : "neutral"}>{rows.length}건</Badge>}</h3>
        {!listQ.isLoading && !listQ.isError && rows.length > 0 && <div className={styles.actions}>
          <Button size="sm" disabled={approvalM.isPending} onClick={() => nav("/workspace/clinic/operations?panel=unresolved&focus=pending")}>대기 신청 보기</Button>
          <Button intent="primary" size="sm" loading={approvalM.isPending} onClick={() => void approveAll()}>일괄 승인</Button>
        </div>}
      </div>
      {listQ.isLoading ? <p role="status">대기 중인 예약을 불러오는 중…</p> : listQ.isError ? <div className={styles.result} role="alert">
        <span>예약 승인 대기 목록을 불러오지 못했습니다.</span>
        <Button size="sm" onClick={() => void listQ.refetch()}>목록 다시 시도</Button>
      </div> : rows.length === 0 ? <p>대기 중인 예약이 없습니다. 확정된 예약은 오늘 운영에서 확인할 수 있습니다.</p>
        : <>
          <ul className={styles.preview}>{rows.slice(0, 3).map((row) => <li key={row.id}>
            <strong>{row.student_name}</strong>
            <span>{row.session_date} {hhmmText(row.session_start_time)}{row.session_location ? ` · ${row.session_location}` : ""}</span>
          </li>)}</ul>
          {rows.length > 3 && <p>외 {rows.length - 3}건 · 대기 신청 보기에서 모든 신청을 확인하세요.</p>}
        </>}
      {approvalM.data && <div className={styles.result} data-error={approvalM.data.failures.length > 0} role={approvalM.data.failures.length ? "alert" : "status"}>
        <strong>{approvalM.data.approved}건 승인{approvalM.data.failures.length ? ` · ${approvalM.data.failures.length}건 실패` : "했습니다."}</strong>
        {approvalM.data.failures.length > 0 && <>
          <p>실패한 예약은 대기 상태로 남아 있습니다. 내용을 확인한 뒤 다시 승인해 주세요.</p>
          <ul>{approvalM.data.failures.map((failure, index) => <li key={index}>{failure.name}: {failure.detail}</li>)}</ul>
        </>}
      </div>}
      {approvalM.isError && <p className={styles.result} role="alert">{getApiErrorMessage(approvalM.error, "예약을 처리하지 못했습니다. 목록을 확인한 뒤 다시 시도해 주세요.")}</p>}
    </section>
  </div>;
}
