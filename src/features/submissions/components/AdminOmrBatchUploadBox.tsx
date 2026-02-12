import { useMemo, useRef, useState } from "react";
import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";

type Props = {
  examId: number;
};

type UploadItem = {
  file: File;
  status: "ready" | "uploading" | "done" | "fail";
  message?: string;
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

/**
 * AdminOmrBatchUploadBox (Production)
 * - 목적: OMR 다건 업로드 → 서버가 식별/인식/채점 파이프라인 처리
 * - 핵심: "조교가 식별번호 입력" 같은 UX 금지. 파일만 올리면 된다.
 * - 서버 계약: POST /submissions/exams/{examId}/omr/batch/
 *   - 만약 아직 백엔드 미구현이면 404/501 → 안내 표시 후 조용히 중단
 */
export default function AdminOmrBatchUploadBox({ examId }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const readyCount = useMemo(() => items.filter((x) => x.status === "ready").length, [items]);
  const doneCount = useMemo(() => items.filter((x) => x.status === "done").length, [items]);
  const failCount = useMemo(() => items.filter((x) => x.status === "fail").length, [items]);

  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setNotice(null);

    const next: UploadItem[] = Array.from(files).map((f) => ({
      file: f,
      status: "ready",
    }));

    setItems((prev) => [...prev, ...next]);

    // 같은 파일 재선택 가능하도록 reset
    if (inputRef.current) inputRef.current.value = "";
  };

  const clear = () => {
    if (busy) return;
    setItems([]);
    setNotice(null);
  };

  const removeOne = (idx: number) => {
    if (busy) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const upload = async () => {
    if (busy) return;
    if (!Number.isFinite(examId) || examId <= 0) {
      setNotice("유효하지 않은 examId 입니다.");
      return;
    }
    if (items.length === 0) {
      setNotice("업로드할 파일이 없습니다.");
      return;
    }

    setBusy(true);
    setNotice(null);

    // 순차 업로드(서버 보호). 필요하면 동시성 N으로 바꿔도 됨.
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.status !== "ready") continue;

      setItems((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, status: "uploading", message: undefined } : x))
      );

      try {
        const fd = new FormData();
        fd.append("files", it.file);

        // ✅ 여기 엔드포인트가 없으면 404가 날 수 있음 → 그 경우 조용히 안내 후 중단
        await api.post(`/submissions/exams/${examId}/omr/batch/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setItems((prev) =>
          prev.map((x, idx) => (idx === i ? { ...x, status: "done", message: "등록됨" } : x))
        );
      } catch (e: any) {
        const status = e?.response?.status;
        const detail = e?.response?.data?.detail;

        // 404/501이면 백엔드 미구현 or 라우팅 불일치 → 무한 시도 금지(즉시 중단)
        if (status === 404 || status === 501) {
          setItems((prev) =>
            prev.map((x, idx) =>
              idx === i ? { ...x, status: "fail", message: "API 미연결(404/501)" } : x
            )
          );
          setNotice(
            "다건 업로드 API가 아직 연결되지 않았습니다(404/501). 백엔드에 batch endpoint를 연결하면 바로 활성화됩니다."
          );
          break;
        }

        setItems((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: "fail", message: String(detail || "업로드 실패") } : x
          )
        );
      }
    }

    setBusy(false);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">다건 OMR 업로드</div>
            <div className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
              여러 장을 한 번에 올리면 서버가 <b>식별 → 답안추출 → 채점</b>을 자동 처리합니다.
              <br />
              (조교가 식별번호를 입력하는 UX는 금지. 파일만 올리면 됩니다)
            </div>
          </div>

          <div className="text-right text-xs text-[var(--text-muted)]">
            <div>
              준비 <b>{readyCount}</b> · 완료 <b>{doneCount}</b> · 실패 <b>{failCount}</b>
            </div>
          </div>
        </div>

        {notice && (
          <div className="rounded border border-yellow-600/30 bg-yellow-600/10 p-3 text-sm text-yellow-800">
            {notice}
          </div>
        )}

        <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => onPickFiles(e.target.files)}
              disabled={busy}
              className="text-sm"
            />

            <Button type="button" intent="primary" size="md" disabled={busy || items.length === 0} onClick={() => void upload()}>
              {busy ? "업로드 중..." : "업로드 시작"}
            </Button>

            <Button type="button" intent="secondary" size="md" disabled={busy || items.length === 0} onClick={clear}>
              비우기
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">아직 선택된 파일이 없습니다.</div>
          ) : (
            <div className="rounded border overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>파일</th>
                    <th style={{ width: 120 }}>크기</th>
                    <th style={{ width: 140 }}>상태</th>
                    <th style={{ width: 100 }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={`${it.file.name}-${idx}`}>
                      <td className="text-sm">{it.file.name}</td>
                      <td className="text-sm text-[var(--text-muted)]">{humanizeBytes(it.file.size)}</td>
                      <td className="text-sm">
                        {it.status === "ready" && "대기"}
                        {it.status === "uploading" && "업로드 중..."}
                        {it.status === "done" && <span className="text-emerald-600">완료</span>}
                        {it.status === "fail" && <span className="text-red-600">실패</span>}
                        {it.message ? <span className="ml-2 text-xs text-[var(--text-muted)]">({it.message})</span> : null}
                      </td>
                      <td>
                        <Button type="button" intent="secondary" size="sm" disabled={busy} onClick={() => removeOne(idx)}>
                          삭제
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-[var(--text-muted)]">
            ※ batch API가 없으면 404/501이 뜨며, 그 경우 UI는 자동으로 시도를 멈추고 안내만 표시합니다.
          </div>
        </div>
      </div>
    </>
  );
}
