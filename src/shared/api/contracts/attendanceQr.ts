import api from "@/shared/api/axios";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";

export type QrKind = "class" | "clinic";
export type QrAction = "check_in" | "check_out";
export type QrPoint = {
  id: number; label: string; kind: QrKind; lecture_id: number | null;
  location: string; token: string; active: boolean;
};
export type QrChoice = {
  id: number; label: string; date: string; start_time: string | null; status: string;
  checked_in_at: string | null; checked_out_at: string | null;
  can_check_in: boolean; can_check_out: boolean;
};
export type QrResolution = { point: Pick<QrPoint, "label" | "kind">; choices: QrChoice[] };
export type QrReceipt = {
  detail: string; already_recorded: boolean; kind: QrKind; target_id: number;
  status: string; recorded_at: string | null; checked_in_at: string | null; checked_out_at: string | null;
};
export const QR_SCAN_PATH = "/student/attendance/scan";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function qrUrl(token: string, sessionId?: number) {
  // Older scanners accept only "qr". They must never widen a session sign to a whole lecture.
  const hash = sessionId === undefined
    ? new URLSearchParams({ qr: token })
    : new URLSearchParams({ class_qr: token, session: String(sessionId) });
  return `${window.location.origin}${QR_SCAN_PATH}#${hash}`;
}

export function parseQrUrl(raw: string, origin = window.location.origin) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("학원에서 발급한 출결 QR을 촬영해 주세요."); }
  if (url.origin !== origin || url.pathname !== QR_SCAN_PATH || url.search) {
    throw new Error("현재 로그인한 학원의 출결 QR이 아닙니다.");
  }
  const hash = new URLSearchParams(url.hash.slice(1));
  const scoped = hash.has("class_qr") || hash.has("session");
  const token = hash.get(scoped ? "class_qr" : "qr");
  const rawSession = hash.get("session") ?? "";
  const sessionId = scoped ? Number(rawSession) : null;
  if (!token || !uuidPattern.test(token) || Array.from(hash).length !== (scoped ? 2 : 1)
      || (scoped && (!/^[1-9]\d*$/.test(rawSession) || !Number.isSafeInteger(sessionId)))) {
    throw new Error("출결 QR을 다시 확인해 주세요.");
  }
  return { token, sessionId };
}

export async function resolveAttendanceQr(token: string) {
  const { data } = await api.post<QrResolution>("/student/attendance/qr/resolve/", { token });
  return { ...data, choices: data.choices.map((choice) => ({ ...choice, label: richHtmlToPlainText(choice.label) })) };
}
export async function recordAttendanceQr(token: string, target_id: number, action: QrAction) {
  return (await api.post<QrReceipt>("/student/attendance/qr/record/", { token, target_id, action })).data;
}
