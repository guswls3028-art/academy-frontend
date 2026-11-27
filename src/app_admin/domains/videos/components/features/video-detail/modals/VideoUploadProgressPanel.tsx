import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileVideo2, RotateCcw, Upload, X } from "lucide-react";
import type { VideoTransferProgress } from "@admin/domains/videos/utils/videoUpload";
import { formatCompactFileSize } from "@/shared/utils/fileSize";
import "./VideoUploadProgressPanel.css";

export type UploadProgressRow = {
  id: string;
  file: File;
  title: string;
  progress?: VideoTransferProgress | "preparing" | "failed";
  error?: string;
};

type Props = {
  items: UploadProgressRow[];
  total: number;
  busy: boolean;
  selectedId?: string;
  onHide: () => void;
  onEdit: () => void;
  onRetry: (id?: string) => void;
};

function transferLabel({ file, progress }: UploadProgressRow) {
  if (!progress) return "전송 순서 대기";
  if (progress === "preparing") return "영상 등록 중";
  if (progress === "failed") return "실패";
  if (progress.phase === "confirming") return "저장 확인 · 인코딩 접수 중";
  if (progress.phase === "retrying") return "전송 재시도 중";
  return progress.bytes === file.size && file.size > 0 ? "저장소 응답 대기" : "전송 중";
}

export default function VideoUploadProgressPanel({ items, total, busy, selectedId, onHide, onEdit, onRetry }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);
  const titleId = useId();
  const listId = useId();
  const failed = items.filter(item => item.progress === "failed").length;
  const waiting = items.filter(item => !item.progress).length;
  const active = items.length - failed - waiting;

  useEffect(() => {
    const panel = panelRef.current;
    const selected = selectedRef.current;
    const trigger = document.activeElement;
    (selected ?? panel)?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: "nearest" });
    return () => {
      if (panel?.contains(document.activeElement) && trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [selectedId]);

  return (
    <section ref={panelRef} role="dialog" aria-modal="false" aria-labelledby={titleId}
      tabIndex={-1} className="video-transfer-panel"
      onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); onHide(); }
      }}>
      <header className="video-transfer-panel__header">
        <span className="video-transfer-panel__icon"><Upload size={18} aria-hidden /></span>
        <div className="video-transfer-panel__heading">
          <h2 id={titleId}>영상 업로드</h2>
          <span role="status">저장 완료 {total - items.length}/{total}개</span>
        </div>
        <button type="button" className="video-transfer-panel__tool" aria-label={collapsed ? "진행 목록 펼치기" : "진행 목록 접기"}
          aria-expanded={!collapsed} aria-controls={listId} onClick={() => setCollapsed(value => !value)}>
          {collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        <button type="button" className="video-transfer-panel__tool" aria-label="닫기" title="작업박스에 보관" onClick={onHide}>
          <X size={17} />
        </button>
      </header>
      <div id={listId} hidden={collapsed}>
        <div className="video-transfer-panel__summary" aria-label="파일 상태 요약">
          <span>진행 <b>{active}</b></span><span>대기 <b>{waiting}</b></span>
          <span data-failed={failed > 0}>실패 <b>{failed}</b></span>
        </div>
        <ol className="video-transfer-panel__list" aria-label="파일별 업로드 진행">
          {items.map(item => {
            const { id, file, title, progress, error } = item;
            const bytes = typeof progress === "object" ? progress.bytes : null;
            const percent = bytes !== null && file.size ? Math.floor(bytes * 100 / file.size) : 0;
            const state = !progress ? "waiting" : progress === "failed" ? "failed" : "active";
            return (
              <li key={id} ref={id === selectedId ? selectedRef : undefined} tabIndex={-1}
                className="video-transfer-panel__row" data-state={state} data-selected={id === selectedId}>
                <div className="video-transfer-panel__row-top">
                  <FileVideo2 size={15} aria-hidden />
                  <div className="video-transfer-panel__name">
                    {file.name.replace(/\.[^./\\]+$/, "") === title
                      ? <strong title={file.name}>{file.name}</strong>
                      : <><strong title={title}>{title}</strong><small title={file.name}>{file.name}</small></>}
                  </div>
                  <span className="video-transfer-panel__state">{transferLabel(item)}</span>
                </div>
                {bytes !== null ? (
                  <div className="video-transfer-panel__meter">
                    <progress max={100} value={file.size ? bytes * 100 / file.size : 0} aria-label={file.name + " 전송률"} />
                    <span>{bytes > 0 && !percent ? "<1" : percent}% · {formatCompactFileSize(bytes)} / {formatCompactFileSize(file.size)}</span>
                  </div>
                ) : state === "waiting" ? <small className="video-transfer-panel__size">{formatCompactFileSize(file.size)}</small> : null}
                {state === "failed" && (
                  <div className="video-transfer-panel__failure">
                    <span>{error}</span>
                    <button type="button" aria-label={file.name + " 다시 시도"} onClick={() => onRetry(id)}>
                      <RotateCcw size={13} aria-hidden />다시 시도
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <footer className="video-transfer-panel__footer">
          {failed && !busy ? <>
            <button type="button" onClick={onEdit}>파일 목록 편집</button>
            {failed > 1 && <button type="button" onClick={() => onRetry()}>실패 {failed}개 다시 시도</button>}
          </> : <span>전송이 끝날 때까지 브라우저 탭을 열어 두세요.</span>}
        </footer>
      </div>
    </section>
  );
}
