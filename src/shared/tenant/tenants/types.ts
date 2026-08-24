// PATH: src/shared/tenant/tenants/types.ts
/** 테넌트 ID (1=학원플러스, 2=tchul, 3=limglish, 4=ymath, 8=sswe, 9=dnb, 10=movementhui, 11=godmin, 9999=로컬개발) */
export type TenantId = 1 | 2 | 3 | 4 | 8 | 9 | 10 | 11 | 9999;

export type TenantBranding = {
  loginTitle: string;
  loginSubtitle?: string;
  /** 로그인 페이지 로고 URL (없으면 CommonLogoIcon SVG 사용) */
  logoUrl?: string;
  /** 브라우저 탭 제목 (없으면 loginTitle 사용) */
  windowTitle?: string;
  /** favicon URL (없으면 /vite.svg 기본) */
  faviconUrl?: string;
  /** 헤더(관리자/학생 상단바) 로고 URL — 아이콘 전용, 텍스트 제외 (없으면 SVG 컴포넌트 사용) */
  headerLogoUrl?: string;
  /** 다크모드용 로그인 로고 URL (색반전, 투명 배경) */
  logoDarkUrl?: string;
  /** 다크모드용 헤더 아이콘 URL (색반전, 투명 배경) */
  headerLogoDarkUrl?: string;
  /**
   * 불투명 배경이 포함된 헤더 로고를 공용 상단바에 자연스럽게 잇는 브랜드 표면.
   * surface는 이미지 모서리 배경색과 맞추고, surfaceSoft는 헤더로 사라지는 중간색으로 쓴다.
   */
  headerPalette?: {
    surface: string;
    surfaceSoft: string;
    foreground: string;
    accent: string;
  };
  /** OG/트위터 카드 설명 (없으면 기본 문구) */
  ogDescription?: string;
  /** OG/트위터 카드 이미지 URL — 카카오톡·페이스북 링크 미리보기용 (상대경로, origin은 런타임 부착) */
  ogImageUrl?: string;
};

/** 단일 테넌트 정의 — tenants/*.ts 에서 사용 */
export type TenantDef = {
  id: TenantId;
  code: string;
  name: string;
  hostnames: string[];
  loginPath: string;
  branding: TenantBranding;
  /** 전용 로그인 페이지 사용 여부 (예: tchul 2컬럼 브랜드 페이지) */
  dedicatedLoginPage: boolean;
  /** false면 학생 셀프 회원가입 진입을 숨긴다. 서버 정책이 최종 차단한다. */
  studentSelfRegistrationEnabled?: boolean;
  /** 커스텀 로고 보유 여부 — true: 전용 로고 에셋 사용, false: CommonLogoIcon SVG 사용 */
  hasCustomLogo: boolean;
};
