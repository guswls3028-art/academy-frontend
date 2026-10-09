import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

type StaffPage<T> = {
  results: T[];
  count?: number;
  next?: string | null;
};

/** Read one complete staff list; a partial financial list is not a success. */
export async function fetchStaffPages<
  T extends { id: number },
  Metadata extends object = Record<string, unknown>,
>(path: string, params: Record<string, unknown> = {}) {
  const session = readAuthTokenEnvelopeSafely();
  const tenant = getTenantCodeForApiRequest();
  if (!session || !tenant) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 조회해 주세요.");
  const config = createAuthSessionBoundConfig(session.generation, undefined, tenant);
  const rows: T[] = [];
  const ids = new Set<number>();
  let metadata: Metadata | undefined;
  let expectedCount: number | undefined;

  for (let page = 1; ; page += 1) {
    // Rebuild our own URL/filters. Never follow an API-provided absolute next URL.
    const { data } = await api.get<T[] | (StaffPage<T> & Metadata)>(path, {
      ...config,
      params: { ...params, page, page_size: 500 },
    });
    const items = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(items) || (page > 1 && Array.isArray(data))) {
      throw new Error("목록 응답을 확인하지 못했습니다. 다시 조회해 주세요.");
    }
    const next = Array.isArray(data) ? null : data.next;
    const count = Array.isArray(data) ? undefined : data.count;
    if (next != null && (typeof next !== "string" || !next)) {
      throw new Error("다음 페이지 정보를 확인하지 못했습니다. 다시 조회해 주세요.");
    }
    if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) {
      throw new Error("목록 전체 건수를 확인하지 못했습니다. 다시 조회해 주세요.");
    }
    if (page === 1) {
      expectedCount = count;
      if (!Array.isArray(data)) metadata = data;
    } else if (count !== expectedCount) {
      throw new Error("조회 중 목록이 변경되었습니다. 다시 조회해 주세요.");
    }
    for (const item of items) {
      if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id)) {
        throw new Error("목록에 누락되거나 중복된 항목이 있습니다. 다시 조회해 주세요.");
      }
      ids.add(item.id);
      rows.push(item);
    }
    if (!next) {
      if (expectedCount !== undefined && rows.length !== expectedCount) {
        throw new Error("목록 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
      }
      return { rows, metadata };
    }
    if (!items.length || expectedCount === undefined || rows.length >= expectedCount) {
      throw new Error("목록 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
    }
  }
}
