// PATH: src/features/auth/pages/LoginPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLimglish = host === "limglish.kr" || host === "www.limglish.kr";

  const brand = useMemo(() => {
    return isLimglish
      ? {
          title: "LIMGLISH",
          subtitle: "선생님 전용 로그인",
          accent: "linear-gradient(135deg, #111 0%, #333 55%, #111 100%)",
          badge: "Teacher",
        }
      : {
          title: "Academy",
          subtitle: "관리자/개발 로그인",
          accent: "linear-gradient(135deg, #0b2cff 0%, #1a66ff 55%, #0b2cff 100%)",
          badge: "Admin",
        };
  }, [isLimglish]);

  useEffect(() => {
    // mobile viewport 느낌 보정 (iOS 주소창 변화 대응)
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    const onResize = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "아이디/비밀번호를 확인해주세요.";
      setError(msg);
      setPending(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* background glow */}
      <div style={styles.bgGlow} aria-hidden />

      <div style={styles.shell}>
        {/* header card */}
        <div style={styles.hero}>
          <div style={{ ...styles.heroTop, background: brand.accent }}>
            <div style={styles.badge}>{brand.badge}</div>
            <div style={styles.heroTitle}>{brand.title}</div>
            <div style={styles.heroSub}>{brand.subtitle}</div>
          </div>

          {/* hint box */}
          <div style={styles.hintBox}>
            <div style={styles.hintRow}>
              <span style={styles.hintKey}>ID</span>
              <span style={styles.hintVal}>1111</span>
            </div>
            <div style={styles.hintRow}>
              <span style={styles.hintKey}>PW</span>
              <span style={styles.hintVal}>1111</span>
            </div>
          </div>

          {/* form */}
          <form onSubmit={onSubmit} style={styles.form}>
            <label style={styles.label}>
              <span style={styles.labelText}>아이디</span>
              <input
                inputMode="text"
                autoComplete="username"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>비밀번호</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
              />
            </label>

            <button
              type="submit"
              disabled={pending || !username || !password}
              style={{
                ...styles.button,
                opacity: pending || !username || !password ? 0.6 : 1,
                cursor: pending || !username || !password ? "not-allowed" : "pointer",
              }}
            >
              {pending ? "로그인 중..." : "로그인"}
            </button>

            {error && <div style={styles.error}>{error}</div>}
          </form>

          <div style={styles.footerNote}>
            {isLimglish ? (
              <span>※ 선생님 계정으로 로그인하세요.</span>
            ) : (
              <span>※ 운영/개발 환경 전용.</span>
            )}
          </div>
        </div>

        {/* tiny footer */}
        <div style={styles.tiny}>
          <span style={{ opacity: 0.75 }}>© {new Date().getFullYear()} HakwonPlus</span>
        </div>
      </div>

      {/* local keyframes */}
      <style>
        {`
          @keyframes floatIn {
            from { transform: translateY(8px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes glowPulse {
            0% { transform: translate(-30%, -30%) scale(1); opacity: 0.55; }
            50% { transform: translate(-30%, -30%) scale(1.08); opacity: 0.75; }
            100% { transform: translate(-30%, -30%) scale(1); opacity: 0.55; }
          }
          input::placeholder { color: rgba(0,0,0,0.35); }
        `}
      </style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "calc(var(--vh, 1vh) * 100)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "#0b0d12",
    position: "relative",
    overflow: "hidden",
  },
  bgGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(600px 600px at 25% 20%, rgba(255,255,255,0.10), transparent 55%), radial-gradient(700px 700px at 80% 70%, rgba(0,170,255,0.16), transparent 55%)",
    filter: "blur(0px)",
    animation: "glowPulse 6s ease-in-out infinite",
  },
  shell: {
    width: "100%",
    maxWidth: 420,
    zIndex: 1,
    animation: "floatIn 0.35s ease-out",
  },
  hero: {
    borderRadius: 22,
    overflow: "hidden",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
  },
  heroTop: {
    padding: "22px 18px 18px",
    color: "#fff",
    position: "relative",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 26,
    padding: "0 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.25)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.3,
    width: "fit-content",
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: -0.6,
    lineHeight: 1.05,
  },
  heroSub: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.9,
    fontWeight: 700,
  },
  hintBox: {
    margin: "14px 16px 0",
    borderRadius: 16,
    background: "rgba(0,0,0,0.04)",
    border: "1px solid rgba(0,0,0,0.06)",
    padding: "12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  hintRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 800,
    color: "#111",
  },
  hintKey: {
    opacity: 0.7,
    fontWeight: 900,
  },
  hintVal: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    letterSpacing: 0.2,
  },
  form: {
    padding: "14px 16px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  labelText: {
    fontSize: 12,
    fontWeight: 900,
    color: "#111",
    opacity: 0.75,
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fff",
    fontSize: 14,
    outline: "none",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  button: {
    marginTop: 6,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: -0.2,
    boxShadow: "0 14px 28px rgba(0,0,0,0.20)",
  },
  error: {
    marginTop: 4,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255, 0, 0, 0.06)",
    border: "1px solid rgba(255, 0, 0, 0.12)",
    color: "#b10000",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  footerNote: {
    padding: "0 16px 16px",
    color: "rgba(0,0,0,0.55)",
    fontSize: 12,
    fontWeight: 700,
  },
  tiny: {
    marginTop: 12,
    textAlign: "center",
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
  },
};
