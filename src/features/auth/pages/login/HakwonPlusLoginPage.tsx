// PATH: src/features/auth/pages/login/HakwonPlusLoginPage.tsx
// 테넌트 1 (hakwonplus.com) 전용 — 로고 중심, 카드 없음, 전역 DS 독립
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useProgram } from "@/shared/program";
import "@/features/auth/themes/hakwonplus.css";
import styles from "./HakwonPlusLoginPage.module.css";

export default function HakwonPlusLoginPage() {
  useDocumentTitle();
  const { program } = useProgram();

  const [formExpanded, setFormExpanded] = useState(false);
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

  const loginTitle = program?.ui_config?.login_title || "HakwonPlus 로그인";

  return (
    <div data-app="auth" data-tenant="hakwonplus" className={styles.root}>
      <div className={styles.center}>
        {program?.ui_config?.logo_url ? (
          <img src={program.ui_config.logo_url} alt={loginTitle} className={styles.logo} />
        ) : (
          <div className={styles.logoFallback}>{loginTitle}</div>
        )}
        {!formExpanded ? (
          <>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setFormExpanded(true)}
            >
              로그인
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} className={styles.form} aria-label="로그인 폼">
            <input
              className={styles.input}
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              className={styles.input}
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={pending}
            >
              {pending ? "로그인 중..." : "로그인"}
            </button>
            {error && <div className={styles.error}>{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
