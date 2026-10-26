import { useId } from "react";
import { Switch } from "antd";
import { Badge, Button } from "@/shared/ui/ds";
import styles from "./ApprovalPolicyPanel.module.css";

type Props = {
  title: string;
  enabled: boolean;
  enabledDescription: string;
  disabledDescription: string;
  loading: boolean;
  loadError: boolean;
  saving: boolean;
  saveError: string | null;
  saved: boolean;
  onChange: (enabled: boolean) => void;
  onReload: () => void;
  onRetry: () => void;
};

/** 가입/예약의 현재 서버 설정과 저장 결과를 같은 방식으로 보여 준다. */
export default function ApprovalPolicyPanel(props: Props) {
  const id = useId();
  const unavailable = props.loading || props.loadError;
  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <div className={styles.copy}>
          <h3 id={`${id}-title`}>{props.title}</h3>
          <p id={`${id}-description`}>
            {unavailable ? "현재 승인 방식을 확인하고 있습니다." : props.enabled ? props.enabledDescription : props.disabledDescription}
          </p>
        </div>
        {!unavailable && <div className={styles.control}>
          <Badge tone={props.enabled ? "success" : "neutral"}>{props.enabled ? "자동 승인" : "직접 승인"}</Badge>
          <Switch aria-label={props.title} aria-describedby={`${id}-description`} checked={props.enabled}
            loading={props.saving} disabled={props.saving} onChange={props.onChange} />
        </div>}
      </div>
      {props.loading ? <p className={styles.note} role="status">설정 불러오는 중…</p>
        : props.loadError ? <div className={styles.error} role="alert">
          <span>승인 설정을 불러오지 못했습니다.</span>
          <Button size="sm" onClick={props.onReload}>설정 다시 시도</Button>
        </div> : <>
          <p className={styles.note}>새 신청부터 적용하며, 기존 대기 신청은 직접 처리합니다.</p>
          {props.saveError ? <div className={styles.error} role="alert">
            <span>{props.saveError} 현재 표시된 설정은 마지막 저장값입니다.</span>
            <Button size="sm" disabled={props.saving} onClick={props.onRetry}>저장 다시 시도</Button>
          </div> : <p className={styles.status} role="status" aria-live="polite">
            {props.saving ? "설정 저장 중…" : props.saved ? "승인 설정을 저장했습니다." : "변경하면 바로 저장됩니다."}
          </p>}
        </>}
    </section>
  );
}
