import api from "@/shared/api/axios";
import { downloadPresignedUrl } from "@/shared/utils/safeDownload";

export type Range = { from_session_order: number; to_session_order: number };
export type Material = { type: "exam" | "homework"; id: number };
export type RangeSource = Material & {
  title: string;
  session_order: number;
  question_numbers: number[];
  unavailable_numbers: number[];
  enrollment_ids: number[];
  ready: boolean;
};
export type Selection = {
  enrollment_id: number;
  sources: (Material & { numbers: number[] })[];
};
type Catalog = Range & {
  lecture_id: number;
  students: { enrollment_id: number; student_id: number; name: string }[];
  sources: RangeSource[];
};
type Status = "PENDING" | "RUNNING" | "DONE" | "FAILED";
export type Batch = {
  id: number;
  status: Status;
  students: { enrollment_id: number; name: string; status: Status; error_message?: string }[];
};

const root = "/results/wrong-notes";
export async function loadRange(lectureId: number, range: Range) {
  return (await api.get<Catalog>(`${root}/range/`, { params: { lecture_id: lectureId, ...range } })).data;
}
export async function createBatch(lectureId: number, range: Range, students: Selection[]) {
  return (await api.post<Batch>(`${root}/batches/`, { lecture_id: lectureId, ...range, students })).data;
}
export async function loadBatch(id: number) {
  return (await api.get<Batch>(`${root}/batches/${id}/`)).data;
}
export async function retryBatch(id: number) {
  return (await api.post<Batch>(`${root}/batches/${id}/retry/`)).data;
}
export async function downloadBatch(batch: Batch) {
  const { data } = await api.get<{ url: string; filename: string }>(`${root}/batches/${batch.id}/download/`);
  if (!data.filename || !data.url?.startsWith("https://")) throw new Error("다운로드 주소를 받지 못했습니다. 다시 시도해 주세요.");
  downloadPresignedUrl(data.url, data.filename);
}

export const sourceKey = (s: Material) => `${s.type}:${s.id}`;
export const fieldKey = (enrollmentId: number, s: Material) => `${enrollmentId}:${sourceKey(s)}`;

/** An empty cell is an intentional omission. Preserve invalid cells for correction. */
export function prepareSelection(catalog: Catalog, values: Record<string, string>) {
  const students: Selection[] = [];
  const errors = new Map<string, string>();
  const seen = new Set<string>();
  for (const { enrollment_id } of catalog.students) {
    const sources: Selection["sources"] = [];
    for (const source of catalog.sources) {
      const key = fieldKey(enrollment_id, source);
      const raw = values[key]?.trim();
      if (!raw || !source.enrollment_ids.includes(enrollment_id)) continue;
      seen.add(key);
      const parts = raw.split(/[,，\s]+/u).filter(Boolean);
      const numbers = [...new Set(parts.map(Number))].sort((a, b) => a - b);
      if (!parts.length || parts.some(part => !/^[1-9]\d*$/.test(part))) {
        errors.set(key, "문항 번호를 쉼표나 공백으로 구분해 주세요.");
      } else if (!source.ready || numbers.some(n => !source.question_numbers.includes(n) || source.unavailable_numbers.includes(n))) {
        errors.set(key, "문제와 정답이 준비된 번호만 입력해 주세요.");
      } else {
        sources.push({ type: source.type, id: source.id, numbers });
      }
    }
    if (sources.length) students.push({ enrollment_id, sources });
  }
  const stale = Object.keys(values).filter(key => values[key]?.trim() && !seen.has(key));
  return { students, errors, stale };
}
