import { useId, useState } from "react";
import { Button } from "@/shared/ui/ds";
import { useTheme } from "@/shared/contexts/ThemeContext";
import { THEMES } from "./themes";
import { normalizeAccent } from "./accent";
import ThemeGrid from "./ThemeGrid";
import s from "./AppearanceSettings.module.css";
export default function AppearanceSettings() {
  const { theme, accent, setTheme, setAccent, resetAppearance, persisted, retrySave } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const id = useId();
  function applyColor() {
    const value = normalizeAccent(draft ?? accent);
    setError(!value);
    if (value) { setAccent(value); setDraft(null); }
  }
  return <div className={s.settings}>
    <section aria-labelledby={id + "-style"}>
      <h2 id={id + "-style"} className={s.heading}>화면 스타일</h2>
      <p className={s.help}>익숙한 메뉴와 기능은 그대로, 편한 화면을 선택하세요.</p>
      <ThemeGrid themes={THEMES} currentTheme={theme} onSelect={setTheme} />
    </section>
    <section className={s.colorSection} aria-labelledby={id + "-color"}>
      <h2 id={id + "-color"} className={s.heading}>강조색</h2>
      <p id={id + "-hint"} className={s.help}>버튼과 선택한 메뉴에 사용할 색입니다. 잘 읽히도록 화면에서는 밝기가 조정될 수 있습니다.</p>
      <div className={s.colorControls}>
        <input type="color" aria-label="강조색 선택" value={accent} className={s.colorPicker}
          onChange={(event) => { setAccent(event.target.value); setDraft(null); setError(false); }} />
        <div className={s.hexField}>
          <label htmlFor={id + "-hex"}>색상 코드</label>
          <input id={id + "-hex"} value={draft ?? accent} maxLength={7} spellCheck={false}
            aria-invalid={error} aria-describedby={error ? id + "-error" : id + "-hint"}
            onChange={(event) => { setDraft(event.target.value); setError(false); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyColor(); } }} />
        </div>
        <Button type="button" intent="secondary" onClick={applyColor}>색상 적용</Button>
      </div>
      {error && <p id={id + "-error"} role="alert" className={s.error}>#2563eb처럼 #과 여섯 자리 색상 코드를 입력해 주세요.</p>}
    </section>
    <div className={s.footer}>
      <p role="status" className={s.help}>{persisted ? "이 브라우저에 저장되어 다음 방문에도 유지됩니다." : "현재 화면에 적용했지만 브라우저에 저장하지 못했습니다. 저장을 허용한 뒤 다시 시도해 주세요."}</p>
      {!persisted && <Button type="button" intent="secondary" onClick={retrySave}>저장 다시 시도</Button>}
      <Button type="button" intent="ghost" onClick={() => { resetAppearance(); setDraft(null); setError(false); }}>기본값으로 되돌리기</Button>
    </div>
  </div>;
}
