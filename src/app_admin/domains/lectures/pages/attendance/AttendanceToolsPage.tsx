import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/shared/ui/ds";
import AttendanceQrManager from "@/shared/ui/attendance/AttendanceQrManager";
import styles from "./AttendanceToolsPage.module.css";

type Props = {
  listPath: string;
  lectureId?: number;
  selectedCount: number;
  selectionActions: ReactNode;
  notice: ReactNode;
  busy: boolean;
  onNotify: (type: "check_in" | "absent") => void;
  onMarkAllPresent: () => void;
  onDownload: () => void;
};

export default function AttendanceToolsPage(props: Props) {
  return <section className={styles.page} aria-labelledby="attendance-tools-title">
    <header className={styles.header}>
      <Link to={props.listPath}>← 출결 명단</Link>
      <h2 id="attendance-tools-title">출결 도구</h2>
      <p>필요한 작업을 선택하세요. 출결을 바꾸거나 안내를 보낼 때는 대상과 내용을 다시 확인합니다.</p>
    </header>
    {props.notice}
    <section className={styles.group} aria-label="출결 안내">
      <h3>출결 안내</h3>
      <p>QR을 준비하거나 입실·결석 안내의 대상과 내용을 미리 확인합니다.</p>
      <div className={styles.actions}>
        {props.lectureId && <AttendanceQrManager kind="class" lectureId={props.lectureId} />}
        <Button size="lg" intent="secondary" onClick={() => props.onNotify("check_in")}>입실 알림 발송</Button>
        <Button size="lg" intent="secondary" onClick={() => props.onNotify("absent")}>결석 알림 발송</Button>
      </div>
    </section>
    <section className={styles.group} aria-label="전체 명단 도구">
      <h3>전체 명단</h3>
      <p>이 차시의 출결을 일괄 변경하거나 강의 전체의 출결 기록을 파일로 받습니다.</p>
      <div className={styles.actions}>
        <Button size="lg" intent="secondary" onClick={props.onMarkAllPresent} disabled={props.busy}>
          {props.busy ? "처리 중…" : "전체 현장 출석"}
        </Button>
        <Button size="lg" intent="secondary" onClick={props.onDownload}>엑셀 다운로드</Button>
      </div>
    </section>
    <section className={styles.group} aria-label="선택한 학생 도구">
      <h3>선택한 학생</h3>
      <p>명단에서 선택한 학생의 수업 결과를 안내하거나 이 차시에서 제외합니다.</p>
      {props.selectedCount === 0 && <Link className={styles.selectLink} to={props.listPath}>명단에서 학생 선택</Link>}
      {props.selectionActions}
    </section>
  </section>;
}
