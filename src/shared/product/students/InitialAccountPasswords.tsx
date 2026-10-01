import { useId, useState } from "react";

interface Props {
  studentPassword: string;
  parentPassword: string;
  onStudentChange: (value: string) => void;
  onParentChange: (value: string) => void;
  disabled?: boolean;
}

export default function InitialAccountPasswords(props: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <fieldset className="min-w-0 space-y-2 rounded-lg border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-semibold">초기 로그인 비밀번호</legend>
      {(["student", "parent"] as const).map((role) => (
        <div key={role} className="min-w-0 space-y-1">
          <label htmlFor={`${id}-${role}`} className="block text-sm font-medium">
            {role === "student" ? "학생" : "학부모"} 초기 비밀번호 (선택)
          </label>
          <input id={`${id}-${role}`} name={role === "student" ? "initialPassword" : "parentInitialPassword"}
            type={visible ? "text" : "password"} autoComplete="new-password" minLength={4}
            value={role === "student" ? props.studentPassword : props.parentPassword}
            onChange={(event) => (role === "student" ? props.onStudentChange : props.onParentChange)(event.target.value)}
            placeholder="비우면 학원 초기 비밀번호 설정 적용" className="ds-input w-full min-w-0"
            disabled={props.disabled} />
        </div>
      ))}
      <button type="button" className="min-h-11 text-sm underline" aria-pressed={visible}
        disabled={props.disabled} onClick={() => setVisible(!visible)}>
        비밀번호 {visible ? "숨기기" : "보기"}
      </button>
      <p className="text-xs text-[var(--color-text-secondary)]">
        직접 입력하려면 4자 이상 입력하세요. 번호 뒤 4자리 방식은 학생·학부모 각자의 번호를 사용하며,
        학생 번호가 없으면 6자리 숫자를 생성합니다. 기존 학부모 비밀번호는 유지합니다.
      </p>
    </fieldset>
  );
}
