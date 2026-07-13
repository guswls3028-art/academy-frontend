/* eslint-disable react-refresh/only-export-components */
// PATH: src/shared/program/index.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import { getTenantBranding, getTenantIdFromCode, resolveTenantCode } from "@/shared/tenant";

export type Program = {
  tenantCode: string;
  isPlatformAdmin?: boolean;
  display_name: string;

  ui_config: {
    logo_url?: string;
    primary_color?: string;
    login_title?: string;
    login_subtitle?: string;
    window_title?: string;
  };

  feature_flags: Record<string, boolean | string | number>;
  is_active: boolean;
};

/** 로컬 개발 시 백엔드 미기동으로 /core/program/ 실패해도 /login 접근 가능하도록 fallback */
const DEV_FALLBACK_PROGRAM: Program = {
  tenantCode: "9999",
  isPlatformAdmin: true,
  display_name: "학원플러스 (로컬)",
  ui_config: { login_title: "학원플러스", login_subtitle: "로컬 개발" },
  feature_flags: {},
  is_active: true,
};

function getDevFallbackProgram(): Program {
  const resolved = resolveTenantCode();
  const tenantCode = resolved.ok ? resolved.code : DEV_FALLBACK_PROGRAM.tenantCode;
  const tenantId = getTenantIdFromCode(tenantCode);
  const branding = tenantId ? getTenantBranding(tenantId) : null;

  return {
    ...DEV_FALLBACK_PROGRAM,
    tenantCode,
    isPlatformAdmin: tenantCode === "9999",
    display_name: branding?.loginTitle || DEV_FALLBACK_PROGRAM.display_name,
    ui_config: branding
      ? {
          login_title: branding.loginTitle,
          login_subtitle: branding.loginSubtitle,
          logo_url: branding.logoUrl,
          window_title: branding.windowTitle,
        }
      : DEV_FALLBACK_PROGRAM.ui_config,
  };
}

type ProgramState = {
  program: Program | null;
  isLoading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
};

const ProgramContext = createContext<ProgramState | null>(null);

let programBootstrapPromise: Promise<Program | null> | null = null;

function isRetryableProgramError(e: unknown): boolean {
  const err = e as { response?: { status?: number }; code?: string; message?: string };
  const status = err?.response?.status;
  if (typeof status === "number") {
    return status >= 500;
  }
  return err?.code === "ERR_NETWORK" || Boolean(err?.message?.includes("Network Error"));
}

function fetchProgramBootstrap(): Promise<Program | null> {
  if (programBootstrapPromise) return programBootstrapPromise;

  programBootstrapPromise = (async () => {
    const attemptFetch = async (attempt = 0): Promise<Program | null> => {
      try {
        const res = await api.get<Program>("/core/program/", { skipAuth: true } as ApiRequestConfig);
        return res.data ?? null;
      } catch (e: unknown) {
        if (import.meta.env.DEV) {
          const err = e as {
            code?: string;
            message?: string;
            response?: { status?: number; data?: unknown };
          };
          const status = err?.response?.status;
          const responseData = err?.response?.data;
          const localBackendUnavailable =
            err?.code === "ERR_NETWORK" ||
            err?.message?.includes("Network Error") ||
            // Vite's refused proxy connection is surfaced to Axios as an empty 500.
            (status === 500 && (responseData === "" || responseData == null));
          if (localBackendUnavailable) {
            console.warn(
              "[로컬 개발] 백엔드에 연결할 수 없습니다. Django 서버를 실행해 주세요.\n" +
                "  예: academy 폴더에서 'Academy Local Dev.bat' 실행 또는\n" +
                "  python manage.py runserver 0.0.0.0:8000"
            );
            return getDevFallbackProgram();
          }
        }
        if (attempt < 2 && isRetryableProgramError(e)) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          return attemptFetch(attempt + 1);
        }
        throw e;
      }
    };

    return attemptFetch();
  })().finally(() => {
    programBootstrapPromise = null;
  });

  return programBootstrapPromise;
}

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const [program, setProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const p = await fetchProgramBootstrap();
      setProgram(p);
    } catch {
      setProgram(null);
      setError(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [load]);

  const value = useMemo<ProgramState>(
    () => ({ program, isLoading, error, refetch: load }),
    [program, isLoading, error, load],
  );

  return (
    <ProgramContext.Provider value={value}>
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  const ctx = useContext(ProgramContext);
  if (!ctx) {
    throw new Error("useProgram must be used within ProgramProvider");
  }
  return ctx;
}
