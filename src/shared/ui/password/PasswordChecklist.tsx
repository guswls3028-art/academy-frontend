import { PASSWORD_MIN_LENGTH } from "@/shared/auth/passwordPolicy";
import styles from "./PasswordControls.module.css";

export default function PasswordChecklist({
  password,
  currentPassword,
  confirmation,
}: {
  password: string;
  currentPassword?: string;
  confirmation?: string;
}) {
  const checks = [
    {
      key: "length",
      label: `${PASSWORD_MIN_LENGTH}자 이상`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    ...(currentPassword !== undefined
      ? [{
          key: "different",
          label: "현재 비밀번호와 다름",
          met: currentPassword.length > 0 && password.length > 0 && password !== currentPassword,
        }]
      : []),
    ...(confirmation !== undefined
      ? [{
          key: "confirmation",
          label: "확인 입력과 일치",
          met: confirmation.length > 0 && password === confirmation,
        }]
      : []),
  ];

  return (
    <div className={styles.checklist} role="group" aria-label="새 비밀번호 확인 사항">
      <div className={styles.checklistTitle}>새 비밀번호 확인</div>
      <ul className={styles.checklistItems}>
        {checks.map((check) => (
          <li key={check.key} className={styles.checkItem} data-met={check.met}>
            <span className={styles.checkIcon} aria-hidden>{check.met ? "✓" : "·"}</span>
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
