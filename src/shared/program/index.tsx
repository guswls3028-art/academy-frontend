// PATH: src/shared/program/index.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/shared/api/axios";

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
      const res = await api.get<Program>("/core/program/");
      setProgram(res.data ?? null);
    } catch {
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
