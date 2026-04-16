// PATH: src/app_teacher/shared/ui/MobileRichEditor.tsx
// 모바일 간이 리치 텍스트 에디터 — 볼드/이탤릭/리스트/링크 툴바
import { useRef, useCallback } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function MobileRichEditor({ value, onChange, placeholder = "내용을 입력하세요", minHeight = 150 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    editorRef.current?.focus();
  }, [onChange]);

  const handleLink = () => {
    const url = prompt("링크 URL을 입력하세요:", "https://");
    if (url) exec("createLink", url);
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--tc-border-strong)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5"
        style={{ background: "var(--tc-surface-soft)", borderBottom: "1px solid var(--tc-border)" }}>
        <ToolBtn label="B" onClick={() => exec("bold")} bold />
        <ToolBtn label="I" onClick={() => exec("italic")} italic />
        <ToolBtn label="U" onClick={() => exec("underline")} />
        <div style={{ width: 1, height: 16, background: "var(--tc-border)", margin: "0 4px" }} />
        <ToolBtn label="•" onClick={() => exec("insertUnorderedList")} />
        <ToolBtn label="1." onClick={() => exec("insertOrderedList")} />
        <div style={{ width: 1, height: 16, background: "var(--tc-border)", margin: "0 4px" }} />
        <ToolBtn label="🔗" onClick={handleLink} />
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        dangerouslySetInnerHTML={{ __html: value }}
        className="text-sm leading-relaxed outline-none"
        style={{
          padding: "var(--tc-space-3)",
          minHeight,
          color: "var(--tc-text)",
          background: "var(--tc-surface)",
        }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable]:empty::before {
          content: attr(data-placeholder);
          color: var(--tc-text-muted);
          pointer-events: none;
        }
        [contenteditable] a { color: var(--tc-primary); text-decoration: underline; }
      `}</style>
    </div>
  );
}

function ToolBtn({ label, onClick, bold, italic }: { label: string; onClick: () => void; bold?: boolean; italic?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center justify-center cursor-pointer"
      style={{
        width: 28, height: 28, borderRadius: "var(--tc-radius-sm)",
        border: "none", background: "none",
        color: "var(--tc-text-secondary)",
        fontSize: 13,
        fontWeight: bold ? 800 : 400,
        fontStyle: italic ? "italic" : "normal",
      }}>
      {label}
    </button>
  );
}
