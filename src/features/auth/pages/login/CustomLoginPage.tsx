// PATH: src/features/auth/pages/login/CustomLoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";

export default function CustomLoginPage() {
  const { program } = useProgram();
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
          "아이디 또는 비밀번호를 확인해주세요."
      );
      setPending(false);
    }
  }

  return (
    <div className="auth-shell flex min-h-screen items-center justify-center bg-[#0b0d12]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        {program?.ui_config?.logo_url && (
          <img
            src={program.ui_config.logo_url}
            alt="logo"
            className="mb-4 h-10"
          />
        )}

        <h1 className="mb-1 text-xl font-bold">
          {program?.ui_config?.login_title ?? "로그인"}
        </h1>

        {program?.ui_config?.login_subtitle && (
          <p className="mb-4 text-sm text-gray-600">
            {program.ui_config.login_subtitle}
          </p>
        )}

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
