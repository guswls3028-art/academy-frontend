// PATH: src/features/auth/pages/LoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  // ✅ 추가: 도메인 분기 (최소)
  const host = window.location.hostname;
  const isLimglish =
    host === "limglish.kr" || host === "www.limglish.kr";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    setError("");
    setPending(true);

    try {
      await login(username, password);
      await refreshMe();
      navigate("/", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Login failed");
      setPending(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-app)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: 380,
          padding: 32,
          borderRadius: 16,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-divider)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          textAlign: "center",
          animation: "fadeUp 0.4s ease",
        }}
      >
        {/* 상단 브랜딩 */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 30,
              margin: 0,
              fontWeight: 900,
              letterSpacing: -0.5,
              color: "var(--color-primary)",
            }}
          >
            {isLimglish ? (
              <>
                LIMGLISH<br />
                선생님 전용 페이지
              </>
            ) : (
              <>
                임시 페이지<br />
                관리자화면 확인용
              </>
            )}
          </h1>

          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--bg-surface-soft)",
              color: "var(--text-primary)",
              fontWeight: 600,
              lineHeight: 1.7,
              border: "1px solid var(--border-divider)",
            }}
          >
            <div>ID : 1111</div>
            <div>PS : 1111</div>
          </div>
        </div>

        {/* 로그인 폼 */}
        <form
          onSubmit={onSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginTop: 10,
          }}
        >
          <input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border-divider)",
              fontSize: 14,
              background: "var(--bg-app)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />

          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border-divider)",
              fontSize: 14,
              background: "var(--bg-app)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />

          <button
            type="submit"
            disabled={pending}
            style={{
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              background: "var(--color-primary)",
              color: "var(--text-on-primary)",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              opacity: pending ? 0.7 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {pending ? "Logging in..." : "Login"}
          </button>
        </form>

        {error && (
          <p
            style={{
              color: "var(--color-danger)",
              marginTop: 14,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
