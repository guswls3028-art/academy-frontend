// PATH: src/features/auth/pages/login/TchulLoginPage.tsx
// tchul.com 테넌트 전용 브랜드 로그인 — 단일 카드 (로고 SVG+텍스트 구현, 배경 없음)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/ui/ds";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import TchulLogoInline from "../logos/TchulLogoInline";
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
      <form onSubmit={onSubmit} className={styles.card} aria-label="박철과학 관리자 로그인">
        <TchulLogoInline />
        <p className={styles.subtitle}>관리자 로그인</p>
        <div className={styles.form}>
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
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </form>
    </div>
  );
}
