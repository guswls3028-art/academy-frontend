/**
 * AdminOmrUploadSection
 *
 * WHY:
 * - submissions 도메인은 "제출 이벤트 생성"까지만 책임진다
 * - 점수/판정/상태 해석은 절대 하지 않는다
 * - FINAL SPEC: POST /submissions/exams/{exam_id}/omr/ 만 사용
 * - JSX 사용 → 반드시 .tsx
 */

import { useState } from "react";
import api from "@/shared/api/axios";

type Props = {
  examId: number;
};

export default function AdminOmrUploadSection({ examId }: Props) {
  const [enrollmentId, setEnrollmentId] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [fileKey, setFileKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSuccess(null);

    const eid = Number(enrollmentId);
    const sid = Number(sheetId);

    if (!eid || !sid || !fileKey.trim()) {
      setError("enrollment_id, sheet_id, file_key는 모두 필수입니다.");
      return;
    }

    try {
      setLoading(true);

      await api.post(`/submissions/exams/${examId}/omr/`, {
        enrollment_id: eid,
        sheet_id: sid,
        file_key: fileKey.trim(),
      });

      setSuccess(
        "제출이 등록되었습니다. 답안 추출 및 채점은 자동으로 진행됩니다."
      );

      // reset
      setEnrollmentId("");
      setSheetId("");
      setFileKey("");
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          "제출 등록에 실패했습니다. 세션/자산/ID 조건을 확인하세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-4">
      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          OMR 제출 등록
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          스캔된 OMR 파일의 위치(file_key)를 기반으로 제출 이벤트를 생성합니다.
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded border border-green-400 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          placeholder="enrollment_id"
          className="rounded border px-3 py-2 text-sm"
          value={enrollmentId}
          onChange={(e) => setEnrollmentId(e.target.value)}
          disabled={loading}
        />

        <input
          placeholder="sheet_id"
          className="rounded border px-3 py-2 text-sm"
          value={sheetId}
          onChange={(e) => setSheetId(e.target.value)}
          disabled={loading}
        />

        <input
          placeholder="file_key (R2 경로)"
          className="rounded border px-3 py-2 text-sm"
          value={fileKey}
          onChange={(e) => setFileKey(e.target.value)}
          disabled={loading}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "등록 중..." : "제출 등록"}
      </button>
    </div>
  );
}
