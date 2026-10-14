import api from "@/shared/api/axios";

export type ConversionOptions = {
  level: "questions" | "explanations" | "thorough";
  grouping: "separate" | "copies";
  redraw: boolean;
  require_review: boolean;
  external_ai_confirmed: boolean;
  subject: string;
};
export type ConversionAsset = { url: string; filename: string; mime: string; width?: number; height?: number; source_name?: string; page_number?: number };
export type QuestionContent = { prompt: string; choices: string[]; answer: string; explanation: string; crop: [number, number, number, number] | null; page_index: number | null };
export type ConversionQuestion = QuestionContent & {
  id: string; number: number; source_name: string; source_number: number; page_index: number | null;
  reviewed: boolean; review_flags: string[]; visual?: ConversionAsset; redrawn?: ConversionAsset;
  proposal?: Partial<QuestionContent> & { redrawn?: ConversionAsset };
};
export type Conversion = {
  id: string; title: string; status: "PENDING" | "RUNNING" | "REVIEW" | "DONE" | "FAILED";
  stage: "source" | "transcribe" | "review" | "document" | "finish";
  version: number; artifact_version: number; options: ConversionOptions; error: string;
  created_at: string; updated_at: string; question_count: number; review_count: number;
  source_files: { name: string; size: number }[];
  source_archive?: ConversionAsset;
  document?: { questions: ConversionQuestion[]; pages: (ConversionAsset | null)[]; warnings: string[] };
  artifacts?: Partial<Record<"manuscript" | "arranged" | "a3", ConversionAsset>>;
};
const base = "/tools/problem-studio/conversions/";
export const conversionActive = (row: Conversion) => row.status === "PENDING" || row.status === "RUNNING";
export async function listConversions(offset = 0) {
  return (await api.get<{ conversions: Conversion[]; next_offset?: number | null }>(base, { params: { offset } })).data;
}
export async function getConversion(id: string) {
  return (await api.get<Conversion>(`${base}${encodeURIComponent(id)}/`)).data;
}
export async function createConversion(title: string, options: ConversionOptions, files: File[]) {
  const form = new FormData();
  form.append("payload", JSON.stringify({ title, options }));
  files.forEach(file => form.append("source_files", file));
  return (await api.post<Conversion>(base, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 })).data;
}
export async function saveConversion(id: string, version: number, body: { action?: string; question_id?: string; question?: QuestionContent }) {
  return (await api.patch<Conversion>(`${base}${encodeURIComponent(id)}/`, { version, ...body })).data;
}
export async function actOnConversion(id: string, version: number, body: { action: string; question_id?: string; instruction?: string }) {
  return (await api.post<Conversion>(`${base}${encodeURIComponent(id)}/actions/`, { version, ...body })).data;
}
