// PATH: src/features/auth/pages/login/CustomLoginPage.tsx
// program.ui_config 기반 커스텀 로그인 — 프리미엄 SaaS auth-card 공통 스타일
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
    <div data-app="auth" className="auth-shell">
      <form onSubmit={onSubmit} className="auth-card">
        {program?.ui_config?.logo_url && (
          <img
            src={program.ui_config.logo_url}
            alt=""
            className="auth-card__logo"
          />
        )}
        <h1 className="auth-card__title">
          {program?.ui_config?.login_title ?? "로그인"}
        </h1>
        {program?.ui_config?.login_subtitle && (
          <p className="auth-card__subtitle">
            {program.ui_config.login_subtitle}
          </p>
        )}
        <input
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <Button type="submit" intent="primary" size="lg" disabled={pending} className="w-full">
          {pending ? "로그인 중..." : "로그인"}
        </Button>
        {error && <div className="auth-card__error">{error}</div>}
      </form>
    </div>
  );
}
