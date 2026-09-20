import { forwardRef, lazy, Suspense } from "react";
import "../styles/messageBodyEditor.css";

export type MessageBodyEditorHandle = { insert: (text: string) => void; focus: () => void };
export type MessageBodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const Editor = lazy(() => import("./MessageBodyEditorImpl"));

/** Plain message storage, with atomic variable chips and native editor history. */
const MessageBodyEditor = forwardRef<MessageBodyEditorHandle, MessageBodyEditorProps>((props, ref) => (
  <Suspense fallback={<div className="message-body-editor__loading" role="status">편집기를 여는 중…</div>}>
    <Editor {...props} ref={ref} />
  </Suspense>
));
MessageBodyEditor.displayName = "MessageBodyEditor";
export default MessageBodyEditor;
