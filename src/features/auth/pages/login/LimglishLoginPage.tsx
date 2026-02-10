// PATH: src/features/auth/pages/login/LimglishLoginPage.tsx
// --------------------------------------------------
// Limglish Teacher Login
// - Auth 전용 화면
// - Student / Admin 테마와 분리된 독립 UI
// --------------------------------------------------

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";

export default function LimglishLoginPage() {
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
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          "아이디 또는 비밀번호가 올바르지 않습니다."
      );
      setPending(false);
    }
  }

  return (
    <div className="auth-shell flex min-h-screen items-center justify-center bg-[#0f1115]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h1 className="mb-1 text-2xl font-black">LIMGLISH</h1>
        <p className="mb-4 text-sm font-semibold text-gray-600">
          선생님 전용 로그인
        </p>

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

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-black py-2 text-white font-semibold"
        >
          {pending ? "로그인 중..." : "로그인"}
        </button>

        {error && (
          <div className="mt-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
