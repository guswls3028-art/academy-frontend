import { createRef, useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useConfirm } from "@/shared/ui/confirm";
import type { ConfirmOptions } from "@/shared/ui/confirm/ConfirmDialog";
import { fetchAccountPasswordSettings, type AccountPasswordMode, type AccountPasswordPolicy } from "@/shared/api/contracts/students";

type Role = "student" | "parent";
export type RegistrationPasswordChoice = {
  initialPasswordMode?: AccountPasswordMode;
  parentInitialPasswordMode?: AccountPasswordMode;
  initialPassword: string;
  parentInitialPassword: string;
};
type PasswordChoiceOptions = {
  studentPhone?: string;
  parentPhone?: string;
  studentPhoneAvailable?: boolean;
  parentPhoneAvailable?: boolean;
  studentPassword?: string;
  parentPassword?: string;
  studentAlreadySelected?: boolean;
  parentAlreadySelected?: boolean;
  publicSignup?: boolean;
};
type ChoiceHandle = { validate: () => boolean; value: () => RegistrationPasswordChoice };
const METHODS: Array<{ value: AccountPasswordMode; label: string }> = [
  { value: "fixed", label: "직접 입력" },
  { value: "phone_last4", label: "전화번호 뒤 4자리" },
  { value: "random", label: "랜덤 번호" },
];

function PasswordChoices({ choiceRef, ...options }: PasswordChoiceOptions & { choiceRef: Ref<ChoiceHandle> }) {
  const id = useId();
  const groups = useRef<Partial<Record<Role, HTMLFieldSetElement>>>({});
  const [modes, setModes] = useState<Record<Role, AccountPasswordMode | null>>({ student: null, parent: null });
  const [passwords, setPasswords] = useState({ student: options.studentPassword ?? "", parent: options.parentPassword ?? "" });
  const [errors, setErrors] = useState<Partial<Record<Role, string>>>({});
  const [visible, setVisible] = useState(false);
  const [defaults, setDefaults] = useState<AccountPasswordPolicy | null>(null);
  const [defaultError, setDefaultError] = useState(false);
  const roles: Role[] = [];
  if (!options.studentAlreadySelected) roles.push("student");
  if (!options.parentAlreadySelected) roles.push("parent");
  const validPhone = (value?: string) => /^010\d{8}$/.test(value ?? "");
  const available: Record<Role, boolean> = {
    student: options.studentPhoneAvailable ?? (validPhone(options.studentPhone) && options.studentPhone !== options.parentPhone),
    parent: options.parentPhoneAvailable ?? validPhone(options.parentPhone),
  };
  useEffect(() => {
    if (options.publicSignup) return;
    let active = true;
    void fetchAccountPasswordSettings().then((policy) => {
      if (!active) return;
      setDefaults(policy);
      setPasswords((current) => ({
        student: current.student || policy.student_fixed_password || "",
        parent: current.parent || policy.parent_fixed_password || "",
      }));
    }).catch(() => { if (active) setDefaultError(true); });
    return () => { active = false; };
  }, [options.publicSignup]);
  useImperativeHandle(choiceRef, () => ({
    validate() {
      const next: Partial<Record<Role, string>> = {};
      for (const role of roles) {
        const label = role === "student" ? "학생" : "학부모";
        if (!modes[role]) next[role] = `${label} 비밀번호 방식을 선택해 주세요.`;
        else if (modes[role] === "fixed" && passwords[role].length < 4) next[role] = `${label} 비밀번호를 4자 이상 입력해 주세요.`;
        else if (modes[role] === "phone_last4" && !available[role]) next[role] = `${label} 본인 번호가 없습니다. 직접 입력 또는 랜덤 번호를 선택해 주세요.`;
      }
      setErrors(next);
      const first = roles.find((role) => next[role]);
      if (first) groups.current[first]?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
      return !first;
    },
    value: () => ({
      initialPasswordMode: modes.student ?? undefined,
      parentInitialPasswordMode: modes.parent ?? undefined,
      initialPassword: modes.student === "fixed" ? passwords.student : "",
      parentInitialPassword: modes.parent === "fixed" ? passwords.parent : "",
    }),
  }));
  return (
    <div className="my-3 min-w-0 space-y-3">
      <p className="text-sm">{roles.length ? "초기 비밀번호 방식을 선택해 주세요. 기본 설정은 자동 선택되지 않습니다." : "가입 신청에서 선택한 비밀번호를 유지합니다."}</p>
      {options.studentAlreadySelected && <p className="text-sm">학생 비밀번호는 유지합니다.</p>}
      {options.parentAlreadySelected && <p className="text-sm">학부모의 가입 신청 비밀번호 선택도 유지합니다.</p>}
      {roles.map((role) => {
        const label = role === "student" ? "학생" : "학부모";
        const saved = defaults?.[`${role}_mode`];
        return (
          <fieldset key={role} ref={(node) => { groups.current[role] = node ?? undefined; }} className="min-w-0 space-y-2 rounded-lg border border-[var(--color-border)] p-3">
            <legend className="px-1 font-semibold">{label} 초기 비밀번호</legend>
            {!options.publicSignup && <p className="text-xs">학원 기본 설정: {METHODS.find((method) => method.value === saved)?.label ?? "미설정"}</p>}
            <div className="grid grid-cols-3 gap-1.5">
              {METHODS.map((method) => (
                <label key={method.value} className="flex min-h-11 min-w-0 items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary-subtle)] has-[:disabled]:opacity-50">
                  <input type="radio" name={`${id}-${role}-method`} value={method.value} checked={modes[role] === method.value}
                    disabled={method.value === "phone_last4" && !available[role]}
                    onChange={() => { setModes({ ...modes, [role]: method.value }); setErrors({ ...errors, [role]: "" }); }} />
                  <span>{method.label}</span>
                </label>
              ))}
            </div>
            {!available[role] && <p className="text-xs">본인 전화번호가 없어 전화번호 방식은 사용할 수 없습니다. 직접 입력 또는 랜덤 번호를 선택하세요.</p>}
            {modes[role] === "fixed" && <div className="space-y-1">
              <label htmlFor={`${id}-${role}-password`} className="block text-sm">{label} 직접 입력 비밀번호</label>
              <input id={`${id}-${role}-password`} type={visible ? "text" : "password"} autoComplete="new-password" minLength={4}
                className="ds-input w-full min-w-0" value={passwords[role]} onChange={(event) => setPasswords({ ...passwords, [role]: event.target.value })} />
            </div>}
            {modes[role] === "random" && <p className="text-xs">등록할 때 서버에서 6자리 숫자를 생성합니다.</p>}
            {errors[role] && <p role="alert" className="text-sm text-[var(--color-danger)]">{errors[role]}</p>}
          </fieldset>
        );
      })}
      <button type="button" className="min-h-11 text-sm underline" aria-pressed={visible} onClick={() => setVisible(!visible)}>비밀번호 {visible ? "숨기기" : "보기"}</button>
      <p className="text-xs">기존 학부모 계정의 비밀번호는 유지하며 선택한 학부모 방식은 신규 계정에만 적용합니다.</p>
      {defaultError && <p role="status" className="text-xs">학원 기본 설정을 불러오지 못했습니다. 등록 방식은 직접 선택할 수 있습니다.</p>}
    </div>
  );
}

export function useRegistrationPasswordConfirmation() {
  const confirm = useConfirm();
  return async (options: PasswordChoiceOptions & Omit<ConfirmOptions, "content" | "validate" | "rememberKey">): Promise<RegistrationPasswordChoice | null> => {
    const choiceRef = createRef<ChoiceHandle>();
    let value: RegistrationPasswordChoice | null = null;
    const confirmed = await confirm({
      ...options,
      content: <PasswordChoices {...options} choiceRef={choiceRef} />,
      validate: () => {
        if (!choiceRef.current?.validate()) return false;
        value = choiceRef.current.value();
        return true;
      },
    });
    return confirmed ? value : null;
  };
}
