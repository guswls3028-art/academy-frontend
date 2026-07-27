// Toss Payments SDK v2 helper for automatic-billing card authentication.

type TossPaymentInstance = {
  requestBillingAuth: (params: {
    method: "CARD";
    successUrl: string;
    failUrl: string;
  }) => Promise<void>;
};

type TossPaymentsInstance = {
  payment: (params: { customerKey: string }) => TossPaymentInstance;
};

type TossPaymentsConstructor = (clientKey: string) => TossPaymentsInstance;

declare global {
  interface Window {
    TossPayments?: TossPaymentsConstructor;
  }
}

const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

let loadPromise: Promise<void> | null = null;

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
  const payment = tossPayments.payment({ customerKey: params.customerKey });
  await payment.requestBillingAuth({
    method: "CARD",
    successUrl: params.successUrl,
    failUrl: params.failUrl,
  });
}
