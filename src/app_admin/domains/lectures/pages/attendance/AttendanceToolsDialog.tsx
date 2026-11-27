import type { ReactNode } from "react";
import { Button } from "@/shared/ui/ds";
import AttendanceQrManager from "@/shared/ui/attendance/AttendanceQrManager";
import { AdminModal, ModalBody, ModalHeader } from "@/shared/ui/modal";
import styles from "./AttendanceToolsPage.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  lectureId?: number;
  selectedCount: number;
  scheduleScoped?: boolean;
  selectionActions: ReactNode;
  bulkPresentBusy: boolean;
  deleting: boolean;
  onNotify: (type: "check_in" | "absent") => void;
  onMarkAllPresent: () => void;
  onDownload: () => void;
};

export default function AttendanceToolsDialog(props: Props) {
  const busy = props.bulkPresentBusy || props.deleting;

  return (
    <AdminModal open={props.open} onClose={props.onClose} size="form" noMinimize trapFocus closeDisabled={busy}>
      <ModalHeader title="출결 도구" noIcon />
      <ModalBody>
        <div className={styles.tools}>
          <section className={styles.group} aria-label="출결 안내">
            <h3>출결 안내</h3>
            <div className={styles.actions}>
              {props.lectureId && <AttendanceQrManager kind="class" lectureId={props.lectureId} />}
              <Button size="lg" intent="secondary" onClick={() => props.onNotify("check_in")}>입실 알림 발송</Button>
              <Button size="lg" intent="secondary" onClick={() => props.onNotify("absent")}>결석 알림 발송</Button>
            </div>
          </section>
          <section className={styles.group} aria-label={props.scheduleScoped ? "수업일 명단 도구" : "전체 명단 도구"}>
            <h3>{props.scheduleScoped ? "선택한 수업일" : "전체 명단"}</h3>
            {props.scheduleScoped && <p>현장 출석은 선택한 수업일에 적용됩니다. 엑셀에는 강의 전체 출결 기록이 담깁니다.</p>}
            <div className={styles.actions}>
              <Button size="lg" intent="secondary" onClick={props.onMarkAllPresent} disabled={busy}>
                {props.bulkPresentBusy ? "처리 중…" : props.scheduleScoped ? "수업일 현장 출석" : "전체 현장 출석"}
              </Button>
              <Button size="lg" intent="secondary" onClick={props.onDownload}>엑셀 다운로드</Button>
            </div>
          </section>
          <section className={styles.group} aria-label="선택한 학생 도구">
            <h3>선택한 학생</h3>
            {props.selectedCount === 0 && (
              <Button size="lg" intent="ghost" onClick={props.onClose} disabled={busy}>명단에서 학생 선택</Button>
            )}
            {props.selectionActions}
          </section>
        </div>
      </ModalBody>
    </AdminModal>
  );
}
