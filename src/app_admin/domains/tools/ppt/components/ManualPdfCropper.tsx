import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { normaliseCrop, openLocalPdf, type PdfCropRegion } from "../manualPdfCrop";
import styles from "./ManualPdfCropper.module.css";

interface Props {
  file: File;
  regions: PdfCropRegion[];
  onChange: (regions: PdfCropRegion[]) => void;
  disabled: boolean;
}

let cropSeq = 0;
const newId = () => `crop-${++cropSeq}`;

export default function ManualPdfCropper({ file, regions, onChange, disabled }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [draft, setDraft] = useState<PdfCropRegion | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let disposed = false;
    let loaded: PDFDocumentProxy | null = null;
    setPdf(null);
    setPage(1);
    setError("");
    void openLocalPdf(file).then((doc) => {
      if (disposed) {
        void doc.loadingTask.destroy();
        return;
      }
      loaded = doc;
      setPdf(doc);
    }).catch(() => {
      if (!disposed) setError("PDF를 열 수 없습니다. 파일을 다시 선택해주세요.");
    });
    return () => {
      disposed = true;
      if (loaded) void loaded.loadingTask.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let disposed = false;
    let task: RenderTask | null = null;
    setRendering(true);
    setError("");
    void pdf.getPage(page).then(async (pdfPage) => {
      if (disposed || !canvasRef.current) return;
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      task = pdfPage.render({ canvas, canvasContext: context, viewport });
      await task.promise;
      if (!disposed) setRendering(false);
    }).catch(() => {
      if (!disposed) {
        setRendering(false);
        setError("이 페이지를 표시하지 못했습니다. 다른 페이지를 보거나 PDF를 다시 선택해주세요.");
      }
    });
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [pdf, page]);

  const point = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const moveRegion = (index: number, offset: number) => {
    const next = [...regions];
    const [item] = next.splice(index, 1);
    next.splice(index + offset, 0, item);
    onChange(next);
  };

  const editRegion = (index: number, key: "x" | "y" | "width" | "height", percent: number) => {
    if (!Number.isFinite(percent)) return;
    const next = [...regions];
    const current = { ...next[index] };
    const value = percent / 100;
    if (key === "x") current.x = Math.max(0, Math.min(value, 1 - current.width));
    if (key === "y") current.y = Math.max(0, Math.min(value, 1 - current.height));
    if (key === "width") current.width = Math.max(0.02, Math.min(value, 1 - current.x));
    if (key === "height") current.height = Math.max(0.02, Math.min(value, 1 - current.y));
    next[index] = current;
    onChange(next);
  };

  const currentRegions = regions.filter((region) => region.page === page);
  const canAdd = !disabled && !rendering && !error && !!pdf && regions.length < 500;

  return (
    <section className={styles.wrapper} aria-label="PDF 직접 자르기">
      <div className={styles.heading}>
        <strong>직접 자르기</strong>
        <span>원하는 부분을 드래그하거나 페이지 전체를 추가하세요. 선택한 순서대로 슬라이드가 됩니다.</span>
      </div>
      {!pdf && !error && <p role="status">PDF 페이지를 여는 중...</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {pdf && (
        <>
          <div className={styles.navigation}>
            <button type="button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1 || disabled}>이전 쪽</button>
            <span aria-live="polite">{page} / {pdf.numPages}쪽</span>
            <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= pdf.numPages || disabled}>다음 쪽</button>
            <button type="button" onClick={() => onChange([...regions, { id: newId(), page, x: 0, y: 0, width: 1, height: 1 }])} disabled={!canAdd}>현재 쪽 전체 추가</button>
          </div>
          <div className={styles.pageStage} aria-busy={rendering}>
            <canvas ref={canvasRef} className={styles.canvas} aria-label={`${page}쪽 PDF 미리보기`} />
            {!rendering && !error && (
              <div
                className={styles.selectionLayer}
                data-testid="ppt-pdf-selection-layer"
                onPointerDown={(event) => {
                  if (!canAdd) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragStart.current = point(event);
                  setDraft(null);
                }}
                onPointerMove={(event) => {
                  if (!dragStart.current) return;
                  setDraft(normaliseCrop(page, dragStart.current, point(event), "draft"));
                }}
                onPointerUp={(event) => {
                  const start = dragStart.current;
                  dragStart.current = null;
                  setDraft(null);
                  if (!start) return;
                  const region = normaliseCrop(page, start, point(event), newId());
                  if (region) onChange([...regions, region]);
                }}
                onPointerCancel={() => { dragStart.current = null; setDraft(null); }}
              >
                {currentRegions.map((region) => (
                  <div key={region.id} className={styles.region}
                    // eslint-disable-next-line no-restricted-syntax
                    style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}>
                    <span>{regions.indexOf(region) + 1}</span>
                  </div>
                ))}
                {draft && <div className={`${styles.region} ${styles.draft}`}
                  // eslint-disable-next-line no-restricted-syntax
                  style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.width * 100}%`, height: `${draft.height * 100}%` }} />}
              </div>
            )}
          </div>
          {rendering && <p role="status">{page}쪽 표시 중...</p>}
          <div className={styles.regionHeader}>
            <strong>선택한 슬라이드 {regions.length}장</strong>
            {regions.length > 0 && <button type="button" onClick={() => onChange([])} disabled={disabled}>선택 모두 지우기</button>}
          </div>
          {regions.length === 0 ? <p className={styles.empty}>선택한 영역이 없습니다. 먼저 한 영역을 추가해주세요.</p> : (
            <ol className={styles.regionList}>
              {regions.map((region, index) => (
                <li key={region.id} className={styles.regionItem} data-testid="ppt-crop-region">
                  <div className={styles.regionRow}>
                    <strong>{index + 1}. {region.page}쪽</strong>
                    <div className={styles.regionActions}>
                      <button type="button" onClick={() => setPage(region.page)} disabled={disabled}>보기</button>
                      <button type="button" onClick={() => moveRegion(index, -1)} disabled={disabled || index === 0} aria-label={`${index + 1}번 슬라이드 앞으로`}>↑</button>
                      <button type="button" onClick={() => moveRegion(index, 1)} disabled={disabled || index === regions.length - 1} aria-label={`${index + 1}번 슬라이드 뒤로`}>↓</button>
                      <button type="button" onClick={() => onChange(regions.filter((item) => item.id !== region.id))} disabled={disabled}>삭제</button>
                    </div>
                  </div>
                  <div className={styles.fields}>
                    {(["x", "y", "width", "height"] as const).map((key) => (
                      <label key={key}>
                        {{ x: "왼쪽", y: "위", width: "너비", height: "높이" }[key]} (%)
                        <input type="number" min={key === "width" || key === "height" ? 2 : 0} max="100" step="1" value={Math.round(region[key] * 100)} onChange={(event) => editRegion(index, key, Number(event.target.value))} disabled={disabled} />
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
