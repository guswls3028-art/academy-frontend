/**
 * PATH: src/shared/ui/editor/RichTextEditor.tsx
 * TipTap-based rich text editor for admin SaaS.
 * Stores content as HTML string.
 */
import { useCallback, useRef, useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import "./rich-editor.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Called when user attaches files via the file button */
  onFileAttach?: (files: File[]) => void;
  /** List of already attached files to display */
  attachedFiles?: { name: string; url?: string }[];
  readOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Color Palette
// ---------------------------------------------------------------------------

const PALETTE_COLORS = [
  // Row 1: basics
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#ffffff",
  // Row 2: vivid
  "#ff0000", "#ff6600", "#ffcc00", "#33cc33", "#00cccc", "#3366ff", "#6633cc", "#cc00cc",
  // Row 3: soft
  "#ff9999", "#ffcc99", "#ffff99", "#ccffcc", "#ccffff", "#99ccff", "#cc99ff", "#ff99ff",
  // Row 4: deep
  "#cc0000", "#cc6600", "#cc9900", "#009900", "#006699", "#003399", "#660099", "#990066",
];

function ColorPalette({
  currentColor,
  onColorChange,
}: {
  currentColor: string;
  onColorChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="rich-editor__color-palette-anchor" ref={ref}>
      <button
        type="button"
        className="rich-editor__toolbar-btn"
        onClick={() => setOpen(!open)}
        title="글자 색상"
      >
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>A</span>
          <span
            className="rich-editor__color-swatch"
            style={{ background: currentColor }}
          />
        </span>
      </button>

      {open && (
        <div className="rich-editor__color-palette">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`rich-editor__color-swatch-btn${currentColor.toLowerCase() === c ? " rich-editor__color-swatch-btn--active" : ""}`}
              style={{ background: c, border: c === "#ffffff" ? "2px solid #ddd" : undefined }}
              onClick={() => { onColorChange(c); setOpen(false); }}
              title={c}
            />
          ))}
          <div className="rich-editor__color-palette-custom">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => { onColorChange(e.target.value); setOpen(false); }}
            />
            <span>직접 선택</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "내용을 입력하세요...",
  minHeight = 200,
  onFileAttach,
  attachedFiles,
  readOnly = false,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync external value changes (e.g., navigating between posts)
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  // --- Image upload (base64) ---
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !editor) return;

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > MAX_IMAGE_SIZE) {
          alert("이미지 크기는 5MB를 초과할 수 없습니다.");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          editor.chain().focus().setImage({ src: dataUrl }).run();
        };
        reader.readAsDataURL(file);
      });

      // reset so the same file can be re-selected
      e.target.value = "";
    },
    [editor],
  );

  // --- File attach ---
  const handleFileAttach = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !onFileAttach) return;
      onFileAttach(Array.from(files));
      e.target.value = "";
    },
    [onFileAttach],
  );

  // --- Link ---
  const handleLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("링크 URL을 입력하세요", prev);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  // --- Active helpers ---
  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  const btnCls = (active: boolean) =>
    `rich-editor__toolbar-btn${active ? " rich-editor__toolbar-btn--active" : ""}`;

  // --- Current font color ---
  const currentColor =
    (editor.getAttributes("textStyle").color as string) || "#000000";

  const hasFiles = attachedFiles && attachedFiles.length > 0;

  return (
    <div
      className={`rich-editor${readOnly ? " rich-editor--readonly" : ""}`}
    >
      {/* ===== Toolbar ===== */}
      {!readOnly && (
        <div className="rich-editor__toolbar" role="toolbar" aria-label="서식 도구">
          {/* --- Text formatting --- */}
          <button
            type="button"
            className={btnCls(isActive("bold"))}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="굵게 (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            className={btnCls(isActive("italic"))}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="기울임 (Ctrl+I)"
            style={{ fontStyle: "italic" }}
          >
            I
          </button>
          <button
            type="button"
            className={btnCls(isActive("underline"))}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="밑줄 (Ctrl+U)"
            style={{ textDecoration: "underline" }}
          >
            U
          </button>
          <button
            type="button"
            className={btnCls(isActive("strike"))}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="취소선"
            style={{ textDecoration: "line-through" }}
          >
            S
          </button>

          <span className="rich-editor__toolbar-divider" />

          {/* --- Font color with palette --- */}
          <ColorPalette
            currentColor={currentColor}
            onColorChange={(c) => editor.chain().focus().setColor(c).run()}
          />

          <span className="rich-editor__toolbar-divider" />

          {/* --- Text align --- */}
          <button
            type="button"
            className={btnCls(editor.isActive({ textAlign: "left" }))}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="왼쪽 정렬"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 2h12M1 5h8M1 8h12M1 11h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive({ textAlign: "center" }))}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="가운데 정렬"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 2h12M3 5h8M1 8h12M3 11h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive({ textAlign: "right" }))}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="오른쪽 정렬"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 2h12M5 5h8M1 8h12M5 11h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>

          <span className="rich-editor__toolbar-divider" />

          {/* --- Headings --- */}
          <button
            type="button"
            className={btnCls(isActive("heading", { level: 2 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="제목 2"
          >
            H2
          </button>
          <button
            type="button"
            className={btnCls(isActive("heading", { level: 3 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="제목 3"
          >
            H3
          </button>

          <span className="rich-editor__toolbar-divider" />

          {/* --- Lists --- */}
          <button
            type="button"
            className={btnCls(isActive("bulletList"))}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="글머리 기호"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="2.5" cy="3" r="1.2" fill="currentColor" />
              <circle cx="2.5" cy="7" r="1.2" fill="currentColor" />
              <circle cx="2.5" cy="11" r="1.2" fill="currentColor" />
              <path d="M5.5 3h7M5.5 7h7M5.5 11h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className={btnCls(isActive("orderedList"))}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="번호 목록"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <text x="1" y="4.5" fontSize="4.5" fontWeight="700" fill="currentColor">1</text>
              <text x="1" y="8.5" fontSize="4.5" fontWeight="700" fill="currentColor">2</text>
              <text x="1" y="12.5" fontSize="4.5" fontWeight="700" fill="currentColor">3</text>
              <path d="M5.5 3h7M5.5 7h7M5.5 11h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>

          <span className="rich-editor__toolbar-divider" />

          {/* --- Link --- */}
          <button
            type="button"
            className={btnCls(isActive("link"))}
            onClick={handleLink}
            title="링크 삽입/수정"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M6 8l2-2M5.17 9.83a2.5 2.5 0 010-3.54l1.12-1.12a2.5 2.5 0 013.54 3.54l-.56.56M8.83 4.17a2.5 2.5 0 010 3.54l-1.12 1.12a2.5 2.5 0 01-3.54-3.54l.56-.56"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* --- Image upload --- */}
          <button
            type="button"
            className="rich-editor__toolbar-btn"
            onClick={() => imageInputRef.current?.click()}
            title="이미지 삽입"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="4.5" cy="5.5" r="1.2" fill="currentColor" />
              <path d="M1 10l3.5-3.5L7 9l2-2 4 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />

          {/* --- File attach --- */}
          {onFileAttach && (
            <>
              <button
                type="button"
                className="rich-editor__toolbar-btn"
                onClick={() => fileInputRef.current?.click()}
                title="파일 첨부"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M12 7.17l-4.59 4.59a3.25 3.25 0 01-4.6-4.6l5.3-5.3a2.17 2.17 0 013.06 3.07l-5.3 5.3a1.08 1.08 0 01-1.53-1.53l4.59-4.6"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={handleFileAttach}
              />
            </>
          )}

          <span className="rich-editor__toolbar-divider" />

          {/* --- Undo / Redo --- */}
          <button
            type="button"
            className="rich-editor__toolbar-btn"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="실행 취소 (Ctrl+Z)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l-2 2 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 7h8a4 4 0 010 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M5 7h4a3 3 0 110 6H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="rich-editor__toolbar-btn"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="다시 실행 (Ctrl+Y)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 5l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 7H5a4 4 0 000 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M9 7H5a3 3 0 100 6h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* ===== Editor content ===== */}
      <div
        className="rich-editor__content"
        style={{ minHeight: `${minHeight}px` }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* ===== Attached files ===== */}
      {hasFiles && (
        <div className="rich-editor__files">
          <div className="rich-editor__files-title">첨부파일</div>
          {attachedFiles!.map((f, i) => (
            <div key={`${f.name}-${i}`} className="rich-editor__file-item">
              <span className="rich-editor__file-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M8 1H3.5A1.5 1.5 0 002 2.5v9A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V5L8 1z"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M8 1v4h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  {f.name}
                </a>
              ) : (
                <span>{f.name}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
