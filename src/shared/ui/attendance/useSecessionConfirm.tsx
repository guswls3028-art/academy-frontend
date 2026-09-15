import { useCallback, useEffect, useRef, useState } from "react";
import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";
import { Button } from "@/shared/ui/ds";
import type { SecessionScope } from "@/shared/api/contracts/attendance";
import "./secession-confirm.css";

export function useSecessionConfirm() {
  const [studentName, setStudentName] = useState<string | null>(null);
  const [scope, setScope] = useState<SecessionScope>("session");
  const resolver = useRef<((value: SecessionScope | null) => void) | null>(null);
  useEffect(() => () => { resolver.current?.(null); }, []);

  const settle = useCallback((value: SecessionScope | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setStudentName(null);
  }, []);
  const confirmSecession = useCallback((name = "학생") => {
    resolver.current?.(null);
    setScope("session");
    setStudentName(name);
    return new Promise<SecessionScope | null>((resolve) => { resolver.current = resolve; });
  }, []);

  const secessionDialog = studentName === null ? null : (
    <AdminModal open onClose={() => settle(null)} type="confirm" noMinimize>
      <ModalHeader title="퇴원 범위 선택" description={`${studentName} 학생의 퇴원 범위를 선택해 주세요.`} type="confirm" />
      <ModalBody>
        <fieldset className="flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="sr-only">퇴원 범위</legend>
          {([
            ["session", "1. 이 차시만 퇴원", "현재 차시의 영상 권한과 시험·과제 대상을 해제합니다. 다른 차시 수강과 수납은 유지됩니다."],
            ["lecture", "2. 강의 전체 퇴원", "이 강의의 모든 차시 수강과 영상 권한을 해제하고 시험·과제 대상에서 제외합니다."],
          ] as const).map(([value, label, description]) => (
            <label key={value} className="secession-option flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors motion-reduce:transition-none"
              data-selected={scope === value}>
              <input type="radio" name="secession-scope" value={value} checked={scope === value}
                onChange={() => setScope(value)} className="mt-1 shrink-0" />
              <span className="min-w-0">
                <span className="block font-semibold">{label}</span>
                <span className="secession-description mt-1 block text-sm">{description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="secession-description mt-4 text-sm">기존 성적·출결·시청 기록은 보관됩니다.</p>
      </ModalBody>
      <ModalFooter right={<>
        <Button onClick={() => settle(null)}>취소</Button>
        <Button intent="danger" onClick={() => settle(scope)}>{scope === "session" ? "이 차시만 퇴원" : "강의 전체 퇴원"}</Button>
      </>} />
    </AdminModal>
  );
  return { confirmSecession, secessionDialog };
}
