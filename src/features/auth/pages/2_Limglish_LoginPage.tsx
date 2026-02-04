// PATH: src/features/auth/pages/2_Limglish_LoginPage.tsx
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
    <div style={styles.page}>
      <div style={styles.card}>
        {/* ===== Branding ===== */}
        <div style={styles.header}>
          <div style={styles.logo}>LIMGLISH</div>
          <div style={styles.subtitle}>임시 로그인 화면</div>
        </div>

        {/* ===== Temporary Hint ===== */}
        <div style={styles.hint}>
          <div>
            학생계정은 학생탭에서 학생추가하기
          </div>
          <div>
            
          </div>
        </div>

        {/* ===== Login Form ===== */}
        <form onSubmit={onSubmit} style={styles.form}>
          <input
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          <button
            type="submit"
            disabled={pending}
            style={{
              ...styles.button,
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "#0f1115",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "#ffffff",
    borderRadius: 18,
    padding: 28,
    boxShadow: "0 20px 48px rgba(0,0,0,0.35)",
  },
  header: {
    textAlign: "center",
    marginBottom: 22,
  },
  logo: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 700,
    color: "#555",
  },
  hint: {
    background: "#f6f7f9",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 18,
    lineHeight: 1.6,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    fontSize: 14,
    outline: "none",
  },
  button: {
    marginTop: 6,
    padding: "12px",
    borderRadius: 12,
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    marginTop: 14,
    color: "#c00000",
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center",
  },
};
