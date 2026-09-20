import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent, Node, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Redo2, Undo2 } from "lucide-react";
import { Button, ICON } from "@/shared/ui/ds";
import { getTemplateBlock } from "../constants/templateBlocks";
import type { MessageBodyEditorHandle, MessageBodyEditorProps } from "./MessageBodyEditor";

function inlineContent(text: string): JSONContent[] {
  return text.split(/(#\{[^}\n]+\})/g).filter(Boolean).map((part) => {
    const match = part.match(/^#\{([^}]+)\}$/);
    return match
      ? { type: "messageVariable", attrs: { name: match[1] } }
      : { type: "text", text: part };
  });
}

function messageDocument(text: string): JSONContent {
  return {
    type: "doc",
    content: text.replace(/\r\n?/g, "\n").split("\n").map((line) => ({
      type: "paragraph", content: inlineContent(line),
    })),
  };
}

function insertionContent(text: string): JSONContent[] {
  return /[\r\n]/.test(text) ? messageDocument(text).content ?? [] : inlineContent(text);
}

function messageText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "messageVariable") return `#{${node.attrs?.name ?? ""}}`;
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(messageText).join(node.type === "doc" ? "\n" : "");
}

const MessageVariable = Node.create({
  name: "messageVariable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ name: { default: "" } }),
  parseHTML: () => [{
    tag: "span[data-message-variable]",
    getAttrs: (element) => ({ name: element.getAttribute("data-message-variable") }),
  }],
  renderHTML({ node }) {
    const name = String(node.attrs.name);
    const block = getTemplateBlock(`#{${name}}`);
    return ["span", {
      "data-message-variable": name,
      contenteditable: "false",
      class: "message-body-editor__variable",
      title: block?.description ?? "학생별 정보가 자동으로 들어갑니다",
    }, block?.label ?? name];
  },
  renderText: ({ node }) => `#{${node.attrs.name}}`,
});

const MessageBodyEditorImpl = forwardRef<MessageBodyEditorHandle, MessageBodyEditorProps>(({
  value, onChange, disabled = false, placeholder = "안내문을 작성하고 필요한 정보를 블록으로 넣으세요.",
}, ref) => {
  const currentEditor = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false, bold: false, bulletList: false, code: false,
        codeBlock: false, heading: false, horizontalRule: false, italic: false,
        link: false, listItem: false, listKeymap: false, orderedList: false,
        strike: false, underline: false, trailingNode: false,
      }),
      MessageVariable,
      Placeholder.configure({ placeholder }),
    ],
    content: messageDocument(value),
    editable: !disabled,
    onUpdate: ({ editor: current }) => onChange(messageText(current.getJSON())),
    editorProps: {
      attributes: { role: "textbox", "aria-label": "안내문", "aria-multiline": "true", spellcheck: "false" },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (text == null) return false;
        event.preventDefault();
        currentEditor.current?.chain().focus().insertContent(insertionContent(text)).run();
        return true;
      },
      // Prevent rich external drops from changing a plain-text message's format.
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const text = event.dataTransfer?.getData("text/plain");
        if (!text) return false;
        event.preventDefault();
        const activeEditor = currentEditor.current;
        const point = activeEditor?.view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (point) activeEditor?.commands.setTextSelection(point.pos);
        activeEditor?.chain().focus().insertContent(insertionContent(text)).run();
        return true;
      },
    },
  });
  currentEditor.current = editor;

  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  useEffect(() => {
    if (editor && messageText(editor.getJSON()) !== value) {
      editor.commands.setContent(messageDocument(value), { emitUpdate: false });
    }
  }, [editor, value]);
  useImperativeHandle(ref, () => ({
    insert(text) {
      if (!editor || disabled) return;
      editor.chain().focus().insertContent(insertionContent(text)).run();
    },
    focus: () => { editor?.commands.focus(); },
  }), [editor, disabled]);

  return (
    <div className="message-body-editor" data-disabled={disabled || undefined}>
      <div className="message-body-editor__toolbar">
        <Button type="button" intent="ghost" size="sm" aria-label="실행 취소" title="실행 취소 (Ctrl+Z / ⌘Z)"
          disabled={disabled || !editor?.can().undo()} onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={ICON.sm} />실행 취소</Button>
        <Button type="button" intent="ghost" size="sm" aria-label="다시 실행" title="다시 실행 (Ctrl+Shift+Z / Ctrl+Y)"
          disabled={disabled || !editor?.can().redo()} onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={ICON.sm} />다시 실행</Button>
        <span className="message-body-editor__hint">블록은 학생별 정보로 바뀝니다</span>
      </div>
      <EditorContent editor={editor} className="message-body-editor__content" />
    </div>
  );
});
MessageBodyEditorImpl.displayName = "MessageBodyEditorImpl";
export default MessageBodyEditorImpl;
