import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";

export default function CustomLoginPage() {
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
    <>
      {/* 🚑 전역 강제 복구: 어떤 테마/필터/토큰도 무시 */}
      <style>{`
        .__auth-fuck * {
          color: #000 !important;
          filter: none !important;
          opacity: 1 !important;
        }
        .__auth-fuck input::placeholder {
          color: #999 !important;
        }
      `}</style>

      <div
        className="__auth-fuck"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f6f8",
        }}
      >
        <div
          style={{
            width: 360,
            background: "#fff",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            로그인 gochul 0000
          </h1>
          <p style={{ fontSize: 13, marginBottom: 16 }}>
            HakwonPlus Admin
          </p>

          <form onSubmit={onSubmit}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디"
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 8,
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 12,
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />

            <button
              type="submit"
              disabled={pending}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 6,
                border: "none",
                background: "#000",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {pending ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {error && (
            <div style={{ marginTop: 12, color: "red", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
