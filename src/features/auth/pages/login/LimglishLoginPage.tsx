// PATH: src/features/auth/pages/login/CustomLoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/ui/ds";
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "아이디 또는 비밀번호를 확인해주세요.");
      setPending(false);
    }
  }

  return (
    <div
      className="auth-shell flex min-h-screen items-center justify-center bg-[#0b0d12]"
      style={{ color: "#000" }}
    >
      <form
        onSubmit={onSubmit}
        style={{ color: "#000" }}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        {program?.ui_config?.logo_url && (
          <img
            src={program.ui_config.logo_url}
            alt="logo"
            className="mb-4 h-10"
          />
        )}

        <h1 style={{ color: "#000" }} className="mb-1 text-xl font-bold">
          {program?.ui_config?.login_title ?? "로그인"}
        </h1>

        {program?.ui_config?.login_subtitle && (
          <p style={{ color: "#444" }} className="mb-4 text-sm">
            {program.ui_config.login_subtitle}
          </p>
        )}

        <input
          style={{ color: "#000" }}
          className="mb-2 w-full rounded border px-3 py-2"
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          style={{ color: "#000" }}
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
          <div style={{ color: "red" }} className="mt-3 text-sm font-semibold">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
