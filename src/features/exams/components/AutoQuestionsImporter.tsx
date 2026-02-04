// PATH: src/features/exams/components/AutoQuestionsImporter.tsx
import { useState } from "react";
import { postAutoQuestions, Box } from "../api/autoQuestionsApi";

interface Props {
  sheetId: number;
  disabled: boolean; // template locked
  onDone?: () => void;
}

/**
 * 목적:
 * - Vision/Segmentation worker 결과(JSON boxes)를 그대로 붙여넣어 반영
 * - 클릭 최소화, 키보드 중심
 */
export function AutoQuestionsImporter({ sheetId, disabled, onDone }: Props) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function parseBoxes(): Box[] {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("boxes must be an array");
    }
    return parsed.map((b) => {
      if (!Array.isArray(b) || b.length !== 4) {
        throw new Error("each box must be [x,y,w,h]");
      }
      return [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])] as Box;
    });
  }

  async function submit() {
    if (disabled) return;
    setBusy(true);
    setMsg("");

    try {
      const boxes = parseBoxes();
      await postAutoQuestions(sheetId, boxes);
      setMsg("문항 생성 완료");
      setRaw("");
      onDone?.();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || e.message || "실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="font-medium">문항 자동 생성 (AI 결과 입력)</h3>

      {disabled && (
        <div className="text-xs text-red-500">
          템플릿이 이미 사용 중이라 문항 구조 변경이 봉인됩니다
        </div>
      )}

      <textarea
        disabled={disabled}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={6}
        placeholder='[[x,y,w,h], ...]'
        className="w-full border rounded p-2 text-sm font-mono"
      />

      <div className="flex items-center gap-2">
        <button
          disabled={disabled || busy}
          onClick={submit}
          className={`px-3 py-2 rounded text-sm ${
            disabled || busy
              ? "bg-gray-300 text-gray-500"
              : "bg-black text-white"
          }`}
        >
          적용
        </button>

        {busy && <span className="text-xs text-gray-400">처리 중…</span>}
        {msg && <span className="text-xs text-gray-600">{msg}</span>}
      </div>
    </section>
  );
}
