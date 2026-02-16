// PATH: src/features/auth/pages/login/TenantLoginPage.tsx
// 테넌트별 로그인 — program.ui_config 우선, 없으면 정적 브랜딩(로고/타이틀)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/ui/ds";
import { useProgram } from "@/shared/program";
import { type TenantId, getTenantBranding } from "@/shared/tenant";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

type Props = { tenantId: TenantId };

export default function TenantLoginPage({ tenantId }: Props) {
  const { program } = useProgram();
  const staticBranding = getTenantBranding(tenantId);
  const logoUrl = program?.ui_config?.logo_url ?? staticBranding.logoUrl;
  const loginTitle = program?.ui_config?.login_title ?? staticBranding.loginTitle;
  const loginSubtitle = program?.ui_config?.login_subtitle ?? staticBranding.loginSubtitle;
  
  // 브라우저 타이틀 설정
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
        {logoUrl && (
          <img src={logoUrl} alt="logo" className="auth-card__logo" />
        )}
        <h1 className="auth-card__title">{loginTitle}</h1>
        {loginSubtitle && <p className="auth-card__subtitle">{loginSubtitle}</p>}
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
