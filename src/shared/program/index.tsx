// PATH: src/shared/program/index.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import api, { type ApiRequestConfig } from "@/shared/api/axios";

export type Program = {
  tenantCode: string;
  display_name: string;

  ui_config: {
    logo_url?: string;
    primary_color?: string;
    login_title?: string;
    login_subtitle?: string;
    window_title?: string;
  };

  feature_flags: Record<string, boolean>;
  is_active: boolean;
};

/** 로컬 개발 시 백엔드 미기동으로 /core/program/ 실패해도 /login 접근 가능하도록 fallback */
const DEV_FALLBACK_PROGRAM: Program = {
  tenantCode: "9999",
  display_name: "학원플러스 (로컬)",
  ui_config: { login_title: "학원플러스", login_subtitle: "로컬 개발" },
  feature_flags: {},
  is_active: true,
};

type ProgramState = {
  program: Program | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const ProgramContext = createContext<ProgramState | null>(null);

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const [program, setProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get<Program>("/core/program/", { skipAuth: true } as ApiRequestConfig);
      setProgram(res.data ?? null);
    } catch (e: unknown) {
      if (import.meta.env.DEV) {
        const err = e as { code?: string; message?: string };
        if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
          console.warn(
            "[로컬 개발] 백엔드에 연결할 수 없습니다. Django 서버를 실행해 주세요.\n" +
              "  예: academy 폴더에서 'Academy Local Dev.bat' 실행 또는\n" +
              "  python manage.py runserver 0.0.0.0:8000"
          );
          setProgram(DEV_FALLBACK_PROGRAM);
          return;
        }
      }
      setProgram(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <ProgramContext.Provider value={{ program, isLoading, refetch: load }}>
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
