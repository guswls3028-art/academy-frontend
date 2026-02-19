// PATH: src/features/auth/pages/login/TchulLoginPage.tsx
// tchul.com 테넌트 전용 브랜드 로그인 랜딩 페이지 — 2컬럼 레이아웃
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/ui/ds";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import TchulLogo from "../logos/TchulLogo.png";
import styles from "./TchulLoginPage.module.css";

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
    <div data-app="auth" className={styles.root}>
      <section className={styles.brand} aria-label="박철과학 브랜드">
        <img src={TchulLogo} alt="박철과학" className={styles.brandLogo} />
        <p className={styles.brandPhrase}>과학은 철두철미하게</p>
        <h1 className={styles.brandTitle}>박철과학</h1>
        <p className={styles.brandSubtitle}>관리자 로그인</p>
      </section>
      <div className={styles.formPanel}>
        <form onSubmit={onSubmit} className={styles.formCard}>
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
          {error && <div className={styles.formCard__error}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
