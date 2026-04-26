// PATH: src/app_admin/domains/community/hooks/useDebouncedValue.ts
// 입력 디바운스 — 검색 input과 서버 query 사이의 throttle.

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
