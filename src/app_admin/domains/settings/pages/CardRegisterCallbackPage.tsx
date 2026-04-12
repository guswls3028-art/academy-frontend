// PATH: src/app_admin/domains/settings/pages/CardRegisterCallbackPage.tsx
// Toss Payments 카드 등록 콜백 페이지 — 리다이렉트 후 authKey 처리

import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { processCardCallback } from "../api/billing.api";
import styles from "./CardRegisterCallbackPage.module.css";

type CallbackResult = {
  status: "loading" | "success" | "error";
  message: string;
};

export default function CardRegisterCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const calledRef = useRef(false);

  const authKey = searchParams.get("authKey");
  const customerKey = searchParams.get("customerKey");

  const callbackMut = useMutation({
    mutationFn: processCardCallback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-cards"] });
    },
  });

  useEffect(() => {
    // Strict mode 중복 호출 방지
    if (calledRef.current) return;
    calledRef.current = true;

    if (!authKey || !customerKey) {
      return;
    }

    callbackMut.mutate({ authKey, customerKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authKey, customerKey]);

  const getResult = (): CallbackResult => {
    if (!authKey || !customerKey) {
      return {
        status: "error",
        message: "잘못된 접근입니다. 필수 파라미터가 누락되었습니다.",
      };
    }

    if (callbackMut.isPending) {
      return { status: "loading", message: "카드를 등록하고 있습니다..." };
    }

    if (callbackMut.isError) {
      return {
        status: "error",
        message: "카드 등록에 실패했습니다. 다시 시도해 주세요.",
      };
    }

    if (callbackMut.isSuccess) {
      return { status: "success", message: "카드가 성공적으로 등록되었습니다." };
    }

    return { status: "loading", message: "처리 중..." };
  };

  const result = getResult();

  const handleGoBack = () => {
    navigate("/admin/settings/billing", { replace: true });
  };

  // 성공 시 3초 후 자동 이동
  useEffect(() => {
    if (result.status !== "success") return;
    const timer = setTimeout(() => {
      navigate("/admin/settings/billing", { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [result.status, navigate]);

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        {result.status === "loading" && (
          <>
            <div className={styles.spinner} />
            <p className={styles.message}>{result.message}</p>
          </>
        )}

        {result.status === "success" && (
          <>
            <div className={styles.iconSuccess}>
              <CheckIcon />
            </div>
            <p className={styles.messageSuccess}>{result.message}</p>
            <p className={styles.subMessage}>
              잠시 후 결제 설정 페이지로 이동합니다.
            </p>
            <button
              type="button"
              className={styles.backBtn}
              onClick={handleGoBack}
            >
              결제 설정으로 돌아가기
            </button>
          </>
        )}

        {result.status === "error" && (
          <>
            <div className={styles.iconError}>
              <XIcon />
            </div>
            <p className={styles.messageError}>{result.message}</p>
            <button
              type="button"
              className={styles.backBtn}
              onClick={handleGoBack}
            >
              결제 설정으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Inline SVG icons ──

function CheckIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
