import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

type AssessmentListItem = {
  id: number;
  title: string;
  created_at?: string;
  exam_type?: string;
  max_score?: number;
  subject?: string;
  due_date?: string;
};

/** Read the complete filtered list before displaying it or offering an assessment. */
export async function fetchAssessmentPages(path: "/exams/" | "/homeworks/", params: Record<string, unknown> = {}) {
  const session = readAuthTokenEnvelopeSafely();
  const tenant = getTenantCodeForApiRequest();
  if (!session || !tenant) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 조회해 주세요.");
  const config = createAuthSessionBoundConfig(session.generation, undefined, tenant);
  const rows: AssessmentListItem[] = [];
  const ids = new Set<number>();
  let expectedCount: number | undefined;
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<AssessmentListItem[] | { results: AssessmentListItem[]; count?: number; next?: string | null }>(path, {
      ...config,
      params: { ...params, page, page_size: 500, ordering: "-created_at,-id" },
    });
    const items = Array.isArray(data) ? data : data?.results;
    const count = Array.isArray(data) ? undefined : data?.count;
    const next = Array.isArray(data) ? null : data?.next;
    if (!Array.isArray(items) || (page > 1 && Array.isArray(data))
      || (count !== undefined && (!Number.isSafeInteger(count) || count < 0))
      || (next != null && (typeof next !== "string" || !next))) {
      throw new Error("평가 목록 응답을 확인하지 못했습니다. 다시 조회해 주세요.");
    }
    if (page === 1) expectedCount = count;
    else if (count !== expectedCount) throw new Error("조회 중 평가 목록이 변경되었습니다. 다시 조회해 주세요.");
    for (const item of items) {
      if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id)) {
        throw new Error("평가 목록에 누락되거나 중복된 항목이 있습니다. 다시 조회해 주세요.");
      }
      ids.add(item.id);
      rows.push(item);
    }
    if (!next) {
      if (expectedCount !== undefined && rows.length !== expectedCount) {
        throw new Error("평가 목록 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
      }
      return rows;
    }
    if (!items.length || expectedCount === undefined || rows.length >= expectedCount) {
      throw new Error("평가 목록 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
    }
  }
}
