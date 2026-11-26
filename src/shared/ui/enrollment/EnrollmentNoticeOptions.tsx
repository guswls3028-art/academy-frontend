import useAuth from "@/auth/hooks/useAuth";
import { canSendManualAlimtalk } from "@/shared/messaging/messagePermissions";
import type { NoticeChoices, NoticeMode } from "@/shared/api/contracts/registrationNotices";
import styles from "./EnrollmentNotices.module.css";

const modes: Record<NoticeMode, string> = { auto: "첫 수강 시 자동 발송", send: "기존 수신자 포함 발송", skip: "발송 안 함" };

export default function EnrollmentNoticeOptions({ choices, disabled, onChange }: {
  choices: NoticeChoices; disabled: boolean; onChange: (next: NoticeChoices) => void;
}) {
  const { user } = useAuth();
  const canChoose = canSendManualAlimtalk(user?.tenantRole);
  return <div className={styles.options}>
    <p><strong>기본 설정에서는 첫 수강 확정 시 학생·학부모에게 로그인 정보 알림톡을 자동 발송합니다.</strong></p>
    {canChoose && <details>
      <summary>수신자별 발송 설정{(choices.student_notice !== "auto" || choices.parent_notice !== "auto") && " · 변경됨"}</summary>
      <div className={styles.fields}>
        {(["student_notice", "parent_notice"] as const).map(key => <label key={key}>
          {key === "student_notice" ? "학생" : "학부모"}
          <select aria-label={key === "student_notice" ? "학생 안내 발송" : "학부모 안내 발송"}
            value={choices[key]} disabled={disabled} onChange={event => onChange({ ...choices, [key]: event.target.value as NoticeMode })}>
            {Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>)}
      </div>
      <p>학부모 안내에는 학생 로그인 정보도 포함됩니다. 첫 수강에서 발송을 끈 수신자에게는 이후 수강 등록 때도 자동 발송하지 않습니다.</p>
    </details>}
    {(choices.student_notice !== "auto" || choices.parent_notice !== "auto") &&
      <p className={styles.chosen}>학생 · {modes[choices.student_notice]} / 학부모 · {modes[choices.parent_notice]}</p>}
  </div>;
}
