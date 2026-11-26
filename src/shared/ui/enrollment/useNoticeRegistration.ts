import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import useAuth from "@/auth/hooks/useAuth";
import {
  fetchRegistrationReceipt, registerWithNotices, registrationSession,
  type NoticeChoices, type NoticeRegistration, type RegistrationReceipt,
} from "@/shared/api/contracts/registrationNotices";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";
import { useConfirm } from "@/shared/ui/confirm";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import { getSessionItem, removeSessionItem, setSessionItem } from "@/shared/utils/safeSessionStorage";
import { extractApiError } from "@/shared/utils/extractApiError";

export const defaultNotices: NoticeChoices = { student_notice: "auto", parent_notice: "auto" };

export function useRegistrationScope(lecture: number) {
  const { user } = useAuth();
  return getTenantUserLocalKey(`lecture-notice-registration:${lecture}`, user?.id);
}

type Recovery = { body: NoticeRegistration; acknowledged: boolean };

function readPending(key: string | null, lecture: number): Recovery | null {
  if (!key) return null;
  try {
    const record = JSON.parse(getSessionItem(key) || "null");
    const body = record?.body;
    if (body?.lecture === lecture && typeof body.request_id === "string"
      && Array.isArray(body.students) && body.students.length && body.students.every(Number.isSafeInteger)
      && [body.student_notice, body.parent_notice].every(mode => ["auto", "send", "skip"].includes(mode))) return { body, acknowledged: record.acknowledged === true };
  } catch { /* A malformed browser hint has no authority over server state. */ }
  return null;
}

export function useNoticeRegistration(lecture: number) {
  const scope = useRegistrationScope(lecture);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [recovery, setRecovery] = useState(() => readPending(scope, lecture));
  const pending = recovery?.body;
  const [choices, setChoices] = useState<NoticeChoices>(() => pending
    ? { student_notice: pending.student_notice, parent_notice: pending.parent_notice } : defaultNotices);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [retryMissing, setRetryMissing] = useState(false);
  const [error, setError] = useState("");
  const explicit = choices.student_notice === "send" || choices.parent_notice === "send";

  async function submit(ids: number[], verifyRoster: (ids: number[]) => Promise<void>): Promise<boolean> {
    if (lock.current || (!pending && !ids.length)) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    let receipt: RegistrationReceipt | null = null;
    let posting = false;
    try {
      if (!scope) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 시도해 주세요.");
      const config = registrationSession();
      if (!pending && explicit) {
        const targets = [choices.student_notice === "send" && "학생", choices.parent_notice === "send" && "학부모"].filter(Boolean).join("·");
        if (!await confirm({
          title: "이미 안내받은 사람에게도 발송할까요?",
          message: `선택한 ${ids.length}명의 ${targets} 연락처로 계정 안내를 요청합니다. 이미 안내를 받은 사람도 다시 받을 수 있습니다.`,
          confirmText: "중복 발송 가능성 확인 후 진행",
        })) return false;
      }
      const body = pending ?? { ...choices, lecture, students: ids, request_id: crypto.randomUUID() };
      if (pending) receipt = await fetchRegistrationReceipt(lecture, body.request_id, config);
      if (pending && !receipt && recovery?.acknowledged) {
        setError("등록 요청은 완료됐지만 발송 결과를 아직 조회할 수 없습니다. 잠시 후 다시 확인해 주세요.");
        return false;
      }
      if (pending && !receipt && !retryMissing) {
        setRetryMissing(true);
        setError("서버에서 이전 등록 요청을 아직 찾지 못했습니다. 같은 요청으로 다시 시도할 수 있습니다.");
        return false;
      }
      if (!receipt) {
        const awaiting = { body, acknowledged: false };
        const serialized = JSON.stringify(awaiting);
        setSessionItem(scope, serialized);
        if (getSessionItem(scope) !== serialized) throw new Error("이 탭에 복구 정보를 저장할 수 없습니다. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.");
        setRecovery(awaiting);
        posting = true;
        receipt = await registerWithNotices(body, config);
        posting = false;
      }
      if (receipt?.request_id !== body.request_id || receipt.lecture !== lecture || receipt.students.length !== body.students.length
        || new Set(receipt.students.map(row => row.id)).size !== body.students.length
        || !receipt.students.every(row => body.students.includes(row.id))) {
        throw new Error("이번 등록 결과를 확인하지 못했습니다. 결과를 다시 확인해 주세요.");
      }
      const acknowledged = { body, acknowledged: true };
      setRecovery(acknowledged);
      setSessionItem(scope, JSON.stringify(acknowledged));
      await verifyRoster(body.students);
      const queryKey = notificationQueryKeys.registration(scope);
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData(queryKey, receipt);
      removeSessionItem(scope);
      setRecovery(null);
      return true;
    } catch (cause) {
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      if (posting && scope && status && [400, 403, 404, 422].includes(status)) {
        removeSessionItem(scope);
        setRecovery(null);
        setRetryMissing(false);
        setError("등록을 완료하지 못했습니다. " + extractApiError(cause, "학생과 발송 설정을 확인하고 다시 시도해 주세요."));
      } else if (receipt) {
        setError("등록 요청은 완료됐지만 저장된 명단을 확인하지 못했습니다. 아래 버튼으로 결과만 다시 확인해 주세요.");
      } else {
        setError(posting || pending ? "등록 결과를 확인하지 못했습니다. 같은 요청의 결과를 다시 확인해 주세요."
          : extractApiError(cause, "등록을 시작하지 못했습니다. 다시 시도해 주세요."));
      }
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return { choices, setChoices, pending, busy, locked: busy || !!pending, error, explicit, submit,
    retryLabel: retryMissing ? "같은 요청으로 다시 시도" : "등록 결과 다시 확인" };
}
