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

export function qrUrl(token: string, origin = window.location.origin) {
  return `${origin}${QR_SCAN_PATH}#qr=${encodeURIComponent(token)}`;
}

export function parseQrUrl(raw: string, origin = window.location.origin): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("학원에서 발급한 출결 QR을 촬영해 주세요."); }
  if (url.origin !== origin || url.pathname !== QR_SCAN_PATH || url.search) {
    throw new Error("현재 로그인한 학원의 출결 QR이 아닙니다.");
  }
  const token = new URLSearchParams(url.hash.slice(1)).get("qr");
  if (!token || !uuidPattern.test(token)) throw new Error("출결 QR을 다시 확인해 주세요.");
  return token;
}

export async function resolveAttendanceQr(token: string) {
  const { data } = await api.post<QrResolution>("/student/attendance/qr/resolve/", { token });
  return { ...data, choices: data.choices.map((choice) => ({ ...choice, label: richHtmlToPlainText(choice.label) })) };
}
export async function recordAttendanceQr(token: string, target_id: number, action: QrAction) {
  return (await api.post<QrReceipt>("/student/attendance/qr/record/", { token, target_id, action })).data;
}
