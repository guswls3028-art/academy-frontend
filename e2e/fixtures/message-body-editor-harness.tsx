import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import MessageBodyEditor from "@/shared/messaging/MessageBodyEditor";
import "@/index.css";

export function Harness() {
  const [body, setBody] = useState("");
  const [disabled, setDisabled] = useState(true);
  const [changes, setChanges] = useState(0);
  return (
    <main>
      <button onClick={() => { setBody("저장한 문구"); setDisabled(false); }}>문구 불러와 편집하기</button>
      <button onClick={() => setDisabled(!disabled)}>편집 상태 전환</button>
      <output aria-label="부모 본문">{body}</output>
      <output aria-label="본문 변경 횟수">{changes}</output>
      <MessageBodyEditor value={body} disabled={disabled} ariaLabel="안내문"
        onChange={(value) => { setBody(value); setChanges((count) => count + 1); }} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Harness /></StrictMode>);
