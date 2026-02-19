// PATH: src/features/auth/pages/login/TchulLoginPage.tsx
// 학2번 테넌트(tchul.com) 전용 로그인 — 박철과학 로고 사용
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/ui/ds";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import TchulLogo from "../logos/TchulLogo.png";

export default function TchulLoginPage() {
  useDocumentTitle();

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
    <div data-app="auth" className="auth-shell">
      <form onSubmit={onSubmit} className="auth-card">
        <img src={TchulLogo} alt="박철과학" className="auth-card__logo" />
        <h1 className="auth-card__title">박철과학</h1>
        <p className="auth-card__subtitle">관리자 로그인</p>
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
