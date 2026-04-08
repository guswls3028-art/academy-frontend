// PATH: src/features/settings/api/toss.helper.ts
// Toss Payments SDK v2 헬퍼 — 스크립트 로딩 및 빌링키 인증 요청

/** Toss SDK 타입 (v2 billing auth에 필요한 최소 인터페이스) */
type TossPaymentsInstance = {
  requestBillingAuth: (
    method: string,
    params: {
      customerKey: string;
      successUrl: string;
      failUrl: string;
    },
  ) => Promise<void>;
};

type TossPaymentsConstructor = (clientKey: string) => TossPaymentsInstance;

declare global {
  interface Window {
    TossPayments?: TossPaymentsConstructor;
  }
}

const TOSS_SDK_URL = "https://js.tosspayments.com/v1/payment";

let loadPromise: Promise<void> | null = null;

/** Toss Payments SDK 스크립트를 동적으로 로드 */
export function loadTossPaymentsSDK(): Promise<void> {
  if (window.TossPayments) return Promise.resolve();

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TOSS_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Toss Payments SDK 로드에 실패했습니다."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Toss SDK 인스턴스 생성 후 빌링키 인증 요청 */
export async function requestBillingAuth(params: {
  clientKey: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
}): Promise<void> {
  await loadTossPaymentsSDK();

  if (!window.TossPayments) {
    throw new Error("Toss Payments SDK가 로드되지 않았습니다.");
  }

  const tossPayments = window.TossPayments(params.clientKey);
  await tossPayments.requestBillingAuth("카드", {
    customerKey: params.customerKey,
    successUrl: params.successUrl,
    failUrl: params.failUrl,
  });
}
