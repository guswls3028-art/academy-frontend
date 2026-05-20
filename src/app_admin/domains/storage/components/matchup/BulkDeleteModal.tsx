// PATH: src/app_admin/domains/storage/components/matchup/BulkDeleteModal.tsx
//
// 자동분리 잔존 일괄삭제 모달 (A-2 2026-05-08).
//
// 이전: native window.prompt 두 단계 (입력 → confirm). 모바일/태블릿 viewport
// 미고정 + 디자인 시스템과 일관성 0 + 입력 중 실시간 피드백 부재.
//
// 신규: 디자인 시스템 토큰 + portal 백드롭 + 라이브 미리보기. 학원장이 "162" 만
// 입력해도 즉시 "162~maxNum 14개 삭제 (직접 자른 3개 자동 보호)" 가 노출되어
// 우발 손실 차단. 잘못 입력하면 빨간 인디케이터로 즉시 인지.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X, AlertTriangle, Shield } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import type { MatchupProblem } from "../../api/matchup.api";
import styles from "./BulkDeleteModal.module.css";

type Props = {
  problems: MatchupProblem[];
  /** 확정 — 백엔드 호출은 호출부 책임. 모달은 입력 검증 + UX 만 담당. */
  onConfirm: (range: { numberFrom: number; numberTo: number }) => Promise<void> | void;
  onClose: () => void;
};

type ParseResult =
  | { ok: true; numberFrom: number; numberTo: number }
  | { ok: false; reason: string }
  | { ok: null };  // 빈 입력 — 에러 X, 단순 idle

function parseRange(input: string, maxNum: number): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: null };
  const m = trimmed.match(/^(\d+)\s*[-~]\s*(\d+)$/);
  if (m) {
    const from = parseInt(m[1], 10);
    const to = parseInt(m[2], 10);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
      return { ok: false, reason: "1 이상의 숫자를 입력해 주세요" };
    }
    if (from > to) return { ok: false, reason: "시작 번호가 끝 번호보다 큽니다" };
    return { ok: true, numberFrom: from, numberTo: to };
  }
  const single = parseInt(trimmed, 10);
  if (!Number.isInteger(single) || single < 1) {
    return { ok: false, reason: "예: 162 (단방향) 또는 150-200 (구간)" };
  }
  // 단방향 → maxNum 으로 상한 자동 강제. 학원장 우발 입력 안전망.
  return { ok: true, numberFrom: single, numberTo: maxNum };
}

export default function BulkDeleteModal({ problems, onConfirm, onClose }: Props) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { minNum, maxNum } = useMemo(() => {
    if (problems.length === 0) return { minNum: 1, maxNum: 1 };
    let mn = problems[0].number;
    let mx = problems[0].number;
    for (const p of problems) {
      if (p.number < mn) mn = p.number;
      if (p.number > mx) mx = p.number;
    }
    return { minNum: mn, maxNum: mx };
  }, [problems]);

  const parsed = useMemo(() => parseRange(input, maxNum), [input, maxNum]);

  const preview = useMemo(() => {
    if (!parsed || parsed.ok !== true) return null;
    const { numberFrom, numberTo } = parsed;
    const inRange = (n: number) => n >= numberFrom && n <= numberTo;
    const hits = problems.filter((p) => inRange(p.number));
    const manual = hits.filter((p) => Boolean(p.meta?.manual));
    const targets = hits.filter((p) => !p.meta?.manual);
    const targetNums = targets.map((p) => p.number).sort((a, b) => a - b);
    return {
      from: numberFrom,
      to: numberTo,
      targets,
      targetCount: targets.length,
      manualCount: manual.length,
      sampleHead: targetNums.slice(0, 5),
      sampleLast: targetNums.length > 5 ? targetNums[targetNums.length - 1] : null,
    };
  }, [parsed, problems]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const canSubmit = !!preview && preview.targetCount > 0 && !submitting;
  const inputState =
    parsed && parsed.ok === false
      ? "error"
      : preview && preview.targetCount > 0
        ? "ready"
        : "idle";

  const handleSubmit = async () => {
    if (!canSubmit || !preview) return;
    setSubmitting(true);
    try {
      await onConfirm({ numberFrom: preview.from, numberTo: preview.to });
      onClose();
    } catch {
      // onConfirm 이 throw 하면 모달 유지 — 사용자가 재시도 가능. 토스트는 호출부 책임.
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="자동분리 잔존 일괄삭제"
      onClick={submitting ? undefined : onClose}
      className={styles.backdrop}
    >
      <div
        data-testid="matchup-bulk-delete-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSubmit) {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT") {
              e.preventDefault();
              void handleSubmit();
            }
          }
        }}
        className={styles.modal}
      >
        {/* 헤더 */}
        <div className={styles.header}>
          <Trash2 size={ICON.md} className={styles.dangerIcon} />
          <h3 className={styles.title}>
            자동분리 잔존 일괄삭제
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="닫기"
            className={styles.closeButton}
            data-submitting={submitting ? "true" : "false"}
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* 본문 */}
        <div className={styles.body}>
          <div className={styles.description}>
            현재 자료 총 <strong>{problems.length}개</strong> 문항
            (번호 {minNum}~{maxNum}).
            <br />직접 자른 문항은 <strong>자동으로 보호</strong>됩니다.
          </div>

          <label className={styles.rangeLabel}>
            <span className={styles.labelTitle}>
              삭제할 번호 범위
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="예: 162 (단방향)  또는  150-200 (구간)"
              data-testid="matchup-bulk-delete-input"
              disabled={submitting}
              className={styles.rangeInput}
              data-state={inputState}
            />
            <span className={styles.hint}>
              · 단방향 입력 시 <strong>{maxNum}</strong>까지 자동 적용됩니다.
            </span>
          </label>

          {/* 라이브 미리보기 — 입력하는 동안 실시간 노출 */}
          {parsed && parsed.ok === false && (
            <div
              data-testid="matchup-bulk-delete-error"
              className={styles.errorBox}
            >
              <AlertTriangle size={ICON.sm} className={styles.inlineIcon} />
              <span>{parsed.reason}</span>
            </div>
          )}

          {preview && (
            <div
              data-testid="matchup-bulk-delete-preview"
              className={styles.previewBox}
              data-state={preview.targetCount > 0 ? "target" : "empty"}
            >
              <div className={styles.previewHeader}>
                <span
                  className={styles.previewTitle}
                  data-state={preview.targetCount > 0 ? "target" : "empty"}
                >
                  {preview.from}~{preview.to}번 ·{" "}
                  {preview.targetCount > 0
                    ? `${preview.targetCount}개 삭제 예정`
                    : "삭제할 자동분리 문항이 없습니다"}
                </span>
              </div>

              {preview.targetCount > 0 && (
                <div className={styles.targetNumbers}>
                  대상 번호: {preview.sampleHead.join(", ")}
                  {preview.sampleLast !== null && `, ... ${preview.sampleLast}`}
                </div>
              )}

              {preview.manualCount > 0 && (
                <div className={styles.protectedNote}>
                  <Shield size={ICON.xs} className={styles.inlineIcon} />
                  직접 자른 {preview.manualCount}개 문항은 자동 보호됩니다
                </div>
              )}
            </div>
          )}

          <div className={styles.irreversible}>
            ⚠ 이 작업은 되돌릴 수 없습니다.
          </div>
        </div>

        {/* 액션 */}
        <div className={styles.footer}>
          <Button
            intent="ghost"
            size="md"
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            intent="danger"
            size="md"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="matchup-bulk-delete-confirm"
            leftIcon={<Trash2 size={ICON.sm} />}
          >
            {submitting
              ? "삭제 중…"
              : preview && preview.targetCount > 0
                ? `${preview.targetCount}개 삭제`
                : "삭제"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
