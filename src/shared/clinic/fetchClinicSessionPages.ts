import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

/** A calendar/report is complete only after every filtered session page succeeds. */
export async function fetchClinicSessionPages<T extends { id: number }>(params: {
  date_from?: string;
  date_to?: string;
  ordering?: string;
}): Promise<T[]> {
  const session = readAuthTokenEnvelopeSafely();
  const tenant = getTenantCodeForApiRequest();
  if (!session || !tenant) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 조회해 주세요.");
  const config = createAuthSessionBoundConfig(session.generation, undefined, tenant);
  const ordering = params.ordering || "-date,-start_time,-id";
  const stableOrdering = ordering.split(",").some((field) => field.trim().replace(/^-/, "") === "id")
    ? ordering : `${ordering},id`;
  const rows: T[] = [];
  const ids = new Set<number>();
  let expectedCount: number | undefined;
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<T[] | { results: T[]; count?: number; next?: string | null }>("/clinic/sessions/", {
      ...config, params: { ...params, ordering: stableOrdering, page_size: 500, page },
    });
    const items = Array.isArray(data) ? data : data?.results;
    const count = Array.isArray(data) ? undefined : data?.count;
    const next = Array.isArray(data) ? null : data?.next;
    if (!Array.isArray(items) || (page > 1 && Array.isArray(data))
      || (count !== undefined && (!Number.isSafeInteger(count) || count < 0))
      || (next != null && (typeof next !== "string" || !next.trim()))) {
      throw new Error("클리닉 일정 응답을 확인하지 못했습니다. 다시 조회해 주세요.");
    }
    if (page === 1) expectedCount = count;
    else if (count !== expectedCount) throw new Error("조회 중 클리닉 일정이 변경되었습니다. 다시 조회해 주세요.");
    for (const item of items) {
      if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id)) {
        throw new Error("클리닉 일정에 누락되거나 중복된 항목이 있습니다. 다시 조회해 주세요.");
      }
      ids.add(item.id);
      rows.push(item);
    }
    if (!next) {
      if (expectedCount !== undefined && rows.length !== expectedCount) {
        throw new Error("클리닉 일정 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
      }
      return rows;
    }
    if (!items.length || expectedCount === undefined || rows.length >= expectedCount) {
      throw new Error("클리닉 일정 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
    }
  }
}
