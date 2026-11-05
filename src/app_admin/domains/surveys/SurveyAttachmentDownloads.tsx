import { useEffect, useRef, useState } from "react";
import { getPresignedUrl } from "@/shared/api/contracts/storage";
import { fetchPresignedMediaBlob } from "@/shared/api/axios";
import { surveyError, type SurveyAttachment, type SurveyRecipientRow } from "@/shared/api/surveys";
import styles from "@/shared/ui/surveys/Surveys.module.css";

type ExportFile = SurveyAttachment & { studentName: string; studentId: number };
const safeName = (name: string) => Array.from(name, (character) => character.charCodeAt(0) < 32 ? "_" : character).join("").replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+/, "_").slice(0, 100);

export default function SurveyAttachmentDownloads({ surveyId, rows }: { surveyId: number; rows: SurveyRecipientRow[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const batches: ExportFile[][] = [];
  let size = 0;
  for (const row of rows) for (const file of row.response?.attachments ?? []) {
    if (!batches.length || size + file.size_bytes > 50 * 1024 * 1024 || batches[batches.length - 1].length >= 20) {
      batches.push([]); size = 0;
    }
    batches[batches.length - 1].push({ ...file, studentName: row.student_name, studentId: row.student_id });
    size += file.size_bytes;
  }
  if (!batches.length) return null;
  const download = async (index: number) => {
    const abort = new AbortController();
    controller.current = abort;
    setBusy(index); setError(""); setProgress("첨부 묶음을 준비하고 있습니다.");
    const timeout = setTimeout(() => abort.abort(), 120000);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const batch = batches[index];
      for (const [position, file] of batch.entries()) {
        if (abort.signal.aborted) throw new Error("내려받기를 중단했습니다. 같은 묶음을 다시 시도할 수 있습니다.");
        setProgress(`${position + 1} / ${batch.length}개 · ${file.studentName} ${file.name}`);
        const { url } = await getPresignedUrl(file.r2_key, 300, undefined, true);
        let blob: Blob;
        try { blob = await fetchPresignedMediaBlob(url, abort.signal); }
        catch (value) {
          if (abort.signal.aborted) throw value;
          throw new Error(`${file.name}: 내려받지 못했습니다. 원본 내려받기를 확인한 뒤 다시 시도해 주세요.`);
        }
        if (blob.size !== file.size_bytes) throw new Error(`${file.name}의 원본 크기가 변경되었습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.`);
        zip.file(`${safeName(file.studentName)}-${file.studentId}/${file.id}-${safeName(file.name)}`, blob);
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      if (abort.signal.aborted) throw new Error("내려받기를 중단했습니다. 같은 묶음을 다시 시도할 수 있습니다.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `설문-${surveyId}-첨부-${rows[0].student_id}-${index + 1}.zip`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setProgress(`${batch.length}개 파일의 묶음 다운로드를 시작했습니다.`);
    } catch (value) {
      setError(abort.signal.aborted ? "내려받기가 중단되었습니다. 같은 묶음을 다시 시도해 주세요. 불완전한 ZIP은 저장하지 않습니다." : surveyError(value));
      setProgress("");
    } finally { clearTimeout(timeout); setBusy(null); controller.current = null; }
  };
  return <details className={styles.advanced}><summary>현재 목록의 첨부 묶음 받기</summary>
    <p className={styles.muted}>학생별 폴더로 내려받습니다. 한 묶음은 50MB·20개 이하이며, 다음 목록의 자료는 페이지를 넘겨 받을 수 있습니다.</p>
    <div className={styles.actions}>{batches.map((batch, index) => <button key={index} type="button" className={styles.button} disabled={busy !== null} onClick={() => { void download(index); }}>묶음 {index + 1} · {batch.length}개</button>)}{busy !== null && <button type="button" className={styles.button} onClick={() => controller.current?.abort()}>취소</button>}</div>
    {progress && <p role="status">{progress}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
  </details>;
}
