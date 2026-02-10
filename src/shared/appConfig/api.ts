// PATH: src/shared/appConfig/api.ts
import api from "@/shared/api/axios";
import type { AppConfig } from "./types";

/**
 * ❌ DEPRECATED / LOCKED
 *
 * Backend SSOT 기준:
 * - AppConfig 단독 엔드포인트는 존재하지 않는다.
 * - Program SSOT는 /core/program/ 단일 진실이다.
 *
 * 이 함수는 과거 실험 흔적으로 유지되며,
 * 호출될 경우 즉시 실패하도록 봉인한다.
 *
 * ⚠️ 절대 복구/확장 금지
 */
export async function fetchAppConfig(): Promise<AppConfig> {
  throw new Error(
    "[SSOT VIOLATION] fetchAppConfig() is deprecated. Use /core/program/ only."
  );
}
