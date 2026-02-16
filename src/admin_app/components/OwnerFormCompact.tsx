// PATH: src/admin_app/components/OwnerFormCompact.tsx
// 밀도 높은 한 줄 라벨 + Enter 다음 필드 이동 + 버튼 아래 고정 결과

import { useRef, useCallback, useState } from "react";
import { registerTenantOwner } from "@/admin_app/api/tenants";
import "@/styles/design-system/index.css";
import "@/styles/design-system/ds/input.css";

type Props = {
  tenantId: number;
  tenantName: string;
  onSuccess?: () => void;
  /** 생성 후 결과를 버튼 아래 고정 표시 (토스트 대신) */
  showResultBelow?: boolean;
};

const LABELS = [
  { key: "username" as const, label: "ID", type: "text", placeholder: "admin97" },
  { key: "password" as const, label: "PW", type: "password", placeholder: "비밀번호" },
  { key: "name" as const, label: "이름", type: "text", placeholder: "홍길동" },
  { key: "phone" as const, label: "전화", type: "text", placeholder: "01012345678" },
];

export default function OwnerFormCompact({
  tenantId,
  tenantName,
  onSuccess,
  showResultBelow = true,
}: Props) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ username: string } | null>(null);

  const values = [username, password, name, phone];
  const setters = [setUsername, setPassword, setName, setPhone];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (index < refs.length - 1) {
        refs[index + 1].current?.focus();
      } else {
        (e.target as HTMLFormElement).form?.requestSubmit();
      }
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError("ID를 입력하세요."); return; }
    if (!password) { setError("PW를 입력하세요."); return; }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      await registerTenantOwner(tenantId, {
        username: username.trim(),
        password,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      const created = username.trim();
      setUsername("");
      setPassword("");
      setName("");
      setPhone("");
      setResult({ username: created });
      onSuccess?.();
      refs[0].current?.focus();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {LABELS.map(({ key, label, type, placeholder }, i) => (
        <div key={key} className="flex items-center gap-3">
          <label className="w-10 shrink-0 text-sm font-medium text-slate-600">{label}</label>
          <input
            ref={refs[i]}
            type={type}
            value={values[i]}
            onChange={(e) => setters[i](e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            placeholder={placeholder}
            className="ds-input flex-1 py-2.5 rounded-lg min-h-[44px] text-base"
            autoComplete={key === "password" ? "new-password" : "off"}
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={loading}
        className="w-full ds-button min-h-[48px] rounded-xl mt-1"
        data-intent="primary"
        data-size="md"
      >
        {loading ? "생성 중…" : "원장 계정 생성"}
      </button>
      {showResultBelow && result && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          ✓ 생성 완료 — <strong>{result.username}</strong> (OWNER)
        </div>
      )}
      {error && (
        <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}
    </form>
  );
}

// React useState
import * as React from "react";
