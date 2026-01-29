/**
 * AssetUploadSection (Production)
 * - 단일진실: exams ExamAssetView (POST /exams/{examId}/assets/)
 * - multipart: asset_type + file
 * - 성공 시 exam-assets query invalidate로 즉시 반영
 */

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Props = {
  examId: number;
  assetType: string; // "problem_pdf" | "omr_sheet"
  title: string;
  accept: string;
};

function humanizeBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function AssetUploadSection({
  examId,
  assetType,
  title,
  accept,
}: Props) {
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      Number.isFinite(examId) &&
      examId > 0 &&
      !!file &&
      !submitting
    );
  }, [examId, file, submitting]);

  const upload = async () => {
    if (!canSubmit || !file) return;

    try {
      setSubmitting(true);
      setError(null);
      setDoneMsg(null);

      const form = new FormData();
      form.append("asset_type", assetType);
      form.append("file", file);

      await api.post(`/exams/${examId}/assets/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setDoneMsg("업로드 완료");
      setFile(null);

      // ✅ 즉시 반영
      await qc.invalidateQueries({ queryKey: ["exam-assets", examId] });
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;

      // 백엔드 봉인 메시지/권한/검증 메시지를 가능한 그대로 노출
      let msg =
        detail ||
        "업로드 실패. 파일/권한/템플릿 봉인 상태를 확인하세요.";

      if (status === 403) {
        msg =
          detail ||
          "권한이 없습니다. (Teacher/Admin 필요 또는 운영시험은 업로드 불가)";
      }

      if (status === 400) {
        msg = detail || "요청 값이 올바르지 않습니다.";
      }

      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            운영 시험 제출/채점에 필요합니다. (asset_type: <b>{assetType}</b>)
          </div>
        </div>

        <div className="text-xs text-[var(--text-muted)] text-right">
          {file ? (
            <>
              <div className="font-medium text-[var(--text-secondary)]">
                {file.name}
              </div>
              <div>{humanizeBytes(file.size)}</div>
            </>
          ) : (
            <div>파일을 선택하세요</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept={accept}
          onChange={(e) => {
            setDoneMsg(null);
            setError(null);
            const f = e.target.files?.[0] ?? null;
            setFile(f);
          }}
          disabled={submitting}
          className="text-sm"
        />

        <button
          type="button"
          className="btn-primary"
          disabled={!canSubmit}
          onClick={() => void upload()}
          title="템플릿 시험에서만 업로드 가능합니다."
        >
          {submitting ? "업로드 중..." : "업로드"}
        </button>

        {file && !submitting && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setFile(null);
              setError(null);
              setDoneMsg(null);
            }}
          >
            선택 취소
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {doneMsg && (
        <div className="rounded border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm text-emerald-700">
          {doneMsg}
        </div>
      )}

      <div className="text-xs text-[var(--text-muted)]">
        ※ 템플릿이 이미 운영시험(regular)에 의해 사용 중이면, 서버 정책상 자산 교체가 봉인될 수 있습니다.
      </div>
    </div>
  );
}
