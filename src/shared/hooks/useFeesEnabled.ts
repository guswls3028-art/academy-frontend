// PATH: src/shared/hooks/useFeesEnabled.ts
import { useProgram } from "@/shared/program";

/**
 * 수납 관리 기능 활성화 여부.
 * Program.feature_flags.fee_management가 truthy이면 활성.
 */
export function useFeesEnabled(): boolean {
  const { program } = useProgram();
  return Boolean(program?.feature_flags?.fee_management);
}
