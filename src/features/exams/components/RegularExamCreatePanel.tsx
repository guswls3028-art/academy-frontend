// PATH: src/features/exams/components/RegularExamCreatePanel.tsx
import { useState } from "react";
import { createRegularExam } from "../api/regularExamApi";

interface Props {
  templateExamId: number;
  sessionId: number;
  onCreated?: (examId: number) => void;
}

/**
 * 목적:
 * - template → 실제 운영 시험 생성
 * - subject/구조는 서버 단일진실
 */
export function RegularExamCreatePanel({
  templateExamId,
  sessionId,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    setBusy(true);
    setMsg("");

    try {
      const res = await createRegularExam({
        title,
        description: desc,
        template_exam_id: templateExamId,
        session_id: sessionId,
      });
      setMsg("시험 생성 완료");
      setTitle("");
      setDesc("");
      onCreated?.(res.data.id);
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="font-medium">운영 시험 생성</h3>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="시험명"
        className="w-full border rounded px-2 py-1 text-sm"
      />

      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="설명 (선택)"
        rows={3}
        className="w-full border rounded p-2 text-sm"
      />

      <div className="flex items-center gap-2">
        <button
          disabled={busy || !title}
          onClick={submit}
          className={`px-3 py-2 rounded text-sm ${
            busy || !title
              ? "bg-gray-300 text-gray-500"
              : "bg-black text-white"
          }`}
        >
          생성
        </button>

        {busy && <span className="text-xs text-gray-400">처리 중…</span>}
        {msg && <span className="text-xs text-gray-600">{msg}</span>}
      </div>
    </section>
  );
}
