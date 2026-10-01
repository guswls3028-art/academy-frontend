import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/shared/ui/ds";
import { fetchAccountPasswordSettings, saveAccountPasswordSettings, type AccountPasswordPolicy } from "@/shared/api/contracts/students";
import { extractApiError } from "@/shared/utils/extractApiError";

export default function AccountPasswordSettings() {
  const id = useId();
  const [policy, setPolicy] = useState<AccountPasswordPolicy | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [changedRoles, setChangedRoles] = useState<Partial<Record<"student" | "parent", boolean>>>({});
  const load = useCallback(async () => {
    setError(""); setBusy(true);
    try { setPolicy(await fetchAccountPasswordSettings()); setChangedRoles({}); }
    catch (cause) { setError(extractApiError(cause, "초기 비밀번호 설정을 불러오지 못했습니다.")); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    if (!policy) return;
    const changes: Partial<AccountPasswordPolicy> = {};
    for (const role of ["student", "parent"] as const) {
      if (!changedRoles[role]) continue;
      const mode = policy[`${role}_mode`];
      if (!mode || (mode === "fixed" && policy[`${role}_fixed_password`].length < 4)) {
        setError("방식을 선택하고 직접 입력 비밀번호는 4자 이상 입력해 주세요.");
        return;
      }
      changes[`${role}_mode`] = mode;
      if (mode === "fixed") changes[`${role}_fixed_password`] = policy[`${role}_fixed_password`];
    }
    if (!Object.keys(changes).length) { setMessage("변경한 설정이 없습니다."); return; }
    setBusy(true); setError(""); setMessage("");
    try { setPolicy(await saveAccountPasswordSettings(changes)); setChangedRoles({}); setMessage("초기 비밀번호 설정을 저장했습니다. 신규 계정부터 적용됩니다."); }
    catch (cause) { setError(extractApiError(cause, "설정을 저장하지 못했습니다. 입력값을 확인하고 다시 시도하세요.")); }
    finally { setBusy(false); }
  }
  return (
    <details className="mb-3 min-w-0 rounded-lg border border-[var(--color-border)] p-3">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">학생 · 학부모 초기 비밀번호 설정</summary>
      <div className="mt-2 space-y-3">
        <p className="text-sm">학원 기본값을 직접 선택해 저장합니다. 미설정 값은 자동으로 채우지 않습니다. 등록 마지막 확인창에서 방식을 다시 선택하며 기존 계정은 유지합니다.</p>
        {!policy && !error && <p role="status">설정을 확인하고 있습니다.</p>}
        {policy && (["student", "parent"] as const).map((role) => (
          <div key={role} className="min-w-0 space-y-2">
            <label htmlFor={`${id}-${role}`} className="block text-sm font-medium">{role === "student" ? "학생" : "학부모"} 초기 비밀번호 방식</label>
            <select id={`${id}-${role}`} className="ds-input w-full" value={policy[`${role}_mode`] ?? ""} disabled={busy}
              onChange={(event) => { setPolicy({ ...policy, [`${role}_mode`]: event.target.value }); setChangedRoles({ ...changedRoles, [role]: true }); }}>
              <option value="" disabled>미설정 · 방식을 선택해 주세요</option>
              <option value="fixed">직접 입력</option>
              <option value="phone_last4">본인 전화번호 뒤 4자리</option>
              <option value="random">6자리 숫자 자동 생성</option>
            </select>
            {policy[`${role}_mode`] === "fixed" && <>
              <label htmlFor={`${id}-${role}-fixed`} className="block text-sm">{role === "student" ? "학생" : "학부모"} 공통 초기 비밀번호</label>
              <input id={`${id}-${role}-fixed`} className="ds-input w-full" type="password" autoComplete="new-password" minLength={4}
                value={policy[`${role}_fixed_password`]} disabled={busy} placeholder="4자 이상 입력"
                onChange={(event) => { setPolicy({ ...policy, [`${role}_fixed_password`]: event.target.value }); setChangedRoles({ ...changedRoles, [role]: true }); }} />
            </>}
          </div>
        ))}
        <p className="text-xs text-[var(--color-text-secondary)]">본인 전화번호가 없으면 등록 확인창에서 직접 입력 또는 랜덤 번호를 선택하세요. 계정 안내 알림톡에는 실제 로그인 가능한 아이디와 비밀번호가 들어갑니다.</p>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {policy ? <Button type="button" onClick={() => void save()} disabled={busy}>{busy ? "저장 중…" : "초기 비밀번호 설정 저장"}</Button>
          : <Button type="button" onClick={() => void load()} disabled={busy}>설정 다시 불러오기</Button>}
      </div>
    </details>
  );
}
