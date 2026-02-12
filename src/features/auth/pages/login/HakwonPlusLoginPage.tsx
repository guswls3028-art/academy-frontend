// PATH: src/features/auth/pages/login/HakwonPlusLoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/ui/ds";

export default function HakwonPlusLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    setPending(true);
    setError("");

    try {
      await login(username, password);
      await refreshMe();
      navigate("/", { replace: true });
    } catch {
      setError("아이디 또는 비밀번호를 확인해주세요.");
      setPending(false);
    }
  }

  return (
    <div
      data-app="auth"
      className="auth-shell flex min-h-screen items-center justify-center bg-[#0b0d12]"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h1 className="mb-4 text-xl font-bold">
          HakwonPlus 관리자 로그인
        </h1>

        <input
          className="mb-2 w-full rounded border px-3 py-2"
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="mb-3 w-full rounded border px-3 py-2"
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          type="submit"
          intent="primary"
          size="lg"
          disabled={pending}
          className="w-full"
        >
          {pending ? "로그인 중..." : "로그인"}
        </Button>

        {error && (
          <div className="mt-3 text-sm font-semibold" style={{ color: "var(--color-error)" }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
