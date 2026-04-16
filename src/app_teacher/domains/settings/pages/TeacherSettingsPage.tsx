// PATH: src/app_teacher/domains/settings/pages/TeacherSettingsPage.tsx
// 설정 — 프로필 편집 + 비밀번호 변경 + 테마 선택 + 푸시 알림 + PWA
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import { useA2HS } from "@teacher/shared/hooks/useA2HS";
import { usePushSubscription } from "@teacher/shared/hooks/usePushSubscription";
import {
  ChevronLeft, User, Lock, Sun, Moon, Palette, Bell, Smartphone,
  Eye, EyeOff, Check, Pencil, Save, X,
} from "@teacher/shared/ui/Icons";
import { THEMES, type ThemeKey, type ThemeMeta, isThemeKey } from "@admin/domains/settings/constants/themes";
import { applyThemeToDom, loadThemeFromStorage } from "@admin/domains/settings/theme/themeRuntime";
import api from "@/shared/api/axios";

/* ─── API ─── */
async function updateProfile(payload: { name?: string; phone?: string; username?: string }) {
  const { data } = await api.patch("/core/profile/update_me/", payload);
  return data;
}

async function fetchTenantInfo() {
  const { data } = await api.get("/core/tenant-info/");
  return data;
}

async function updateTenantInfo(payload: Record<string, unknown>) {
  const { data } = await api.patch("/core/tenant-info/", payload);
  return data;
}

async function changePassword(payload: { old_password: string; new_password: string }) {
  const { data } = await api.post("/core/profile/change-password/", payload);
  return data;
}

/* ─── Helpers ─── */
const ROLE_LABELS: Record<string, string> = {
  owner: "원장",
  admin: "관리자",
  teacher: "강사",
  staff: "직원",
};

type ThemeGroup = { id: string; label: string; icon: React.ReactNode; themes: ThemeMeta[] };

function safeThemeFromDom(): ThemeKey {
  const v = String(document.documentElement.getAttribute("data-theme") || "").trim();
  return isThemeKey(v) ? (v as ThemeKey) : "modern-white";
}

/* ─── Main ─── */
export default function TeacherSettingsPage() {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const { canInstall, isInstalled, promptInstall } = useA2HS();
  const push = usePushSubscription();

  /* Profile editing */
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [phoneInput, setPhoneInput] = useState(user?.phone || "");
  const [usernameInput, setUsernameInput] = useState(user?.username || "");
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const profileMut = useMutation({
    mutationFn: () => updateProfile({ name: nameInput, phone: phoneInput, username: usernameInput || undefined }),
    onSuccess: (data) => {
      setEditingProfile(false);
      setProfileMsg({ type: "ok", text: "저장되었습니다" });
      refreshMe();
      setTimeout(() => setProfileMsg(null), 2500);
    },
    onError: () => setProfileMsg({ type: "err", text: "저장 실패. 다시 시도해주세요." }),
  });

  /* Password */
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const pwMut = useMutation({
    mutationFn: () => changePassword({ old_password: oldPw, new_password: newPw }),
    onSuccess: () => {
      setPwOpen(false);
      setOldPw("");
      setNewPw("");
      setNewPwConfirm("");
      setPwMsg({ type: "ok", text: "비밀번호가 변경되었습니다" });
      setTimeout(() => setPwMsg(null), 2500);
    },
    onError: () => setPwMsg({ type: "err", text: "현재 비밀번호가 일치하지 않습니다" }),
  });

  const pwValid = oldPw.length >= 1 && newPw.length >= 8 && newPw === newPwConfirm;

  /* Theme */
  const initialTheme = useMemo(() => {
    const stored = loadThemeFromStorage();
    if (stored && isThemeKey(stored)) return stored;
    return safeThemeFromDom();
  }, []);
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(initialTheme);

  useEffect(() => {
    applyThemeToDom(currentTheme);
  }, [currentTheme]);

  const themeGroups: ThemeGroup[] = useMemo(() => [
    {
      id: "WHITE", label: "라이트",
      icon: <Sun size={14} style={{ color: "var(--tc-text-muted)" }} />,
      themes: THEMES.filter((t) => t.group === "WHITE"),
    },
    {
      id: "DARK", label: "다크",
      icon: <Moon size={14} style={{ color: "var(--tc-text-muted)" }} />,
      themes: THEMES.filter((t) => t.group === "DARK"),
    },
    {
      id: "BRAND", label: "브랜드",
      icon: <Palette size={14} style={{ color: "var(--tc-text-muted)" }} />,
      themes: THEMES.filter((t) => t.group === "BRAND"),
    },
  ], []);

  const name = user?.name || "사용자";
  const roleLabel = ROLE_LABELS[user?.tenantRole || ""] || "직원";

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>설정</h1>
      </div>

      {/* ── Profile section ── */}
      <Section title="프로필" icon={<User size={15} />}>
        {/* Avatar + basic info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
            style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
            {name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold" style={{ color: "var(--tc-text)" }}>{name}</div>
            <div className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>{roleLabel} · {user?.username}</div>
          </div>
          {!editingProfile && (
            <button onClick={() => { setEditingProfile(true); setNameInput(user?.name || ""); setPhoneInput(user?.phone || ""); setUsernameInput(user?.username || ""); }}
              className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
              style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
              <Pencil size={12} /> 편집
            </button>
          )}
        </div>

        {editingProfile && (
          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--tc-border-subtle)" }}>
            <FieldInput label="이름" value={nameInput} onChange={setNameInput} placeholder="이름" />
            <FieldInput label="전화" value={phoneInput} onChange={setPhoneInput} placeholder="010-0000-0000" type="tel" />
            <FieldInput label="아이디" value={usernameInput} onChange={setUsernameInput} placeholder="로그인 아이디" />
            <div className="flex gap-2 mt-1">
              <SmBtn label="저장" primary loading={profileMut.isPending} onClick={() => profileMut.mutate()} icon={<Save size={13} />} />
              <SmBtn label="취소" onClick={() => setEditingProfile(false)} icon={<X size={13} />} />
            </div>
          </div>
        )}

        {profileMsg && <Toast msg={profileMsg} />}
      </Section>

      {/* ── Password section ── */}
      <Section title="보안" icon={<Lock size={15} />}>
        {!pwOpen ? (
          <button onClick={() => setPwOpen(true)}
            className="flex items-center gap-2 w-full text-left cursor-pointer"
            style={{ padding: "10px 0", background: "none", border: "none", color: "var(--tc-text)" }}>
            <Lock size={16} style={{ color: "var(--tc-text-muted)" }} />
            <span className="text-sm">비밀번호 변경</span>
            <ChevronLeft size={14} style={{ transform: "rotate(180deg)", marginLeft: "auto", color: "var(--tc-text-muted)" }} />
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <PwInput label="현재 비밀번호" value={oldPw} onChange={setOldPw} show={showOld} onToggle={() => setShowOld(!showOld)} />
            <PwInput label="새 비밀번호 (8자 이상)" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(!showNew)} />
            <FieldInput label="새 비밀번호 확인" value={newPwConfirm} onChange={setNewPwConfirm} type="password" placeholder="다시 입력" />
            {newPw.length > 0 && newPwConfirm.length > 0 && newPw !== newPwConfirm && (
              <div className="text-[11px]" style={{ color: "var(--tc-danger)" }}>비밀번호가 일치하지 않습니다</div>
            )}
            <div className="flex gap-2 mt-1">
              <SmBtn label="변경" primary disabled={!pwValid} loading={pwMut.isPending} onClick={() => pwMut.mutate()} icon={<Check size={13} />} />
              <SmBtn label="취소" onClick={() => { setPwOpen(false); setOldPw(""); setNewPw(""); setNewPwConfirm(""); }} icon={<X size={13} />} />
            </div>
          </div>
        )}
        {pwMsg && <Toast msg={pwMsg} />}
      </Section>

      {/* ── Theme section ── */}
      <Section title="테마" icon={<Palette size={15} />}>
        <p className="text-[12px] mb-3" style={{ color: "var(--tc-text-muted)" }}>
          선택한 테마가 즉시 적용됩니다. 데스크톱과 동일한 테마를 사용합니다.
        </p>
        {themeGroups.map((group) => (
          <div key={group.id} className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              {group.icon}
              <span className="text-[12px] font-semibold" style={{ color: "var(--tc-text-secondary)" }}>{group.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {group.themes.map((t) => (
                <MobileThemeCard key={t.key} theme={t} selected={t.key === currentTheme} onSelect={() => setCurrentTheme(t.key)} />
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* ── Push notification ── */}
      {push.supported && (
        <Section title="알림" icon={<Bell size={15} />}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>푸시 알림</div>
              <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                {push.subscribed ? "새 알림을 푸시로 받고 있습니다" : "알림을 놓치지 않도록 푸시를 켜보세요"}
              </div>
            </div>
            <button
              onClick={push.subscribed ? push.unsubscribe : push.subscribe}
              disabled={push.loading}
              className="text-xs font-bold cursor-pointer shrink-0"
              style={{
                padding: "6px 14px", borderRadius: "var(--tc-radius)", border: "none",
                background: push.subscribed ? "var(--tc-surface-soft)" : "var(--tc-primary)",
                color: push.subscribed ? "var(--tc-text-secondary)" : "#fff",
                opacity: push.loading ? 0.6 : 1,
              }}>
              {push.loading ? "..." : push.subscribed ? "끄기" : "켜기"}
            </button>
          </div>
          {push.permission === "denied" && (
            <div className="text-[11px] mt-2" style={{ color: "var(--tc-danger)" }}>
              브라우저에서 알림이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.
            </div>
          )}
        </Section>
      )}

      {/* ── App section ── */}
      <Section title="앱" icon={<Smartphone size={15} />}>
        {canInstall && (
          <button onClick={promptInstall}
            className="flex items-center gap-3 w-full text-left cursor-pointer rounded-lg"
            style={{ padding: "10px 12px", background: "var(--tc-primary-bg)", border: "1px solid var(--tc-primary)", borderRadius: "var(--tc-radius)" }}>
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "var(--tc-primary)", color: "#fff" }}>
              <Smartphone size={16} />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold" style={{ color: "var(--tc-primary)" }}>홈 화면에 추가</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>앱처럼 빠르게 접근</div>
            </div>
          </button>
        )}
        {isInstalled && (
          <div className="flex items-center gap-2"
            style={{ padding: "8px 12px", background: "var(--tc-success-bg)", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-success)" }}>
            <Check size={14} style={{ color: "var(--tc-success)" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--tc-success)" }}>앱이 설치되어 있습니다</span>
          </div>
        )}
        {!canInstall && !isInstalled && (
          <div className="text-[13px]" style={{ color: "var(--tc-text-muted)" }}>PWA 설치가 지원되지 않는 브라우저입니다</div>
        )}
      </Section>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Sub-components
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl"
      style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <span style={{ color: "var(--tc-primary)", display: "flex" }}>{icon}</span>
        <span className="text-[14px] font-bold" style={{ color: "var(--tc-text)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{
          padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
          border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)",
          color: "var(--tc-text)", outline: "none",
        }} />
    </div>
  );
}

function PwInput({ label, value, onChange, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <div className="flex items-center gap-1" style={{ borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)" }}>
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm"
          style={{ padding: "8px 10px", border: "none", background: "transparent", color: "var(--tc-text)", outline: "none" }} />
        <button onClick={onToggle} type="button" className="flex p-2 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function SmBtn({ label, primary, disabled, loading, onClick, icon }: {
  label: string; primary?: boolean; disabled?: boolean; loading?: boolean; onClick: () => void; icon?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
      style={{
        padding: "7px 14px", borderRadius: "var(--tc-radius)", border: "none",
        background: primary ? "var(--tc-primary)" : "var(--tc-surface-soft)",
        color: primary ? "#fff" : "var(--tc-text-secondary)",
        opacity: disabled || loading ? 0.5 : 1,
      }}>
      {icon}{loading ? "..." : label}
    </button>
  );
}

function Toast({ msg }: { msg: { type: "ok" | "err"; text: string } }) {
  return (
    <div className="text-[12px] font-medium mt-2"
      style={{ color: msg.type === "ok" ? "var(--tc-success)" : "var(--tc-danger)" }}>
      {msg.text}
    </div>
  );
}

/* Theme card for mobile — compact 3-column grid */
function MobileThemeCard({ theme, selected, onSelect }: { theme: ThemeMeta; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} type="button"
      className="flex flex-col items-center gap-1.5 cursor-pointer"
      style={{
        padding: "8px 4px", borderRadius: "var(--tc-radius)",
        border: selected ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
        background: selected ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
        transition: "all 150ms ease",
      }}>
      {/* Color preview dots */}
      <div className="flex gap-1">
        <ThemePreviewDot themeKey={theme.key} />
      </div>
      <span className="text-[11px] font-semibold truncate w-full text-center"
        style={{ color: selected ? "var(--tc-primary)" : "var(--tc-text-secondary)" }}>
        {theme.name}
      </span>
      {selected && (
        <span className="text-[9px] font-bold"
          style={{ color: "var(--tc-primary-contrast)", background: "var(--tc-primary)", borderRadius: "var(--tc-radius-full)", padding: "1px 6px" }}>
          현재
        </span>
      )}
    </button>
  );
}

/* Tiny color-dot preview for a theme */
const THEME_COLORS: Record<string, string[]> = {
  "modern-white":     ["#ffffff", "#2563eb", "#f8fafc"],
  "navy-pro":         ["#ffffff", "#1e3a5f", "#2563eb"],
  "mocha-office":     ["#fdf8f4", "#8b6914", "#b8860b"],
  "minimal-mono":     ["#ffffff", "#18181b", "#52525b"],
  "modern-dark":      ["#111827", "#60a5fa", "#1f2937"],
  "dark-navy":        ["#0c1929", "#38bdf8", "#1e3a5f"],
  "graphite-studio":  ["#1c1917", "#818cf8", "#292524"],
  "deep-ocean":       ["#0d1117", "#38bdf8", "#161b22"],
  "kakao-business":   ["#ffffff", "#3c1e1e", "#fee500"],
  "naver-works":      ["#ffffff", "#03c75a", "#1a1a1a"],
  "samsung-admin":    ["#ffffff", "#1428a0", "#0056b3"],
  "purple-insight":   ["#ffffff", "#7c3aed", "#6d28d9"],
};

function ThemePreviewDot({ themeKey }: { themeKey: string }) {
  const colors = THEME_COLORS[themeKey] ?? ["#ccc", "#999", "#eee"];
  return (
    <>
      {colors.map((c, i) => (
        <span key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,0.1)" }} />
      ))}
    </>
  );
}
