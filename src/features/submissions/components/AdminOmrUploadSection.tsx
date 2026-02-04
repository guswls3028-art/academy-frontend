// PATH: src/features/submissions/components/AdminOmrUploadSection.tsx
/**
 * AdminOmrUploadSection - 조교용 업로드 작업대 (단건/다건)
 * - 입력칸 없음
 * - 드롭/선택만 하면 서버가 제출을 생성하고 워커 파이프라인 돌림
 * - 엔드포인트 후보를 여러 개 시도(404면 자동 fallback)
 */

import { useMemo, useRef, useState } from "react";
import api from "@/shared/api/axios";
import axios from "axios";

type Props = {
  examId: number;
  onUploaded?: () => void;
};

type UploadResult = {
  ok: boolean;
  message: string;
  created?: number; // created submissions count (if backend returns)
};

const ACCEPT = [
  "image/*",
  "application/pdf",
].join(",");

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

async function postWithFallback(examId: number, form: FormData) {
  /**
   * ✅ 프로젝트마다 엔드포인트가 다를 수 있어서 후보를 순서대로 시도한다.
   * - 404면 다음 후보로 넘어감
   * - 400/403/500은 그대로 throw (진짜 에러)
   */
  const candidates = [
    // 가장 흔한 형태들
    `/submissions/exams/${examId}/omr/upload/`,
    `/submissions/exams/${examId}/omr/batch/`,
    `/submissions/exams/${examId}/omr/files/`,
    `/submissions/exams/${examId}/omr/`, // 혹시 multipart도 받도록 구현한 경우
  ];

  let last404: any = null;

  for (const url of candidates) {
    try {
      const res = await api.post(url, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res;
    } catch (e: any) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        last404 = e;
        continue;
      }
      throw e;
    }
  }

  // 후보 전부 404
  throw last404 ?? new Error("업로드 엔드포인트를 찾지 못했습니다 (404).");
}

export default function AdminOmrUploadSection({ examId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const totalBytes = useMemo(() => files.reduce((t, f) => t + (f.size || 0), 0), [files]);

  const canSubmit = useMemo(() => {
    return Number.isFinite(examId) && examId > 0 && files.length > 0 && !busy;
  }, [examId, files.length, busy]);

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    // 중복명+사이즈 기준으로 대충 dedupe
    const key = (f: File) => `${f.name}__${f.size}`;
    const map = new Map<string, File>();
    for (const f of [...files, ...arr]) map.set(key(f), f);
    setFiles(Array.from(map.values()));
    setResult(null);
  };

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    pickFiles(ev.dataTransfer.files);
  };

  const upload = async () => {
    if (!canSubmit) return;

    setBusy(true);
    setResult(null);

    try {
      const form = new FormData();
      // 백엔드 구현마다 키가 다르니, 가장 흔한 형태로 "files" 반복 + "file"도 추가
      files.forEach((f) => form.append("files", f));
      if (files.length === 1) form.append("file", files[0]);

      const res = await postWithFallback(examId, form);

      // 서버가 반환하는 형태가 제각각이라 안전하게 파싱
      const data = res.data as any;

      const created =
        Number(data?.created) ||
        Number(data?.created_count) ||
        Number(data?.count) ||
        (Array.isArray(data?.items) ? data.items.length : 0) ||
        (Array.isArray(data) ? data.length : 0) ||
        undefined;

      setResult({
        ok: true,
        message:
          created && created > 0
            ? `업로드 완료 · 제출 ${created}건 생성됨`
            : "업로드 완료 · 제출 생성/처리는 서버에서 진행됩니다.",
        created,
      });

      setFiles([]);
      onUploaded?.();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;

      let msg =
        detail ||
        e?.message ||
        "업로드 실패. 서버 엔드포인트/권한/파일 형식을 확인하세요.";

      if (status === 403) {
        msg = detail || "권한이 없습니다. (Admin/Teacher 권한 필요)";
      } else if (status === 400) {
        msg = detail || "요청 값이 올바르지 않습니다. 파일 형식을 확인하세요.";
      } else if (status === 404) {
        msg =
          "업로드 API를 찾지 못했습니다(404). " +
          "백엔드에서 업로드 엔드포인트 경로를 확인하세요.";
      }

      setResult({ ok: false, message: String(msg) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            OMR 스캔 업로드
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            스캔 이미지/PDF를 업로드하면 서버가 <b>식별 → 답안추출 → 채점</b>을 자동 수행합니다.
          </div>
        </div>

        <div className="text-right text-xs text-[var(--text-muted)]">
          <div>선택: {files.length}개</div>
          <div>용량: {humanizeBytes(totalBytes)}</div>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
        className={[
          "rounded-lg border border-dashed p-4 transition",
          "bg-[var(--bg-surface-soft)]",
        ].join(" ")}
      >
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          파일을 여기로 드롭
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          지원: 이미지(JPG/PNG) / PDF · 여러 장 한번에 업로드 가능
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            파일 선택
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={!canSubmit}
            onClick={() => void upload()}
          >
            {busy ? "업로드 중..." : "업로드 시작"}
          </button>

          {files.length > 0 && !busy && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setFiles([]);
                setResult(null);
              }}
            >
              선택 초기화
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
          disabled={busy}
        />

        {files.length > 0 && (
          <div className="mt-3 max-h-40 overflow-auto rounded border bg-white/70">
            {files.map((f, idx) => (
              <div key={`${f.name}-${f.size}-${idx}`} className="flex items-center justify-between gap-3 px-3 py-2 border-b last:border-b-0">
                <div className="text-xs text-[var(--text-secondary)] truncate">
                  {f.name}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {humanizeBytes(f.size)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div
          className={[
            "rounded border p-3 text-sm",
            result.ok
              ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-800"
              : "border-red-600/30 bg-red-600/10 text-red-700",
          ].join(" ")}
        >
          {result.message}
        </div>
      )}

      <div className="text-[11px] text-[var(--text-muted)]">
        ※ 학생 식별번호는 <b>OMR 마킹</b>으로 처리됩니다. 조교가 입력하지 않습니다.
      </div>
    </div>
  );
}
