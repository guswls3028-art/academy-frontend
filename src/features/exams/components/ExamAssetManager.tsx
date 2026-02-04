// PATH: src/features/exams/components/ExamAssetManager.tsx
import { useEffect, useState } from "react";
import {
  fetchExamAssets,
  uploadExamAsset,
  ExamAsset,
  ExamAssetType,
} from "../api/examAssetApi";

interface Props {
  examId: number; // template or regular id (backend resolves on GET)
  disabled: boolean; // template locked이면 true (업로드 봉인 정책 반영)
}

const ASSET_LABEL: Record<ExamAssetType, string> = {
  problem_pdf: "문제 PDF",
  omr_sheet: "OMR 답안지",
};

export function ExamAssetManager({ examId, disabled }: Props) {
  const [items, setItems] = useState<ExamAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function reload() {
    const res = await fetchExamAssets(examId);
    setItems(res.data || []);
  }

  useEffect(() => {
    reload();
  }, [examId]);

  async function onUpload(assetType: ExamAssetType, file: File | null) {
    if (!file || disabled) return;

    setBusy(true);
    setMsg("");

    try {
      await uploadExamAsset({ examId, assetType, file });
      await reload();
      setMsg("업로드 완료");
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  function find(type: ExamAssetType) {
    return items.find((x) => x.asset_type === type) ?? null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">시험 자산</h3>
        {disabled && (
          <span className="text-xs text-red-500">
            템플릿이 이미 사용 중이라 자산 교체가 봉인됩니다
          </span>
        )}
      </div>

      {msg && <div className="text-xs text-gray-600">{msg}</div>}

      <div className="border rounded divide-y">
        {(Object.keys(ASSET_LABEL) as ExamAssetType[]).map((t) => {
          const existing = find(t);
          return (
            <div key={t} className="p-3 flex items-center gap-3">
              <div className="w-28 text-sm font-medium">{ASSET_LABEL[t]}</div>

              <div className="flex-1 text-xs text-gray-500">
                {existing ? (
                  <>
                    <span className="mr-2">{existing.file_key}</span>
                    <span className="mr-2">
                      {existing.file_size ? `${existing.file_size} bytes` : ""}
                    </span>
                  </>
                ) : (
                  <span>등록된 파일 없음</span>
                )}
              </div>

              {existing?.download_url && (
                <a
                  className="text-sm underline"
                  href={existing.download_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  다운로드
                </a>
              )}

              <label className={`text-sm px-3 py-2 rounded border cursor-pointer ${
                disabled || busy ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white"
              }`}>
                교체 업로드
                <input
                  type="file"
                  className="hidden"
                  disabled={disabled || busy}
                  onChange={(ev) => onUpload(t, ev.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          );
        })}
      </div>

      {busy && <div className="text-xs text-gray-400">처리 중...</div>}
    </section>
  );
}
