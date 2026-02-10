// PATH: src/shared/appConfig/types.ts

/**
 * ❌ DEPRECATED TYPE
 *
 * 본 타입은 과거 AppConfig 실험 단계에서 사용되었으며,
 * 현재 Backend SSOT (Program)와 개념적으로 중복된다.
 *
 * - 실제 UI/Feature/Brand 설정은 Program SSOT에서만 제공된다.
 * - 신규 코드에서 이 타입 사용 금지
 *
 * ⚠️ 삭제 대신 봉인 유지 (과거 import 안정성 목적)
 */
export type AppConfig = {
  programName: string;
  logoUrl?: string;
  primaryColor?: string;

  login: {
    title: string;
    subtitle?: string;
  };

  features?: {
    [key: string]: boolean;
  };
};
